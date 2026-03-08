import { FIXED_ROOM_ID } from "../../shared/constants";
import { ConflictError, NotFoundError, ValidationError } from "../../shared/errors";
import { boolFromSql, nowIso } from "../../shared/utils";
import type { RedemptionRecord, ScoreBoard, ShopItem, UserId } from "../../shared/types";
import type { RoomStorage } from "../storage/types";
import { RecordService } from "./record-service";
import { ScoreService } from "./score-service";

interface ShopItemRow {
  active: number;
  cost: number;
  description: string;
  emoji: string;
  id: string;
  name: string;
  price_hint: string;
  stock: number;
}

export class ShopService {
  constructor(
    private readonly storage: RoomStorage,
    private readonly scoreService: ScoreService,
    private readonly recordService: RecordService,
  ) {}

  listItems(): ShopItem[] {
    return this.listItemsByActive(true);
  }

  listAllItems(): ShopItem[] {
    const rows = this.storage.sql.exec<ShopItemRow>(
      `
        SELECT id, name, description, cost, stock, emoji, active, price_hint
        FROM shop_items
        ORDER BY sort_order ASC, id ASC
      `,
    ).toArray();

    return rows.map((row) => this.toShopItem(row));
  }

  createItem(input: {
    cost: number;
    description: string;
    emoji: string;
    id: string;
    name: string;
    priceHint: string;
    stock: number;
  }): ShopItem {
    const normalized = this.normalizeItemInput(input);

    if (this.getItem(normalized.id)) {
      throw new ConflictError("ITEM_ALREADY_EXISTS", "这个商品 ID 已经存在了。");
    }

    const nextSortOrder = this.getNextSortOrder();
    const timestamp = nowIso();

    this.storage.sql.exec(
      `
        INSERT INTO shop_items (
          id,
          name,
          description,
          cost,
          stock,
          emoji,
          price_hint,
          sort_order,
          active,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `,
      normalized.id,
      normalized.name,
      normalized.description,
      normalized.cost,
      normalized.stock,
      normalized.emoji,
      normalized.priceHint,
      nextSortOrder,
      timestamp,
      timestamp,
    );

    return this.getItemOrThrow(normalized.id);
  }

  updateItem(input: {
    active: boolean;
    cost: number;
    description: string;
    emoji: string;
    id: string;
    name: string;
    priceHint: string;
    stock: number;
  }): ShopItem {
    const existingItem = this.getItem(input.id);

    if (!existingItem) {
      throw new NotFoundError("ITEM_NOT_FOUND", "要更新的礼物不存在。");
    }

    const normalized = this.normalizeItemInput(input);

    this.storage.sql.exec(
      `
        UPDATE shop_items
        SET
          name = ?,
          description = ?,
          cost = ?,
          stock = ?,
          emoji = ?,
          price_hint = ?,
          active = ?,
          updated_at = ?
        WHERE id = ?
      `,
      normalized.name,
      normalized.description,
      normalized.cost,
      normalized.stock,
      normalized.emoji,
      normalized.priceHint,
      normalized.active ? 1 : 0,
      nowIso(),
      normalized.id,
    );

    return this.getItemOrThrow(normalized.id);
  }

  deleteItem(itemId: string): void {
    const existingItem = this.getItem(itemId);

    if (!existingItem) {
      throw new NotFoundError("ITEM_NOT_FOUND", "要删除的礼物不存在。");
    }

    this.storage.sql.exec(
      "UPDATE shop_items SET active = 0, updated_at = ? WHERE id = ?",
      nowIso(),
      itemId,
    );
  }

  private listItemsByActive(activeOnly: boolean): ShopItem[] {
    const rows = this.storage.sql.exec<ShopItemRow>(
      `
        SELECT id, name, description, cost, stock, emoji, active, price_hint
        FROM shop_items
        ${activeOnly ? "WHERE active = 1" : ""}
        ORDER BY sort_order ASC
      `,
    ).toArray();

    return rows.map((row) => this.toShopItem(row));
  }

