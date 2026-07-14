import { getDatabase } from "./database";
import type { ActiveSet, Exercise, GhostSet } from "../types/workout";

export async function createWorkout(programDayId?: number): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    "INSERT INTO workouts (name, started_at, program_day_id) VALUES ('Workout', unixepoch(), ?)",
    [programDayId ?? null]
  );
  return result.lastInsertRowId;
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
}

export async function deleteWorkout(workoutId: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM workouts WHERE id = ?", [workoutId]);
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

  if (set.dbId) {
    await db.runAsync(
      `UPDATE logged_sets
       SET weight_lbs = ?, reps = ?, rpe = ?, is_warmup = ?, is_completed = ?
       WHERE id = ?`,
      [weight, reps, rpe, set.isWarmup ? 1 : 0, set.isCompleted ? 1 : 0, set.dbId]
    );
  } else {
    await db.runAsync(
      `INSERT INTO logged_sets (logged_exercise_id, set_number, weight_lbs, reps, rpe, is_warmup, is_completed)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [set.loggedExerciseId, set.setNumber, weight, reps, rpe, set.isWarmup ? 1 : 0, set.isCompleted ? 1 : 0]
    );
  }
}

export async function updateLoggedExerciseOrder(
  loggedExerciseId: number,
  orderIndex: number
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE logged_exercises SET order_index = ? WHERE id = ?",
    [orderIndex, loggedExerciseId]
  );
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
  try {
    await db.runAsync(
      "INSERT INTO exercises_fts (rowid, name) VALUES (?, ?)",
      [result.lastInsertRowId, name.trim()]
    );
  } catch { /* FTS optional */ }
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

export async function searchExercises(
  query: string,
  muscleGroup?: string,
  equipment?: string
): Promise<Exercise[]> {
  const db = await getDatabase();
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (query.trim()) {
    conditions.push("LOWER(name) LIKE '%' || LOWER(?) || '%'");
    params.push(query.trim());
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
  return db.getAllAsync<Exercise>(
    `SELECT * FROM exercises ${where} ORDER BY use_count DESC, name ASC`,
    params
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
