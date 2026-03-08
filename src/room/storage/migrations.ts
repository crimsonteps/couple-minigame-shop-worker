import { LEGACY_USER_ID_MAP, SHOP_ITEM_SEEDS } from "../../shared/constants";
import type { PersistedRoundState } from "../../shared/types";
import { nowIso } from "../../shared/utils";
import { SCHEMA_STATEMENTS, SCHEMA_VERSION } from "./schema";
import type { RoomStorage } from "./types";

function getCurrentSchemaVersion(storage: RoomStorage): number {
  const rows = storage.sql.exec<{ version: number | null }>(
    "SELECT MAX(version) AS version FROM schema_migrations",
  ).toArray();

  return Number(rows[0]?.version ?? 0);
}

function hasColumn(storage: RoomStorage, tableName: string, columnName: string): boolean {
  const rows = storage.sql.exec<{ name: string }>(`PRAGMA table_info(${tableName})`).toArray();
  return rows.some((row) => row.name === columnName);
}

function migrateFixedUsers(storage: RoomStorage): void {
  storage.sql.exec(
    `
      INSERT INTO users (id, display_name, score, created_at, updated_at)
      SELECT
        CASE id
          WHEN 'u1' THEN ?
          WHEN 'u2' THEN ?
          ELSE id
        END,
        CASE id
          WHEN 'u1' THEN ?
          WHEN 'u2' THEN ?
          ELSE display_name
        END,
        score,
        created_at,
        updated_at
      FROM users
      WHERE id IN ('u1', 'u2')
      ON CONFLICT(id) DO UPDATE SET
        display_name = excluded.display_name,
        score = excluded.score,
        updated_at = excluded.updated_at
    `,
    LEGACY_USER_ID_MAP.u1,
    LEGACY_USER_ID_MAP.u2,
    LEGACY_USER_ID_MAP.u1,
    LEGACY_USER_ID_MAP.u2,
  );

  storage.sql.exec("DELETE FROM users WHERE id IN ('u1', 'u2')");

  storage.sql.exec(
    `
      UPDATE game_rounds
      SET
        player1_id = CASE player1_id WHEN 'u1' THEN ? WHEN 'u2' THEN ? ELSE player1_id END,
        player2_id = CASE player2_id WHEN 'u1' THEN ? WHEN 'u2' THEN ? ELSE player2_id END,
        winner_id = CASE winner_id WHEN 'u1' THEN ? WHEN 'u2' THEN ? ELSE winner_id END
      WHERE player1_id IN ('u1', 'u2')
         OR player2_id IN ('u1', 'u2')
         OR winner_id IN ('u1', 'u2')
    `,
    LEGACY_USER_ID_MAP.u1,
    LEGACY_USER_ID_MAP.u2,
    LEGACY_USER_ID_MAP.u1,
    LEGACY_USER_ID_MAP.u2,
    LEGACY_USER_ID_MAP.u1,
    LEGACY_USER_ID_MAP.u2,
  );

  storage.sql.exec(
    `
      UPDATE redemptions
      SET user_id = CASE user_id WHEN 'u1' THEN ? WHEN 'u2' THEN ? ELSE user_id END
      WHERE user_id IN ('u1', 'u2')
    `,
    LEGACY_USER_ID_MAP.u1,
    LEGACY_USER_ID_MAP.u2,
  );

  storage.sql.exec(
    `
      UPDATE game_rounds
      SET
        summary = REPLACE(REPLACE(summary, 'u1', ?), 'u2', ?),
        detail_json = REPLACE(REPLACE(detail_json, 'u1', ?), 'u2', ?)
      WHERE summary LIKE '%u1%'
         OR summary LIKE '%u2%'
         OR detail_json LIKE '%u1%'
         OR detail_json LIKE '%u2%'
    `,
    LEGACY_USER_ID_MAP.u1,
    LEGACY_USER_ID_MAP.u2,
    LEGACY_USER_ID_MAP.u1,
    LEGACY_USER_ID_MAP.u2,
  );

  const rows = storage.sql.exec<{ value: string }>(
    "SELECT value FROM room_state WHERE key = ? LIMIT 1",
    "current_round",
  ).toArray();

  if (!rows[0]?.value) {
    return;
  }

  try {
    const parsed = JSON.parse(rows[0].value) as Record<string, unknown>;
    const round = parsed as unknown as PersistedRoundState;
    const nextChoices: PersistedRoundState["choices"] = {};
    const rawChoices =
      parsed.choices && typeof parsed.choices === "object"
        ? (parsed.choices as Record<string, PersistedRoundState["choices"][keyof PersistedRoundState["choices"]]>)
        : {};

    for (const [key, value] of Object.entries(rawChoices)) {
      const mappedKey =
        key === "u1" || key === "u2" ? LEGACY_USER_ID_MAP[key] : key;

      nextChoices[mappedKey as keyof typeof nextChoices] = value;
    }

    const legacyWinnerId = typeof parsed.winnerId === "string" ? parsed.winnerId : null;
    const nextRound: PersistedRoundState = {
      ...round,
      choices: nextChoices,
      summary:
        typeof parsed.summary === "string"
          ? parsed.summary.replaceAll("u1", LEGACY_USER_ID_MAP.u1).replaceAll("u2", LEGACY_USER_ID_MAP.u2)
          : round.summary,
      winnerId:
        legacyWinnerId === "u1" || legacyWinnerId === "u2"
          ? LEGACY_USER_ID_MAP[legacyWinnerId]
          : round.winnerId,
    };

    storage.sql.exec(
      "UPDATE room_state SET value = ?, updated_at = ? WHERE key = ?",
      JSON.stringify(nextRound),
      nowIso(),
      "current_round",
    );
  } catch {
    // Ignore malformed historical room state and leave current seed to recover.
  }
}

function rebalanceDefaultShopItems(storage: RoomStorage): void {
  const timestamp = nowIso();

  for (const item of SHOP_ITEM_SEEDS) {
    storage.sql.exec(
      `
        UPDATE shop_items
        SET cost = ?, updated_at = ?
        WHERE id = ?
      `,
      item.cost,
      timestamp,
      item.id,
    );
  }
}

export function applyMigrations(storage: RoomStorage): number {
  storage.sql.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);

  for (const statement of SCHEMA_STATEMENTS) {
    storage.sql.exec(statement);
  }

  storage.transactionSync(() => {
    if (!hasColumn(storage, "shop_items", "price_hint")) {
      storage.sql.exec("ALTER TABLE shop_items ADD COLUMN price_hint TEXT NOT NULL DEFAULT ''");
    }

    if (!hasColumn(storage, "game_rounds", "detail_json")) {
      storage.sql.exec("ALTER TABLE game_rounds ADD COLUMN detail_json TEXT NOT NULL DEFAULT '[]'");
    }

    migrateFixedUsers(storage);
    rebalanceDefaultShopItems(storage);

    storage.sql.exec(
      "INSERT OR REPLACE INTO schema_migrations (version, applied_at) VALUES (?, ?)",
      SCHEMA_VERSION,
      nowIso(),
    );
  });

  return Math.max(getCurrentSchemaVersion(storage), SCHEMA_VERSION);
}