  getItem(itemId: string): ShopItem | null {
    const rows = this.storage.sql.exec<ShopItemRow>(
      `
        SELECT id, name, description, cost, stock, emoji, active, price_hint
        FROM shop_items
        WHERE id = ?
        LIMIT 1
      `,
      itemId,
    ).toArray();

    return rows[0] ? this.toShopItem(rows[0]) : null;
  }

  redeem(userId: UserId, itemId: string): { item: ShopItem; redemption: RedemptionRecord; scores: ScoreBoard } {
    let item: ShopItem | null = null;
    let redemption: RedemptionRecord | null = null;
    let scores: ScoreBoard | null = null;

    this.storage.transactionSync(() => {
      const nextItem = this.getItem(itemId);

      if (!nextItem || !nextItem.active) {
        throw new NotFoundError("ITEM_NOT_FOUND", "要兑换的礼物不存在。");
      }

      if (nextItem.stock <= 0) {
        throw new ConflictError("OUT_OF_STOCK", "礼物库存已经没有了。");
      }

      this.scoreService.deductScore(userId, nextItem.cost);

      this.storage.sql.exec(
        "UPDATE shop_items SET stock = stock - 1, updated_at = ? WHERE id = ?",
        nowIso(),
        itemId,
      );

      redemption = this.recordService.insertRedemptionRecord({
        cost: nextItem.cost,
        createdAt: nowIso(),
        itemId,
        itemName: nextItem.name,
        roomId: FIXED_ROOM_ID,
        userId,
      });

      item = this.getItem(itemId);
      scores = this.scoreService.getScores();
    });

    if (!item || !redemption || !scores) {
      throw new ConflictError("REDEEM_FAILED", "兑换失败，请稍后再试。");
    }

    return { item, redemption, scores };
  }

  private toShopItem(row: ShopItemRow): ShopItem {
    return {
      active: boolFromSql(row.active),
      cost: Number(row.cost),
      description: row.description,
      emoji: row.emoji,
      id: row.id,
      name: row.name,
      priceHint: row.price_hint,
      stock: Number(row.stock),
    };
  }

  private getItemOrThrow(itemId: string): ShopItem {
    const item = this.getItem(itemId);

    if (!item) {
      throw new NotFoundError("ITEM_NOT_FOUND", "礼物不存在。");
    }

    return item;
  }

  private getNextSortOrder(): number {
    const rows = this.storage.sql.exec<{ next_sort_order: number | null }>(
      "SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_sort_order FROM shop_items",
    ).toArray();

    return Number(rows[0]?.next_sort_order ?? 1);
  }

  private normalizeItemInput(input: {
    active?: boolean;
    cost: number;
    description: string;
    emoji: string;
    id: string;
    name: string;
    priceHint: string;
    stock: number;
  }): {
    active: boolean;
    cost: number;
    description: string;
    emoji: string;
    id: string;
    name: string;
    priceHint: string;
    stock: number;
  } {
    const id = String(input.id ?? "").trim();
    const name = String(input.name ?? "").trim();
    const description = String(input.description ?? "").trim();
    const emoji = String(input.emoji ?? "").trim();
    const priceHint = String(input.priceHint ?? "").trim();

    if (!/^[a-z0-9-]+$/.test(id)) {
      throw new ValidationError("INVALID_ITEM_ID", "商品 ID 只能包含小写字母、数字和连字符。");
    }

    if (!name) {
      throw new ValidationError("INVALID_ITEM_NAME", "商品名称不能为空。");
    }

    if (!description) {
      throw new ValidationError("INVALID_ITEM_DESCRIPTION", "商品描述不能为空。");
    }

    if (!emoji) {
      throw new ValidationError("INVALID_ITEM_EMOJI", "请填写一个商品图标。");
    }

    if (!Number.isInteger(input.cost) || input.cost < 0) {
      throw new ValidationError("INVALID_ITEM_COST", "商品积分必须是大于等于 0 的整数。");
    }

    if (!Number.isInteger(input.stock) || input.stock < 0) {
      throw new ValidationError("INVALID_ITEM_STOCK", "商品库存必须是大于等于 0 的整数。");
    }

    return {
      active: input.active ?? true,
      cost: input.cost,
      description,
      emoji,
      id,
      name,
      priceHint,
      stock: input.stock,
    };
  }
}
