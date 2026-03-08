import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { RoomStorage, SqlRows } from "./types";

type BetterSqlite3Database = InstanceType<typeof Database>;

class StaticSqlRows<T> implements SqlRows<T> {
  constructor(private readonly rows: T[]) {}

  toArray(): T[] {
    return [...this.rows];
  }
}

export class SqliteStorage implements RoomStorage {
  constructor(private readonly db: BetterSqlite3Database) {}

  readonly sql = {
    exec: <T = unknown>(query: string, ...params: unknown[]): SqlRows<T> => {
      const statement = this.db.prepare(query);

      if (statement.reader) {
        return new StaticSqlRows(statement.all(...params) as T[]);
      }

      statement.run(...params);
      return new StaticSqlRows<T>([]);
    },
  };

  transactionSync<T>(callback: () => T): T {
    return this.db.transaction(callback)();
  }
}

export interface OpenSqliteStorageResult {
  close(): void;
  db: BetterSqlite3Database;
  storage: SqliteStorage;
}

export function openSqliteStorage(filePath: string): OpenSqliteStorageResult {
  mkdirSync(dirname(filePath), { recursive: true });

  const db = new Database(filePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");

  return {
    close: () => db.close(),
    db,
    storage: new SqliteStorage(db),
  };
}
