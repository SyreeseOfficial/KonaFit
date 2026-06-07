import { getDatabase } from "../db/database";

// SQLite-backed key-value store — drop-in replacement for AsyncStorage.
// Uses the kv_store table created in database.ts init.

export const kvStore = {
  async getItem(key: string): Promise<string | null> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM kv_store WHERE key = ?",
      [key]
    );
    return row?.value ?? null;
  },

  async setItem(key: string, value: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      "INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)",
      [key, value]
    );
  },

  async removeItem(key: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync("DELETE FROM kv_store WHERE key = ?", [key]);
  },
};
