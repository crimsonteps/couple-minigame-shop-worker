import type { WebSocket } from "ws";
import { DEFAULT_RECENT_LIMIT, FIXED_ROOM_ID, FIXED_USER_IDS } from "../shared/constants";
import { ConflictError, NotFoundError, ValidationError } from "../shared/errors";
import { jsonError, jsonOk, methodNotAllowed } from "../shared/response";
import {
  assertAdminUserId,
  assertInteger,
  assertUserId,
  createEmptyOnlineStatus,
  gameTypeLabel,
  nowIso,
  readJson,
  toRoundSnapshot,
} from "../shared/utils";
import type { ServerMessage } from "../shared/protocol";
import type {
  AdminPageData,
  DashboardSnapshot,
  HealthCheckData,
  ProfilePageData,
  RecordsPageData,
  ShopPageData,
  UserId,
} from "../shared/types";
import { ConnectionManager } from "./connection-manager";
import { GameEngine } from "./game-engine";
import { createErrorMessage, createNoticeMessage, handleProtocolMessage } from "./protocol-handlers";
import { RoomState } from "./room-state";
import { RecordService } from "./services/record-service";
import { ScoreService } from "./services/score-service";
import { ShopService } from "./services/shop-service";
import { UserService } from "./services/user-service";
import { applyMigrations } from "./storage/migrations";
import { seedInitialData } from "./storage/seed";
import type { RoomStorage } from "./storage/types";

export class CoupleRoom {
  private readonly connectionManager: ConnectionManager;
  private readonly gameEngine: GameEngine;
  private readonly recordService: RecordService;
  private readonly roomState: RoomState;
  private readonly scoreService: ScoreService;
  private readonly shopService: ShopService;
  private readonly userService: UserService;
  private schemaVersion = 0;

  constructor(private readonly storage: RoomStorage) {
    this.connectionManager = new ConnectionManager();
    this.roomState = new RoomState(storage);
    this.scoreService = new ScoreService(storage);
    this.recordService = new RecordService(storage);
    this.userService = new UserService(storage);
    this.shopService = new ShopService(storage, this.scoreService, this.recordService);
    this.gameEngine = new GameEngine(storage, this.roomState, this.scoreService, this.recordService);

    this.schemaVersion = applyMigrations(storage);
    seedInitialData(storage);
  }

