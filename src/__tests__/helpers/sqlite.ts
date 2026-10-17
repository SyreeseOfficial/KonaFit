import Database from "better-sqlite3";

/** Thin adapter exposing the slice of the expo-sqlite async API the app uses, backed by in-memory better-sqlite3. */
export function createAdapter() {
  const db = new Database(":memory:");
  return {
    raw: db,
    async execAsync(sql: string) {
      db.exec(sql);
    },
    async runAsync(sql: string, params: unknown[] = []) {
      const r = db.prepare(sql).run(...params);
      return { lastInsertRowId: Number(r.lastInsertRowid), changes: r.changes };
    },
    async getAllAsync<T>(sql: string, params: unknown[] = []): Promise<T[]> {
      return db.prepare(sql).all(...params) as T[];
    },
    async getFirstAsync<T>(sql: string, params: unknown[] = []): Promise<T | null> {
      return (db.prepare(sql).get(...params) as T | undefined) ?? null;
    },
    async withTransactionAsync(fn: () => Promise<void>) {
      db.exec("BEGIN");
      try {
        await fn();
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
  };
}

export type TestDb = ReturnType<typeof createAdapter>;

/**
 * Fresh module registry whose `expo-sqlite` opens `adapter`, so the real app code (migrations, seeding, queries)
 * runs against in-memory SQLite. Call `init()` to run `initializeDatabase()`.
 */
export async function setupDb(adapter: TestDb = createAdapter()) {
  jest.resetModules();
  jest.doMock("expo-sqlite", () => ({ openDatabaseAsync: async () => adapter }));
  const database = await import("../../db/database");
  return { adapter, database, init: () => database.initializeDatabase() };
}
