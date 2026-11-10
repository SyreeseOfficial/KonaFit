import { getDatabase } from "../db/database";

// SQLite-backed key-value store (the kv_store table created in database.ts init).
const run = async (sql: string, args: string[]) => (await getDatabase()).runAsync(sql, args);

export const kvStore = {
  async getItem(key: string): Promise<string | null> {
    const row = await (await getDatabase()).getFirstAsync<{ value: string }>("SELECT value FROM kv_store WHERE key = ?", [key]);
    return row?.value ?? null;
  },
  setItem: async (key: string, value: string): Promise<void> => void (await run("INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)", [key, value])),
  removeItem: async (key: string): Promise<void> => void (await run("DELETE FROM kv_store WHERE key = ?", [key])),
};