  async fetch(request: Request): Promise<Response> {
    try {
      const url = new URL(request.url);

      if (url.pathname === "/internal/dashboard") {
        if (request.method !== "GET") {
          return methodNotAllowed(["GET"]);
        }

        const userId = assertUserId(url.searchParams.get("user"));
        return jsonOk(this.buildDashboardSnapshot(userId));
      }

      if (url.pathname === "/internal/shop") {
        if (request.method !== "GET") {
          return methodNotAllowed(["GET"]);
        }

        return jsonOk(this.buildShopPageData());
      }

      if (url.pathname === "/internal/shop/redeem") {
        if (request.method !== "POST") {
          return methodNotAllowed(["POST"]);
        }

        const body = await readJson<{ itemId?: unknown; userId?: unknown }>(request);
        const userId = assertUserId(body.userId);
        const itemId = String(body.itemId ?? "").trim();

        if (!itemId) {
          throw new ValidationError("INVALID_ITEM_ID", "兑换商品时必须传入 itemId。");
        }

        const redeemed = this.shopService.redeem(userId, itemId);
        const snapshot = this.buildDashboardSnapshot(userId);

        this.connectionManager.broadcast(
          createNoticeMessage(`${userId} 兑换了 ${redeemed.redemption.itemName}，扣除了 ${redeemed.redemption.cost} 分。`, "success"),
        );
        this.broadcastSnapshot();

        return jsonOk({
          item: redeemed.item,
          redemption: redeemed.redemption,
          snapshot,
        });
      }

      if (url.pathname === "/internal/records") {
        if (request.method !== "GET") {
          return methodNotAllowed(["GET"]);
        }

        return jsonOk(this.buildRecordsPageData());
      }

      if (url.pathname === "/internal/profile") {
        if (request.method !== "GET") {
          return methodNotAllowed(["GET"]);
        }

        const userId = assertUserId(url.searchParams.get("user"));
        return jsonOk(this.buildProfilePageData(userId));
      }

      if (url.pathname === "/internal/health") {
        if (request.method !== "GET") {
          return methodNotAllowed(["GET"]);
        }

        const healthData: HealthCheckData = {
          currentRoundStatus: this.roomState.getCurrentRound().status,
          ok: true,
          onlineCount: Object.values(this.connectionManager.getOnlineStatus()).filter(Boolean).length,
          roomId: FIXED_ROOM_ID,
          schemaVersion: this.schemaVersion,
          serverTime: nowIso(),
        };

        return jsonOk(healthData);
      }

      if (url.pathname === "/internal/admin") {
        if (request.method !== "GET") {
          return methodNotAllowed(["GET"]);
        }

        const actingUserId = assertAdminUserId(url.searchParams.get("user"));
        return jsonOk(this.buildAdminPageData(actingUserId));
      }

      if (url.pathname === "/internal/admin/users/score") {
        if (request.method !== "POST") {
          return methodNotAllowed(["POST"]);
        }

        const body = await readJson<{ actingUserId?: unknown; score?: unknown; userId?: unknown }>(request);
        const actingUserId = assertAdminUserId(body.actingUserId);
        const targetUserId = assertUserId(body.userId);
        const nextScore = assertInteger(body.score, "INVALID_SCORE", "积分必须是整数。");

        this.scoreService.setScore(targetUserId, nextScore);
        this.broadcastSnapshot();

        return jsonOk(this.buildAdminPageData(actingUserId));
      }

      if (url.pathname === "/internal/admin/shop/create") {
        if (request.method !== "POST") {
          return methodNotAllowed(["POST"]);
        }

        const body = await readJson<{
          actingUserId?: unknown;
          cost?: unknown;
          description?: unknown;
          emoji?: unknown;
          id?: unknown;
          name?: unknown;
          priceHint?: unknown;
          stock?: unknown;
        }>(request);
        const actingUserId = assertAdminUserId(body.actingUserId);

        this.shopService.createItem({
          cost: assertInteger(body.cost, "INVALID_ITEM_COST", "商品积分必须是整数。"),
          description: String(body.description ?? ""),
          emoji: String(body.emoji ?? ""),
          id: String(body.id ?? ""),
          name: String(body.name ?? ""),
          priceHint: String(body.priceHint ?? ""),
          stock: assertInteger(body.stock, "INVALID_ITEM_STOCK", "商品库存必须是整数。"),
        });
        this.broadcastSnapshot();

        return jsonOk(this.buildAdminPageData(actingUserId));
      }

      if (url.pathname === "/internal/admin/shop/update") {
        if (request.method !== "POST") {
          return methodNotAllowed(["POST"]);
        }

        const body = await readJson<{
          actingUserId?: unknown;
          active?: unknown;
          cost?: unknown;
          description?: unknown;
          emoji?: unknown;
          id?: unknown;
          name?: unknown;
          priceHint?: unknown;
          stock?: unknown;
        }>(request);
        const actingUserId = assertAdminUserId(body.actingUserId);

        this.shopService.updateItem({
          active: this.parseBoolean(body.active, true),
          cost: assertInteger(body.cost, "INVALID_ITEM_COST", "商品积分必须是整数。"),
          description: String(body.description ?? ""),
          emoji: String(body.emoji ?? ""),
          id: String(body.id ?? ""),
          name: String(body.name ?? ""),
          priceHint: String(body.priceHint ?? ""),
          stock: assertInteger(body.stock, "INVALID_ITEM_STOCK", "商品库存必须是整数。"),
        });
        this.broadcastSnapshot();

        return jsonOk(this.buildAdminPageData(actingUserId));
      }

      if (url.pathname === "/internal/admin/shop/delete") {
        if (request.method !== "POST") {
          return methodNotAllowed(["POST"]);
        }

        const body = await readJson<{ actingUserId?: unknown; itemId?: unknown }>(request);
        const actingUserId = assertAdminUserId(body.actingUserId);
        const itemId = String(body.itemId ?? "").trim();

        if (!itemId) {
          throw new ValidationError("INVALID_ITEM_ID", "删除商品时必须传入 itemId。");
        }

        this.shopService.deleteItem(itemId);
        this.broadcastSnapshot();

        return jsonOk(this.buildAdminPageData(actingUserId));
      }

      throw new NotFoundError("ROOM_ROUTE_NOT_FOUND", "未找到对应的房间接口。");
    } catch (error) {
      return jsonError(error);
    }
  }

