import { getDatabase } from "./database";
import type { ActiveSet, Exercise, GhostSet } from "../types/workout";

export async function createWorkout(programDayId?: number): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    `INSERT INTO workouts (name, started_at, program_day_id)
     VALUES (COALESCE((SELECT name FROM program_days WHERE id = ?), 'Workout'), unixepoch(), ?)`,
    [programDayId ?? null, programDayId ?? null]
  );
  return result.lastInsertRowId;
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

export async function finalizeWorkout(workoutId: number, location?: string): Promise<void> {
  const db = await getDatabase();
  // Auto-complete any set with weight+reps filled in — covers users who don't tap ✓
  await db.runAsync(
    `UPDATE logged_sets SET is_completed = 1
     WHERE is_completed = 0
       AND weight_lbs IS NOT NULL AND reps IS NOT NULL AND reps > 0
       AND logged_exercise_id IN (
         SELECT id FROM logged_exercises WHERE workout_id = ?
       )`,
    [workoutId]
  );
  await db.runAsync(
    `UPDATE workouts
     SET finished_at = unixepoch(),
         duration_seconds = unixepoch() - started_at,
         location = COALESCE(?, location)
     WHERE id = ?`,
    [location ?? null, workoutId]
  );
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
  const weight = set.weightLbs === "" ? null : parseFloat(set.weightLbs);
  const reps = set.reps === "" ? null : parseInt(set.reps, 10);
  const rpe = set.rpe === "" ? null : parseFloat(set.rpe);
  const notes = set.notes?.trim() ? set.notes.trim() : null;

  if (set.dbId) {
    await db.runAsync(
      `UPDATE logged_sets
       SET weight_lbs = ?, reps = ?, rpe = ?, notes = ?, is_warmup = ?, is_completed = ?
       WHERE id = ?`,
      [weight, reps, rpe, notes, set.isWarmup ? 1 : 0, set.isCompleted ? 1 : 0, set.dbId]
    );
  } else {
    await db.runAsync(
      `INSERT INTO logged_sets (logged_exercise_id, set_number, weight_lbs, reps, rpe, notes, is_warmup, is_completed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [set.loggedExerciseId, set.setNumber, weight, reps, rpe, notes, set.isWarmup ? 1 : 0, set.isCompleted ? 1 : 0]
    );
  }
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

  const rows = await db.getAllAsync<{ set_number: number; weight_lbs: number | null; reps: number | null }>(
    `SELECT ls.set_number, ls.weight_lbs, ls.reps
     FROM logged_sets ls
     JOIN logged_exercises le ON ls.logged_exercise_id = le.id
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
  }));
}

export async function createCustomExercise(
  name: string,
  muscleGroups: string[],
  equipmentTypes: string[],
  targetType: string
): Promise<Exercise> {
  const db = await getDatabase();
  const muscle_group = muscleGroups.join(", ");
  const equipment_type = equipmentTypes.join(", ");
  const result = await db.runAsync(
    "INSERT INTO exercises (name, muscle_group, equipment_type, target_type, is_custom) VALUES (?, ?, ?, ?, 1)",
    [name.trim(), muscle_group, equipment_type, targetType]
  );
  return {
    id: result.lastInsertRowId,
    name: name.trim(),
    muscle_group,
    equipment_type,
    target_type: targetType,
    use_count: 0,
    is_custom: 1,
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
  // Name starting with the first word ranks first, then most used.
  const rank = tokens.length > 0 ? "(LOWER(name) LIKE ?) DESC, " : "";
  return db.getAllAsync<Exercise>(
    `SELECT * FROM exercises ${where} ORDER BY ${rank}use_count DESC, name ASC`,
    tokens.length > 0 ? [...params, `${tokens[0]}%`] : params
  );
}

export async function getCustomExercises(): Promise<Exercise[]> {
  const db = await getDatabase();
  return db.getAllAsync<Exercise>(
    "SELECT * FROM exercises WHERE is_custom = 1 AND is_deleted = 0 ORDER BY name ASC"
  );
}

export async function updateExercise(
  id: number,
  patch: { name?: string; muscleGroup?: string; equipmentType?: string; targetType?: string }
): Promise<void> {
  const db = await getDatabase();
  const sets: string[] = [];
  const args: (string | number)[] = [];
  if (patch.name !== undefined) { sets.push("name = ?"); args.push(patch.name.trim()); }
  if (patch.muscleGroup !== undefined) { sets.push("muscle_group = ?"); args.push(patch.muscleGroup.trim()); }
  if (patch.equipmentType !== undefined) { sets.push("equipment_type = ?"); args.push(patch.equipmentType.trim()); }
  if (patch.targetType !== undefined) { sets.push("target_type = ?"); args.push(patch.targetType.trim()); }
  if (sets.length === 0) return;
  args.push(id);
  await db.runAsync(`UPDATE exercises SET ${sets.join(", ")} WHERE id = ?`, args);
}

export async function deleteExercise(id: number): Promise<void> {
  const db = await getDatabase();
  // ponytail: soft-delete keeps FK refs in logged_exercises intact
  await db.runAsync("UPDATE exercises SET is_deleted = 1 WHERE id = ?", [id]);
}

export async function getExerciseLibraryNote(exerciseId: number): Promise<string> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ notes: string | null }>(
    "SELECT notes FROM exercises WHERE id = ?",
    [exerciseId]
  );
  return row?.notes ?? "";
}

export async function updateExerciseLibraryNote(exerciseId: number, notes: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("UPDATE exercises SET notes = ? WHERE id = ?", [notes, exerciseId]);
}
