import { getDatabase } from "./database";
import type { ActiveSet, Exercise, GhostSet } from "../types/workout";
import { isBodyweightSql } from "./sqlFragments";
import { fuzzyMatches } from "../utils/fuzzy";

export async function createWorkout(programDayId?: number, appVersion?: string): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    `INSERT INTO workouts (name, started_at, created_at, app_version, program_day_id)
     VALUES (COALESCE((SELECT name FROM program_days WHERE id = ?), 'Workout'), unixepoch(), unixepoch(), ?, ?)`,
    [programDayId ?? null, appVersion ?? null, programDayId ?? null]
  );
  await logSessionEvent(result.lastInsertRowId, "start");
  return result.lastInsertRowId;
}

export type SessionEventType = "start" | "pause" | "resume" | "finish";

export async function logSessionEvent(workoutId: number, type: SessionEventType): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("INSERT INTO session_events (workout_id, type) VALUES (?, ?)", [workoutId, type]);
}

/** "Chest + Triceps · Thu" from each exercise's primary muscle group (top two by count), else "Thursday Workout". */
export function autoWorkoutName(muscleGroups: string[], startedAtSecs: number): string {
  const counts = new Map<string, number>();
  for (const g of muscleGroups) {
    const primary = g.split(",")[0].trim();
    if (primary) counts.set(primary, (counts.get(primary) ?? 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([g]) => g);
  const day = new Date(startedAtSecs * 1000);
  return top.length > 0
    ? `${top.join(" + ")} · ${day.toLocaleDateString(undefined, { weekday: "short" })}`
    : `${day.toLocaleDateString(undefined, { weekday: "long" })} Workout`;
}

/** After the last ticked set the lifter is assumed to rest this long before stopping the workout. */
const END_PAD_SECS = 120;

/**
 * Stamps the finish. Only ticked sets count (nothing is auto-completed). The end time is the last ticked set + 2 min
 * (capped at now), so leaving the app open over lunch doesn't inflate the duration; it's editable on the workout screen.
 */
export type WorkoutFeel = { rating?: number | null; energy?: number | null; sleepHours?: number | null };

export async function finalizeWorkout(workoutId: number, location?: string, feel: WorkoutFeel = {}): Promise<void> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ started_at: number; last_set: number | null }>(
    `SELECT w.started_at,
            (SELECT MAX(ls.completed_at) FROM logged_sets ls
               JOIN logged_exercises le ON le.id = ls.logged_exercise_id
              WHERE le.workout_id = w.id AND ls.is_completed = 1) AS last_set
     FROM workouts w WHERE w.id = ?`,
    [workoutId]
  );
  if (!row) throw new Error(`Workout ${workoutId} not found`);
  const now = Math.floor(Date.now() / 1000);
  const end = Math.max(row.started_at, row.last_set != null ? Math.min(now, row.last_set + END_PAD_SECS) : now);
  await db.runAsync(
    `UPDATE workouts
     SET finished_at = ?,
         duration_seconds = ? - started_at,
         location = COALESCE(?, location),
         rating = COALESCE(?, rating),
         energy = COALESCE(?, energy),
         sleep_hours = COALESCE(?, sleep_hours)
     WHERE id = ?`,
    [end, end, location ?? null, feel.rating ?? null, feel.energy ?? null, feel.sleepHours ?? null, workoutId]
  );
  await logSessionEvent(workoutId, "finish");
  // Still the default name (not launched from a program day, not renamed): describe what was trained.
  const w = await db.getFirstAsync<{ name: string; started_at: number }>(
    "SELECT name, started_at FROM workouts WHERE id = ?", [workoutId]
  );
  if (w?.name === "Workout") {
    const groups = await db.getAllAsync<{ mg: string }>(
      `SELECT e.muscle_group AS mg FROM logged_exercises le
       JOIN exercises e ON e.id = le.exercise_id
       WHERE le.workout_id = ? ORDER BY le.order_index`,
      [workoutId]
    );
    await db.runAsync("UPDATE workouts SET name = ? WHERE id = ?", [
      autoWorkoutName(groups.map((g) => g.mg), w.started_at),
      workoutId,
    ]);
  }
}

export async function deleteWorkout(workoutId: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM workouts WHERE id = ?", [workoutId]);
}

/** Drop unfinished workouts except `keepId` (the one a saved session can still resume): leftovers from crashes or failed starts. */
export async function deleteUnfinishedWorkouts(keepId: number | null): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM workouts WHERE finished_at IS NULL AND id IS NOT ?", [keepId]);
}

