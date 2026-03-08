import { FIXED_USER_IDS, INITIAL_ROUND_STATE, SHOP_ITEM_SEEDS, USER_DIRECTORY } from "../../shared/constants";
import { nowIso } from "../../shared/utils";
import type { RoomStorage } from "./types";

export function seedInitialData(storage: RoomStorage): void {
  const timestamp = nowIso();

  storage.transactionSync(() => {
    for (const userId of FIXED_USER_IDS) {
      storage.sql.exec(
        `
          INSERT INTO users (id, display_name, score, created_at, updated_at)
          VALUES (?, ?, 0, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            display_name = excluded.display_name,
            updated_at = excluded.updated_at
        `,
        userId,
        USER_DIRECTORY[userId].displayName,
        timestamp,
        timestamp,
      );
    }

    for (const item of SHOP_ITEM_SEEDS) {
      storage.sql.exec(
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
          ON CONFLICT(id) DO NOTHING
        `,
        item.id,
        item.name,
        item.description,
        item.cost,
        item.stock,
        item.emoji,
        item.priceHint,
        item.sortOrder,
        timestamp,
        timestamp,
      );
    }

    storage.sql.exec(
      `
        INSERT OR IGNORE INTO room_state (key, value, updated_at)
        VALUES (?, ?, ?)
      `,
      "current_round",
      JSON.stringify(INITIAL_ROUND_STATE),
      timestamp,
    );
  });
}
