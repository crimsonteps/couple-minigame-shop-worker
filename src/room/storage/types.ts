export interface SqlRows<T = unknown> {
  toArray(): T[];
}

export interface RoomStorage {
  sql: {
    exec<T = unknown>(query: string, ...params: unknown[]): SqlRows<T>;
  };
  transactionSync<T>(callback: () => T): T;
}
