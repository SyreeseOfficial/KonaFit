import { getDatabase } from "./database";

/** Tables counted in the report (label -> table). */
const COUNTED = {
  Workouts: "workouts",
  Exercises: "logged_exercises",
  Sets: "logged_sets",
  "Boxing rounds": "boxing_rounds",
  Programs: "programs",
  Photos: "progress_photos",
} as const;

/** Rows pointing at a parent that no longer exists. Deleting these can't lose anything the app can still show. */
const ORPHANS = {
  "Exercises with no workout": "FROM logged_exercises WHERE workout_id NOT IN (SELECT id FROM workouts)",
  "Sets with no exercise": "FROM logged_sets WHERE logged_exercise_id NOT IN (SELECT id FROM logged_exercises)",
  "Boxing rounds with no workout": "FROM boxing_rounds WHERE workout_id NOT IN (SELECT id FROM workouts)",
  "Program days with no program": "FROM program_days WHERE program_id NOT IN (SELECT id FROM programs)",
  "Program exercises with no day": "FROM program_exercises WHERE program_day_id NOT IN (SELECT id FROM program_days)",
} as const;

export type DoctorReport = {
  counts: Record<string, number>;
  /** Label -> how many rows (only non-zero). */
  problems: Record<string, number>;
  missingPhotoIds: number[];
};

export const problemTotal = (r: DoctorReport) => Object.values(r.problems).reduce((a, b) => a + b, 0);

const count = async (sql: string, params: (number | null)[] = []) =>
  (await (await getDatabase()).getFirstAsync<{ n: number }>(`SELECT COUNT(*) n ${sql}`, params))?.n ?? 0;

/**
 * Read-only check. `keepWorkoutId` is the unfinished workout a saved session can still resume (not a problem).
 * `photoExists` tells whether a photo file is on disk (kept out of here so tests don't need a file system).
 */
export async function diagnoseDb(keepWorkoutId: number | null, photoExists: (fileName: string) => Promise<boolean>): Promise<DoctorReport> {
  const db = await getDatabase();
  const counts: Record<string, number> = {};
  for (const [label, table] of Object.entries(COUNTED)) counts[label] = await count(`FROM ${table}`);

  const problems: Record<string, number> = {};
  const add = (label: string, n: number) => { if (n > 0) problems[label] = n; };
  for (const [label, from] of Object.entries(ORPHANS)) add(label, await count(from));
  add("Unfinished workouts", await count("FROM workouts WHERE finished_at IS NULL AND id IS NOT ?", [keepWorkoutId]));

  const photos = await db.getAllAsync<{ id: number; photo_uri: string }>("SELECT id, photo_uri FROM progress_photos");
  const missingPhotoIds: number[] = [];
  for (const p of photos) if (!(await photoExists(p.photo_uri))) missingPhotoIds.push(p.id);
  add("Photos with a missing file", missingPhotoIds.length);

  return { counts, problems, missingPhotoIds };
}

/** Deletes only what `diagnoseDb` listed. Finished workouts, sets with data and existing photos are never touched. */
export async function repairDb(keepWorkoutId: number | null, report: DoctorReport): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    // Parents first (exercises before their sets), so a set orphaned by the first delete goes in the same pass.
    for (const from of Object.values(ORPHANS)) await db.runAsync(`DELETE ${from}`);
    await db.runAsync("DELETE FROM workouts WHERE finished_at IS NULL AND id IS NOT ?", [keepWorkoutId]);
    for (const id of report.missingPhotoIds) await db.runAsync("DELETE FROM progress_photos WHERE id = ?", [id]);
  });
}
