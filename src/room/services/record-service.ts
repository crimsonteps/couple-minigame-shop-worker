import { DEFAULT_RECENT_LIMIT, FIXED_ROOM_ID, PRIMARY_USER_ID, SECONDARY_USER_ID } from "../../shared/constants";
import type { GameRecord, GameType, GiftCard, RedemptionRecord, RoomId, ScoreBoard, UserId } from "../../shared/types";
import type { RoomStorage } from "../storage/types";

interface GameRoundRow {
  detail_json: string;
  game_type: GameType;
  id: number;
  played_at: string;
  player1_choice: string;
  player1_id: UserId;
  player1_score_delta: number;
  player2_choice: string;
  player2_id: UserId;
  player2_score_delta: number;
  room_id: RoomId;
  summary: string;
  winner_id: UserId | null;
}

interface RedemptionRow {
  cost: number;
  created_at: string;
  id: number;
  item_id: string;
  item_name: string;
  room_id: RoomId;
  user_id: UserId;
}

interface GiftCardRow extends RedemptionRow {
  description: string | null;
  emoji: string | null;
}

export class RecordService {
  constructor(private readonly storage: RoomStorage) {}

  listRecentGames(limit = DEFAULT_RECENT_LIMIT): GameRecord[] {
    const rows = this.storage.sql.exec<GameRoundRow>(
      `
        SELECT
          id,
          room_id,
          game_type,
          player1_id,
          player2_id,
          player1_choice,
          player2_choice,
          winner_id,
          summary,
          detail_json,
          player1_score_delta,
          player2_score_delta,
          played_at
        FROM game_rounds
        ORDER BY id DESC
        LIMIT ?
      `,
      limit,
    ).toArray();

    return rows.map((row) => this.toGameRecord(row));
  }

  insertGameRecord(input: {
    choices: Record<UserId, string>;
    detailLines: string[];
    gameType: GameType;
    playedAt: string;
    roomId?: RoomId;
    scoreDelta: ScoreBoard;
    summary: string;
    winnerId: UserId | null;
  }): GameRecord {
    const roomId = input.roomId ?? FIXED_ROOM_ID;

    this.storage.sql.exec(
      `
        INSERT INTO game_rounds (
          room_id,
          game_type,
          player1_id,
          player2_id,
          player1_choice,
          player2_choice,
          winner_id,
          summary,
          detail_json,
          player1_score_delta,
          player2_score_delta,
          played_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      roomId,
      input.gameType,
      PRIMARY_USER_ID,
      SECONDARY_USER_ID,
      input.choices[PRIMARY_USER_ID],
      input.choices[SECONDARY_USER_ID],
      input.winnerId,
      input.summary,
      JSON.stringify(input.detailLines),
      input.scoreDelta[PRIMARY_USER_ID],
      input.scoreDelta[SECONDARY_USER_ID],
      input.playedAt,
    );

    const id = this.getLastInsertId();
    return {
      choices: input.choices,
      detailLines: [...input.detailLines],
      gameType: input.gameType,
      id,
      playedAt: input.playedAt,
      players: [PRIMARY_USER_ID, SECONDARY_USER_ID],
      roomId,
      scoreDelta: input.scoreDelta,
      summary: input.summary,
      winnerId: input.winnerId,
    };
  }

  listRecentRedemptions(limit = DEFAULT_RECENT_LIMIT): RedemptionRecord[] {
    const rows = this.storage.sql.exec<RedemptionRow>(
      `
        SELECT id, room_id, item_id, item_name, user_id, cost, created_at
        FROM redemptions
        ORDER BY id DESC
        LIMIT ?
      `,
      limit,
    ).toArray();

    return rows.map((row) => this.toRedemptionRecord(row));
  }

  listGiftCardsByUser(userId: UserId): GiftCard[] {
    const rows = this.storage.sql.exec<GiftCardRow>(
      `
        SELECT
          redemptions.id,
          redemptions.room_id,
          redemptions.item_id,
          redemptions.item_name,
          redemptions.user_id,
          redemptions.cost,
          redemptions.created_at,
          shop_items.emoji,
          shop_items.description
        FROM redemptions
        LEFT JOIN shop_items ON shop_items.id = redemptions.item_id
        WHERE redemptions.user_id = ?
        ORDER BY redemptions.id DESC
      `,
      userId,
    ).toArray();

    return rows.map((row) => this.toGiftCard(row));
  }

  insertRedemptionRecord(input: {
    cost: number;
    createdAt: string;
    itemId: string;
    itemName: string;
    roomId?: RoomId;
    userId: UserId;
  }): RedemptionRecord {
    const roomId = input.roomId ?? FIXED_ROOM_ID;

    this.storage.sql.exec(
      `
        INSERT INTO redemptions (room_id, item_id, item_name, user_id, cost, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      roomId,
      input.itemId,
      input.itemName,
      input.userId,
      input.cost,
      input.createdAt,
    );

    return {
      cost: input.cost,
      createdAt: input.createdAt,
      id: this.getLastInsertId(),
      itemId: input.itemId,
      itemName: input.itemName,
      roomId,
      userId: input.userId,
    };
  }

  private getLastInsertId(): number {
    const rows = this.storage.sql.exec<{ id: number }>("SELECT last_insert_rowid() AS id").toArray();
    return Number(rows[0]?.id ?? 0);
  }

  private toGameRecord(row: GameRoundRow): GameRecord {
    let detailLines: string[] = [];

    try {
      const parsed = JSON.parse(row.detail_json) as unknown;
      detailLines = Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
    } catch {
      detailLines = [];
    }

    return {
      choices: {
        [PRIMARY_USER_ID]: row.player1_choice,
        [SECONDARY_USER_ID]: row.player2_choice,
      },
      detailLines,
      gameType: row.game_type,
      id: Number(row.id),
      playedAt: row.played_at,
      players: [row.player1_id, row.player2_id],
      roomId: row.room_id,
      scoreDelta: {
        [PRIMARY_USER_ID]: Number(row.player1_score_delta),
        [SECONDARY_USER_ID]: Number(row.player2_score_delta),
      },
      summary: row.summary,
      winnerId: row.winner_id,
    };
  }

  private toRedemptionRecord(row: RedemptionRow): RedemptionRecord {
    return {
      cost: Number(row.cost),
      createdAt: row.created_at,
      id: Number(row.id),
      itemId: row.item_id,
      itemName: row.item_name,
      roomId: row.room_id,
      userId: row.user_id,
    };
  }

  private toGiftCard(row: GiftCardRow): GiftCard {
    return {
      cost: Number(row.cost),
      createdAt: row.created_at,
      description: row.description ?? "已收藏到礼物卡片。",
      emoji: row.emoji ?? "🎁",
      id: Number(row.id),
      itemId: row.item_id,
      itemName: row.item_name,
      ownerId: row.user_id,
      serial: `OK-${String(row.id).padStart(4, "0")}`,
    };
  }
}
