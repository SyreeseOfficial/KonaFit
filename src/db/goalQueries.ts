import { getDatabase } from "./database";
import { setLoadSql } from "./sqlFragments";

export type GoalType = "lift_pr" | "bodyweight" | "custom";

export type Goal = {
  id: number;
  type: GoalType;
  title: string;
  exercise_id: number | null;
  exercise_name: string | null;
  target_value: number | null;
  target_reps: number | null;
  notes: string | null;
  is_achieved: number; // 0 | 1
  created_at: number;
  achieved_at: number | null;
};

export async function getGoals(): Promise<Goal[]> {
  const db = await getDatabase();
  return db.getAllAsync<Goal>(
    `SELECT * FROM goals ORDER BY is_achieved ASC, created_at DESC`
  );
}

export async function createGoal(data: {
  type: GoalType;
  title: string;
  exerciseId?: number | null;
  exerciseName?: string | null;
  targetValue?: number | null;
  targetReps?: number | null;
  notes?: string | null;
}): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    `INSERT INTO goals (type, title, exercise_id, exercise_name, target_value, target_reps, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [data.type, data.title.trim(), data.exerciseId ?? null, data.exerciseName ?? null,
     data.targetValue ?? null, data.targetReps ?? null, data.notes?.trim() ?? null]
  );
  return result.lastInsertRowId;
}

export async function markGoalAchieved(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE goals SET is_achieved = 1, achieved_at = unixepoch() WHERE id = ?",
    [id]
  );
}

export async function unmarkGoalAchieved(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE goals SET is_achieved = 0, achieved_at = NULL WHERE id = ?",
    [id]
  );
}

export async function deleteGoal(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM goals WHERE id = ?", [id]);
}

// Current progress for lift PR goals.
// If target_reps is set: returns best actual reps logged at or above target weight.
// Otherwise: returns best estimated 1RM (Epley formula).
export async function getGoalProgress(goal: Goal): Promise<number | null> {
  const db = await getDatabase();
  if (goal.type === "lift_pr" && goal.exercise_id) {
    if (goal.target_reps != null && goal.target_value != null) {
      const row = await db.getFirstAsync<{ best_reps: number }>(
        `SELECT MAX(ls.reps) AS best_reps
         FROM logged_sets ls
         JOIN logged_exercises le ON ls.logged_exercise_id = le.id
         JOIN workouts w ON le.workout_id = w.id
         WHERE le.exercise_id = ? AND ls.is_completed = 1 AND ls.is_warmup = 0
           AND ls.weight_lbs >= ? AND ls.reps IS NOT NULL
           AND w.finished_at IS NOT NULL`,
        [goal.exercise_id, goal.target_value]
      );
      return row?.best_reps ?? null;
    }
    const row = await db.getFirstAsync<{ one_rm: number }>(
      `SELECT MAX(${setLoadSql()} * (1.0 + ls.reps / 30.0)) AS one_rm
       FROM logged_sets ls
       JOIN logged_exercises le ON ls.logged_exercise_id = le.id
       JOIN workouts w ON le.workout_id = w.id
       WHERE le.exercise_id = ? AND ls.is_completed = 1 AND ls.is_warmup = 0
         AND ls.weight_lbs IS NOT NULL AND ls.reps IS NOT NULL AND ls.reps > 0
         AND w.finished_at IS NOT NULL`,
      [goal.exercise_id]
    );
    return row?.one_rm ?? null;
  }
  if (goal.type === "bodyweight") {
    const row = await db.getFirstAsync<{ weight_lbs: number }>(
      "SELECT weight_lbs FROM bodyweight_logs ORDER BY logged_at DESC, id DESC LIMIT 1"
    );
    return row?.weight_lbs ?? null;
  }
  return null;
}
