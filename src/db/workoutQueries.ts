import { getDatabase } from "./database";
import type { ActiveSet, Exercise, GhostSet } from "../types/workout";

export async function createWorkout(): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    "INSERT INTO workouts (name, started_at) VALUES ('Workout', unixepoch())"
  );
  return result.lastInsertRowId;
}

export async function finalizeWorkout(workoutId: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE workouts
     SET finished_at = unixepoch(),
         duration_seconds = unixepoch() - started_at
     WHERE id = ?`,
    [workoutId]
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

export async function searchExercises(query: string): Promise<Exercise[]> {
  const db = await getDatabase();
  if (query.trim() === "") {
    return db.getAllAsync<Exercise>(
      "SELECT * FROM exercises ORDER BY use_count DESC, name ASC LIMIT 30"
    );
  }
  return db.getAllAsync<Exercise>(
    `SELECT e.* FROM exercises e
     JOIN exercises_fts fts ON e.id = fts.rowid
     WHERE exercises_fts MATCH ?
     ORDER BY e.use_count DESC
     LIMIT 20`,
    [`${query.trim()}*`]
  );
}
