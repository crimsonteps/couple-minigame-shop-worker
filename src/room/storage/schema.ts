export const SCHEMA_VERSION = 5;

export const SCHEMA_STATEMENTS = [
  `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      score INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS shop_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      cost INTEGER NOT NULL,
      stock INTEGER NOT NULL,
      emoji TEXT NOT NULL,
      price_hint TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS game_rounds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id TEXT NOT NULL,
      game_type TEXT NOT NULL,
      player1_id TEXT NOT NULL,
      player2_id TEXT NOT NULL,
      player1_choice TEXT NOT NULL,
      player2_choice TEXT NOT NULL,
      winner_id TEXT,
      summary TEXT NOT NULL,
      detail_json TEXT NOT NULL DEFAULT '[]',
      player1_score_delta INTEGER NOT NULL,
      player2_score_delta INTEGER NOT NULL,
      played_at TEXT NOT NULL
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS redemptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      item_name TEXT NOT NULL,
      user_id TEXT NOT NULL,
      cost INTEGER NOT NULL,
      created_at TEXT NOT NULL
    )
  `,
  `
    CREATE TABLE IF NOT EXISTS room_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `,
  `
    CREATE INDEX IF NOT EXISTS idx_game_rounds_played_at
    ON game_rounds (played_at DESC)
  `,
  `
    CREATE INDEX IF NOT EXISTS idx_redemptions_created_at
    ON redemptions (created_at DESC)
  `,
];