export async function workoutExists(workoutId: number): Promise<boolean> {
  const db = await getDatabase();
  return (await db.getFirstAsync("SELECT 1 FROM workouts WHERE id = ?", [workoutId])) != null;
}

export async function createLoggedExercise(
  workoutId: number,
  exerciseId: number,
  exerciseName: string,
  orderIndex: number
): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    `INSERT INTO logged_exercises (workout_id, exercise_id, exercise_name, order_index)
     VALUES (?, ?, ?, ?)`,
    [workoutId, exerciseId, exerciseName, orderIndex]
  );
  await db.runAsync(
    "UPDATE exercises SET use_count = use_count + 1 WHERE id = ?",
    [exerciseId]
  );
  return result.lastInsertRowId;
}

/** Persist which exercises are grouped as a superset (so "Repeat last workout" can restore the grouping). */
export async function setLoggedExerciseSuperset(loggedExerciseIds: number[], supersetId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE logged_exercises SET superset_id = ? WHERE id IN (${loggedExerciseIds.map(() => "?").join(",")})`,
    [supersetId, ...loggedExerciseIds]
  );
}

export async function updateLoggedExerciseNotes(
  loggedExerciseId: number,
  notes: string
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE logged_exercises SET notes = ? WHERE id = ?",
    [notes, loggedExerciseId]
  );
}

export async function createLoggedSet(
  loggedExerciseId: number,
  setNumber: number
): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    `INSERT INTO logged_sets (logged_exercise_id, set_number) VALUES (?, ?)`,
    [loggedExerciseId, setNumber]
  );
  return result.lastInsertRowId;
}

export async function upsertLoggedSet(set: ActiveSet & { loggedExerciseId: number }): Promise<void> {
  const db = await getDatabase();
  const parsed = parseFloat(set.weightLbs); // "" and a lone "-" give NaN
  const weight = Number.isFinite(parsed) ? parsed : null;
  // A blank weight on a bodyweight exercise means "no added load", stored as 0 so the set counts.
  const blankWeight = `COALESCE(?, (SELECT 0 FROM logged_exercises le WHERE le.id = ? AND ${isBodyweightSql()}))`;
  const reps = set.reps === "" ? null : parseInt(set.reps, 10);
  const rpe = set.rpe === "" ? null : parseFloat(set.rpe);
  const notes = set.notes?.trim() ? set.notes.trim() : null;

  if (set.dbId) {
    await db.runAsync(
      `UPDATE logged_sets
       SET weight_lbs = ${blankWeight}, reps = ?, rpe = ?, notes = ?, is_warmup = ?, is_completed = ?,
           set_number = ?, set_type = ?,
           completed_at = CASE WHEN ? = 1 THEN COALESCE(completed_at, unixepoch()) END,
           rest_seconds = CASE WHEN ? = 1 THEN rest_seconds END
       WHERE id = ?`,
      [weight, set.loggedExerciseId, reps, rpe, notes, set.isWarmup ? 1 : 0, set.isCompleted ? 1 : 0, set.setNumber, set.setType ?? null, set.isCompleted ? 1 : 0, set.isCompleted ? 1 : 0, set.dbId]
    );
    if (set.isCompleted) await stampRest(set.dbId);
  } else {
    const result = await db.runAsync(
      `INSERT INTO logged_sets (logged_exercise_id, set_number, weight_lbs, reps, rpe, notes, is_warmup, is_completed, set_type, completed_at)
       VALUES (?, ?, ${blankWeight}, ?, ?, ?, ?, ?, ?, CASE WHEN ? = 1 THEN unixepoch() END)`,
      [set.loggedExerciseId, set.setNumber, weight, set.loggedExerciseId, reps, rpe, notes, set.isWarmup ? 1 : 0, set.isCompleted ? 1 : 0, set.setType ?? null, set.isCompleted ? 1 : 0]
    );
    if (set.isCompleted) await stampRest(result.lastInsertRowId);
  }
}

/** Gaps longer than this are a break (lunch, phone call), not rest between sets. */
const MAX_REST_SECS = 1800;

/** Rest before a just-ticked set = time since the previous ticked set of the same workout. Set once, when first ticked. */
async function stampRest(setId: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE logged_sets SET rest_seconds = (
       SELECT CASE WHEN logged_sets.completed_at - MAX(p.completed_at) BETWEEN 0 AND ${MAX_REST_SECS}
                   THEN logged_sets.completed_at - MAX(p.completed_at) END
       FROM logged_sets p JOIN logged_exercises pe ON pe.id = p.logged_exercise_id
       WHERE pe.workout_id = (SELECT workout_id FROM logged_exercises WHERE id = logged_sets.logged_exercise_id)
         AND p.id != logged_sets.id AND p.completed_at <= logged_sets.completed_at
     )
     WHERE id = ? AND completed_at IS NOT NULL AND rest_seconds IS NULL`,
    [setId]
  );
}

