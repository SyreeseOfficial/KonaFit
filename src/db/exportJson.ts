import { getDatabase } from "./database";

// Full-detail export. Schema is written down in docs/export-schema.md; bump EXPORT_FORMAT_VERSION when a table is added or renamed.
const EXPORT_FORMAT_VERSION = 2;

const TABLES = [
  "exercises",
  "workouts",
  "logged_exercises",
  "logged_sets",
  "boxing_rounds",
  "boxing_focus_chips",
  "session_events",
  "programs",
  "program_days",
  "program_exercises",
  "goals",
  "bodyweight_logs",
  "readiness_checkins",
  "locations",
  "progress_photos",
] as const;

export async function buildFullExport(appVersion: string): Promise<{
  format: "konafit-export";
  formatVersion: number;
  appVersion: string;
  schemaVersion: number;
  exportedAt: string;
  tables: Record<string, Record<string, unknown>[]>;
}> {
  const db = await getDatabase();
  const v = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
  const tables: Record<string, Record<string, unknown>[]> = {};
  for (const t of TABLES) tables[t] = await db.getAllAsync(`SELECT * FROM ${t} ORDER BY id`);
  return {
    format: "konafit-export",
    formatVersion: EXPORT_FORMAT_VERSION,
    appVersion,
    schemaVersion: v?.user_version ?? 0,
    exportedAt: new Date().toISOString(),
    tables,
  };
}