  connect(userId: UserId, socket: WebSocket): void {
    this.connectionManager.accept(userId, socket);
    this.sendSnapshotToUser(userId);
    this.broadcastSnapshot();
  }

  handleSocketMessage(socket: WebSocket, message: string | ArrayBuffer | ArrayBufferView): void {
    const userId = this.connectionManager.getUserId(socket);

    if (!userId) {
      socket.close(4401, "Unknown socket session.");
      this.connectionManager.remove(socket);
      return;
    }

    try {
      handleProtocolMessage(
        {
          startGame: (actingUserId, gameType) => {
            const onlineStatus = this.connectionManager.getOnlineStatus();

            if (FIXED_USER_IDS.some((playerId) => !onlineStatus[playerId])) {
              throw new ConflictError("PLAYERS_NOT_ONLINE", "只有两个人都在线时才能开始新一轮。");
            }

            this.gameEngine.startRound(gameType);
            this.connectionManager.broadcast(
              createNoticeMessage(`${actingUserId} 发起了 ${gameTypeLabel(gameType)}。`, "info"),
            );
            this.broadcastSnapshot();
          },
          forceEndGame: (actingUserId) => {
            const round = this.gameEngine.forceEndRound(actingUserId);
            this.connectionManager.broadcast(createNoticeMessage(round.summary, "warning"));
            this.broadcastSnapshot();
          },
          pokeUser: (actingUserId, targetUserId) => {
            if (actingUserId === targetUserId) {
              throw new ValidationError("INVALID_POKE_TARGET", "不能戳自己。");
            }

            const onlineStatus = this.connectionManager.getOnlineStatus();
            const targetOnline = onlineStatus[targetUserId];

            if (targetOnline) {
              this.connectionManager.sendToUser(
                targetUserId,
                createNoticeMessage(`${actingUserId} 给你发来一个心动提醒。`, "info"),
              );
              this.connectionManager.sendToUser(
                actingUserId,
                createNoticeMessage(`已把心动提醒送到 ${targetUserId}。`, "success"),
              );
              return;
            }

            this.connectionManager.sendToUser(
              actingUserId,
              createNoticeMessage(`${targetUserId} 还没上线，先帮你留个小心动。`, "info"),
            );
          },
          submitGuessNumber: (actingUserId, value) => {
            const result = this.gameEngine.submitChoice(actingUserId, value);

            if (result.resolved) {
              this.connectionManager.broadcast(createNoticeMessage(result.round.summary, "success"));
            }

            this.broadcastSnapshot();
          },
          submitCharadesGuess: (actingUserId, guess) => {
            const result = this.gameEngine.submitChoice(actingUserId, guess);

            if (result.resolved) {
              this.connectionManager.broadcast(createNoticeMessage(result.round.summary, "success"));
            }

            this.broadcastSnapshot();
          },
          submitCharadesReady: (actingUserId) => {
            const result = this.gameEngine.submitChoice(actingUserId, "__ready__");

            if (!result.resolved) {
              this.connectionManager.sendToUser(
                actingUserId,
                createNoticeMessage("可以开始描述了，另一位已经能输入答案。", "success"),
              );
            }

            this.broadcastSnapshot();
          },
          submitRpsChoice: (actingUserId, choice) => {
            const result = this.gameEngine.submitChoice(actingUserId, choice);

            if (result.resolved) {
              this.connectionManager.broadcast(createNoticeMessage(result.round.summary, "success"));
            }

            this.broadcastSnapshot();
          },
          submitTelepathyChoice: (actingUserId, optionId) => {
            const result = this.gameEngine.submitChoice(actingUserId, optionId);

            if (result.resolved) {
              this.connectionManager.broadcast(createNoticeMessage(result.round.summary, "success"));
            }

            this.broadcastSnapshot();
          },
          sync: (actingUserId) => {
            this.sendSnapshotToUser(actingUserId);
          },
        },
        userId,
        message,
      );
    } catch (error) {
      this.sendToSocket(userId, createErrorMessage(error));
    }
  }