/** Persist the full exercise order (position in `ids` becomes order_index) in one transaction. */
export async function setLoggedExerciseOrder(ids: number[]): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    for (let i = 0; i < ids.length; i++) {
      await db.runAsync("UPDATE logged_exercises SET order_index = ? WHERE id = ?", [i, ids[i]]);
    }
  });
}

/** Removes the exercise and (via cascade) its sets, and undoes the use_count bump from adding it. */
export async function deleteLoggedExercise(loggedExerciseId: number): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE exercises SET use_count = MAX(0, use_count - 1)
       WHERE id = (SELECT exercise_id FROM logged_exercises WHERE id = ?)`,
      [loggedExerciseId]
    );
    await db.runAsync("DELETE FROM logged_exercises WHERE id = ?", [loggedExerciseId]);
  });
}

export async function swapLoggedExercise(
  loggedExerciseId: number,
  newExerciseId: number,
  newExerciseName: string
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE logged_exercises SET exercise_id = ?, exercise_name = ? WHERE id = ?",
    [newExerciseId, newExerciseName, loggedExerciseId]
  );
  await db.runAsync(
    "UPDATE exercises SET use_count = use_count + 1 WHERE id = ?",
    [newExerciseId]
  );
}

export async function deleteLoggedSet(setDbId: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM logged_sets WHERE id = ?", [setDbId]);
}

export async function getGhostSets(
  exerciseId: number,
  currentWorkoutId: number
): Promise<GhostSet[]> {
  const db = await getDatabase();
  // Find the most recent completed workout that had this exercise (excluding current)
  const lastWorkout = await db.getFirstAsync<{ workout_id: number }>(
    `SELECT le.workout_id
     FROM logged_exercises le
     JOIN workouts w ON le.workout_id = w.id
     WHERE le.exercise_id = ?
       AND le.workout_id != ?
       AND w.finished_at IS NOT NULL
     ORDER BY w.started_at DESC
     LIMIT 1`,
    [exerciseId, currentWorkoutId]
  );
  if (!lastWorkout) return [];

  const rows = await db.getAllAsync<{ set_number: number; weight_lbs: number | null; reps: number | null; rpe: number | null; at: number }>(
    `SELECT ls.set_number, ls.weight_lbs, ls.reps, ls.rpe, w.started_at AS at
     FROM logged_sets ls
     JOIN logged_exercises le ON ls.logged_exercise_id = le.id
     JOIN workouts w ON w.id = le.workout_id
     WHERE le.exercise_id = ?
       AND le.workout_id = ?
       AND ls.is_warmup = 0
       AND ls.is_completed = 1
     ORDER BY ls.set_number ASC`,
    [exerciseId, lastWorkout.workout_id]
  );

  return rows.map((r) => ({
    setNumber: r.set_number,
    weightLbs: r.weight_lbs,
    reps: r.reps,
    rpe: r.rpe,
    at: r.at,
  }));
}

/** "Chest, ,triceps,Chest" -> "Chest, triceps": trimmed, no empty entries, no repeats. */
export function cleanCommaList(list: string | string[]): string {
  const items = (Array.isArray(list) ? list : list.split(",")).map((x) => x.trim()).filter(Boolean);
  return items.filter((x, i) => items.findIndex((y) => y.toLowerCase() === x.toLowerCase()) === i).join(", ");
}

async function assertNameFree(name: string, exceptId = -1): Promise<void> {
  const db = await getDatabase();
  const clash = await db.getFirstAsync(
    "SELECT 1 FROM exercises WHERE LOWER(name) = LOWER(?) AND is_deleted = 0 AND id != ?",
    [name.trim(), exceptId]
  );
  if (clash) throw new Error(`An exercise named "${name.trim()}" already exists.`);
}

export async function createCustomExercise(
  name: string,
  muscleGroups: string[],
  equipmentTypes: string[],
  targetType: string,
  perHand = false
): Promise<Exercise> {
  const db = await getDatabase();
  await assertNameFree(name);
  const muscle_group = cleanCommaList(muscleGroups);
  const equipment_type = cleanCommaList(equipmentTypes);
  const result = await db.runAsync(
    "INSERT INTO exercises (name, muscle_group, equipment_type, target_type, per_hand, is_custom) VALUES (?, ?, ?, ?, ?, 1)",
    [name.trim(), muscle_group, equipment_type, targetType, perHand ? 1 : 0]
  );
  return {
    id: result.lastInsertRowId,
    name: name.trim(),
    muscle_group,
    equipment_type,
    target_type: targetType,
    use_count: 0,
    is_custom: 1,
    per_hand: perHand ? 1 : 0,
  };
}

const SEARCH_ALIASES: Record<string, string> = {
  db: "dumbbell", dbs: "dumbbell", bb: "barbell", kb: "kettlebell", rdl: "romanian deadlift", ohp: "overhead press",
};

export async function searchExercises(
  query: string,
  muscleGroup?: string,
  equipment?: string
): Promise<Exercise[]> {
  const db = await getDatabase();
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  // Every word must match name or equipment, in any order; abbreviations expand ("db press" finds dumbbell presses).
  const tokens = query.toLowerCase().replace(/[%_]/g, "").split(/\s+/).filter(Boolean);
  for (const t of tokens) {
    const terms = [t, ...(SEARCH_ALIASES[t] ? [SEARCH_ALIASES[t]] : [])];
    conditions.push(`(${terms.map(() => "LOWER(name || ' ' || equipment_type) LIKE ?").join(" OR ")})`);
    params.push(...terms.map((x) => `%${x}%`));
  }
  if (muscleGroup) {
    conditions.push("LOWER(muscle_group) LIKE '%' || LOWER(?) || '%'");
    params.push(muscleGroup);
  }
  if (equipment) {
    conditions.push("LOWER(equipment_type) LIKE '%' || LOWER(?) || '%'");
    params.push(equipment);
  }

  conditions.push("is_deleted = 0");
  const where = `WHERE ${conditions.join(" AND ")}`;
  // With a query: name starting with the first word, then most used. Without: most recently trained first, then most used.
  const rank = tokens.length > 0
    ? "(LOWER(name) LIKE ?) DESC, "
    : "(SELECT MAX(w.started_at) FROM logged_exercises le JOIN workouts w ON w.id = le.workout_id WHERE le.exercise_id = exercises.id) DESC, ";
  const rows = await db.getAllAsync<Exercise>(
    `SELECT * FROM exercises ${where} ORDER BY ${rank}use_count DESC, name ASC`,
    tokens.length > 0 ? [...params, `${tokens[0]}%`] : params
  );
  if (rows.length > 0 || tokens.length === 0) return rows;

  // Nothing matched literally: retry forgiving typos ("benhc pres") over the same filters.
  const filterOnly = conditions.filter((_, i) => i >= tokens.length);
  const filterParams = params.slice(params.length - filterOnly.filter((c) => c.includes("?")).length);
  const all = await db.getAllAsync<Exercise>(
    `SELECT * FROM exercises WHERE ${filterOnly.join(" AND ")} ORDER BY use_count DESC, name ASC`,
    filterParams
  );
  const expanded = tokens.map((t) => SEARCH_ALIASES[t] ?? t);
  return all.filter((e) => fuzzyMatches(`${e.name} ${e.equipment_type}`, expanded));
}

export async function getCustomExercises(): Promise<Exercise[]> {
  const db = await getDatabase();
  return db.getAllAsync<Exercise>(
    "SELECT * FROM exercises WHERE is_custom = 1 AND is_deleted = 0 ORDER BY name ASC"
  );
}

export async function updateExercise(
  id: number,
  patch: { name?: string; muscleGroup?: string; equipmentType?: string; targetType?: string; perHand?: boolean }
): Promise<void> {
  const db = await getDatabase();
  const sets: string[] = [];
  const args: (string | number)[] = [];
  if (patch.name !== undefined) { await assertNameFree(patch.name, id); sets.push("name = ?"); args.push(patch.name.trim()); }
  if (patch.muscleGroup !== undefined) { sets.push("muscle_group = ?"); args.push(cleanCommaList(patch.muscleGroup)); }
  if (patch.equipmentType !== undefined) { sets.push("equipment_type = ?"); args.push(cleanCommaList(patch.equipmentType)); }
  if (patch.targetType !== undefined) { sets.push("target_type = ?"); args.push(patch.targetType.trim()); }
  if (patch.perHand !== undefined) { sets.push("per_hand = ?"); args.push(patch.perHand ? 1 : 0); }
  if (sets.length === 0) return;
  args.push(id);
  await db.runAsync(`UPDATE exercises SET ${sets.join(", ")} WHERE id = ?`, args);
}

export async function deleteExercise(id: number): Promise<void> {
  const db = await getDatabase();
  // ponytail: soft-delete keeps FK refs in logged_exercises intact
  await db.runAsync("UPDATE exercises SET is_deleted = 1, deleted_at = unixepoch() WHERE id = ?", [id]);
}

export async function getDeletedExercises(): Promise<Exercise[]> {
  const db = await getDatabase();
  return db.getAllAsync<Exercise>("SELECT * FROM exercises WHERE is_deleted = 1 ORDER BY deleted_at DESC, name ASC");
}

/** Bring a deleted exercise back. Throws if a live exercise has taken its name since. */
export async function restoreExercise(id: number): Promise<void> {
  const db = await getDatabase();
  const ex = await db.getFirstAsync<{ name: string }>("SELECT name FROM exercises WHERE id = ?", [id]);
  if (!ex) return;
  await assertNameFree(ex.name, id);
  await db.runAsync("UPDATE exercises SET is_deleted = 0, deleted_at = NULL WHERE id = ?", [id]);
}

const PURGE_AFTER_DAYS = 30;

/** Remove exercises deleted over 30 days ago that no workout or program uses. Anything with history stays (soft-deleted). */
export async function purgeDeletedExercises(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `DELETE FROM exercises
     WHERE is_deleted = 1 AND deleted_at < unixepoch() - ? * 86400
       AND id NOT IN (SELECT exercise_id FROM logged_exercises)
       AND id NOT IN (SELECT exercise_id FROM program_exercises)`,
    [PURGE_AFTER_DAYS]
  );
}

export type ExerciseNote = { text: string; at: number };

/** Notes typed on this exercise in finished workouts, newest first (at = ms). */
export async function getExerciseNotes(exerciseId: number): Promise<ExerciseNote[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ notes: string; started_at: number }>(
    `SELECT le.notes, w.started_at FROM logged_exercises le
     JOIN workouts w ON w.id = le.workout_id
     WHERE le.exercise_id = ? AND w.finished_at IS NOT NULL AND TRIM(COALESCE(le.notes, '')) != ''
     ORDER BY w.started_at DESC, le.id DESC`,
    [exerciseId]
  );
  return rows.map((r) => ({ text: r.notes.trim(), at: r.started_at * 1000 }));
}

/** Library note plus whether the exercise is logged as added load on bodyweight. */
export async function getExerciseInfo(exerciseId: number): Promise<{ note: string; isBodyweight: boolean; perHand: boolean }> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ notes: string | null; equipment_type: string; per_hand: number }>(
    "SELECT notes, equipment_type, per_hand FROM exercises WHERE id = ?",
    [exerciseId]
  );
  return { note: row?.notes ?? "", isBodyweight: /bodyweight/i.test(row?.equipment_type ?? ""), perHand: row?.per_hand === 1 };
}

export async function setExercisePerHand(exerciseId: number, perHand: boolean): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("UPDATE exercises SET per_hand = ? WHERE id = ?", [perHand ? 1 : 0, exerciseId]);
}

/**
 * Fold `fromId` into `intoId`: workout history, program entries and goals move over (and take the kept name), the use count is added,
 * and `fromId` is soft-deleted (restorable from Settings). One transaction, so a failure leaves both exercises as they were.
 */
export async function mergeExercises(fromId: number, intoId: number): Promise<void> {
  if (fromId === intoId) throw new Error("Pick two different exercises.");
  const db = await getDatabase();
  const into = await db.getFirstAsync<{ name: string }>("SELECT name FROM exercises WHERE id = ?", [intoId]);
  if (!into) throw new Error("Exercise not found.");
  await db.withTransactionAsync(async () => {
    for (const table of ["logged_exercises", "program_exercises"]) {
      await db.runAsync(`UPDATE ${table} SET exercise_id = ?, exercise_name = ? WHERE exercise_id = ?`, [intoId, into.name, fromId]);
    }
    await db.runAsync("UPDATE goals SET exercise_id = ?, exercise_name = ? WHERE exercise_id = ?", [intoId, into.name, fromId]);
    await db.runAsync("UPDATE exercises SET use_count = use_count + (SELECT use_count FROM exercises WHERE id = ?) WHERE id = ?", [fromId, intoId]);
    await db.runAsync("UPDATE exercises SET is_deleted = 1, deleted_at = unixepoch(), use_count = 0 WHERE id = ?", [fromId]);
  });
}

export async function updateExerciseLibraryNote(exerciseId: number, notes: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("UPDATE exercises SET notes = ? WHERE id = ?", [notes, exerciseId]);
}
