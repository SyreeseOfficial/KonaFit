import { getDatabase } from "./database";
import { kvStore } from "../utils/kvStore";

/** Delete all user data in one transaction (all or nothing). kv_store keys in `keepKeys` (settings) survive. */
export async function wipeAllData(keepKeys: string[]): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.execAsync(`
      DELETE FROM logged_sets;
      DELETE FROM logged_exercises;
      DELETE FROM progress_photos;
      DELETE FROM workouts;
      DELETE FROM program_exercises;
      DELETE FROM program_days;
      DELETE FROM programs;
      DELETE FROM bodyweight_logs;
      DELETE FROM lifestyle_logs;
      DELETE FROM locations;
      DELETE FROM goals;
      DELETE FROM exercises WHERE is_custom = 1;
      UPDATE exercises SET use_count = 0;
    `);
    await db.runAsync(
      `DELETE FROM kv_store WHERE key NOT IN (${keepKeys.map(() => "?").join(",")})`,
      keepKeys
    );
  });
  kvStore.clearCache(); // the raw DELETE bypassed kvStore, so its read-through cache would still serve wiped values
}
