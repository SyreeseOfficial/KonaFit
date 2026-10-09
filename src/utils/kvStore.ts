import { getDatabase } from "../db/database";

// SQLite-backed key-value store — drop-in replacement for AsyncStorage.
// Uses the kv_store table created in database.ts init.
// Read-through cache: every write goes through here, so it stays in sync.
// Call clearCache() after anything that edits kv_store with raw SQL (e.g. Wipe All Data).

const cache = new Map<string, string | null>();

export const kvStore = {
  async getItem(key: string): Promise<string | null> {
    if (cache.has(key)) return cache.get(key)!;
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM kv_store WHERE key = ?",
      [key]
    );
    const value = row?.value ?? null;
    cache.set(key, value);
    return value;
  },

  async setItem(key: string, value: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      "INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)",
      [key, value]
    );
    cache.set(key, value);
  },

  async removeItem(key: string): Promise<void> {
    const db = await getDatabase();
    await db.runAsync("DELETE FROM kv_store WHERE key = ?", [key]);
    cache.set(key, null);
  },

  clearCache(): void {
    cache.clear();
  },
};