  handleSocketClose(socket: WebSocket): void {
    this.connectionManager.remove(socket);
    this.broadcastSnapshot();
  }

  handleSocketError(socket: WebSocket, _error: unknown): void {
    this.connectionManager.remove(socket);
    this.broadcastSnapshot();
  }

  private buildDashboardSnapshot(viewerId: UserId): DashboardSnapshot {
    const onlineStatus = this.connectionManager.getOnlineStatus();

    return {
      currentRound: toRoundSnapshot(this.roomState.getCurrentRound(), viewerId),
      online: onlineStatus,
      recentGames: this.recordService.listRecentGames(DEFAULT_RECENT_LIMIT),
      recentRedemptions: this.recordService.listRecentRedemptions(DEFAULT_RECENT_LIMIT),
      roomId: FIXED_ROOM_ID,
      scores: this.scoreService.getScores(),
      serverTime: nowIso(),
      shopItems: this.shopService.listItems(),
      users: this.userService.listUsers(onlineStatus),
    };
  }

  private buildShopPageData(): ShopPageData {
    const snapshot = this.buildDashboardSnapshot(FIXED_USER_IDS[0]);

    return {
      recentRedemptions: snapshot.recentRedemptions,
      scores: snapshot.scores,
      serverTime: snapshot.serverTime,
      shopItems: snapshot.shopItems,
      users: snapshot.users,
    };
  }

  private buildRecordsPageData(): RecordsPageData {
    const snapshot = this.buildDashboardSnapshot(FIXED_USER_IDS[0]);

    return {
      recentGames: snapshot.recentGames,
      recentRedemptions: snapshot.recentRedemptions,
      scores: snapshot.scores,
      serverTime: snapshot.serverTime,
      users: snapshot.users,
    };
  }

  private buildAdminPageData(actingUserId: UserId): AdminPageData {
    const onlineStatus = this.connectionManager.getOnlineStatus();
    const users = this.userService.listUsers(onlineStatus);
    const actingUser = users.find((user) => user.id === actingUserId);

    if (!actingUser) {
      throw new NotFoundError("USER_NOT_FOUND", "管理员用户不存在。");
    }

    return {
      actingUser,
      serverTime: nowIso(),
      shopItems: this.shopService.listAllItems(),
      users,
    };
  }

  private buildProfilePageData(userId: UserId): ProfilePageData {
    const onlineStatus = this.connectionManager.getOnlineStatus();
    const user = this.userService.listUsers(onlineStatus).find((item) => item.id === userId);

    if (!user) {
      throw new NotFoundError("USER_NOT_FOUND", "用户不存在。");
    }

    return {
      giftCards: this.recordService.listGiftCardsByUser(userId),
      recentGames: this.recordService.listRecentGames(DEFAULT_RECENT_LIMIT),
      recentRedemptions: this.recordService.listRecentRedemptions(DEFAULT_RECENT_LIMIT),
      serverTime: nowIso(),
      user,
    };
  }

  private broadcastSnapshot(): void {
    for (const userId of FIXED_USER_IDS) {
      this.sendSnapshotToUser(userId);
    }
  }

  private sendSnapshotToUser(userId: UserId): void {
    const message: ServerMessage = {
      payload: this.buildDashboardSnapshot(userId),
      type: "snapshot",
    };

    this.connectionManager.sendToUser(userId, message);
  }

  private sendToSocket(userId: UserId, message: ServerMessage): void {
    this.connectionManager.sendToUser(userId, message);
  }

  private parseBoolean(value: unknown, defaultValue: boolean): boolean {
    if (value === undefined || value === null || value === "") {
      return defaultValue;
    }

    if (typeof value === "boolean") {
      return value;
    }

    if (value === "true" || value === "1" || value === 1) {
      return true;
    }

    if (value === "false" || value === "0" || value === 0) {
      return false;
    }

    throw new ValidationError("INVALID_BOOLEAN", "布尔字段格式不正确。");
  }
}
