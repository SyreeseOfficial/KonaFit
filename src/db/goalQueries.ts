import { getDatabase } from "./database";
import { setLoadSql, oneRmSql, workingSetSql } from "./sqlFragments";

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
  start_value: number | null; // bodyweight goals: weight when the goal was set
  direction: "up" | "down" | null; // bodyweight goals: bulking (up) or cutting (down)
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
  // A bodyweight goal remembers where you started, so progress and cut/bulk direction can be told later.
  let startValue: number | null = null;
  let direction: "up" | "down" | null = null;
  if (data.type === "bodyweight" && data.targetValue != null) {
    const bw = await db.getFirstAsync<{ weight_lbs: number }>(
      "SELECT weight_lbs FROM bodyweight_logs ORDER BY logged_at DESC, id DESC LIMIT 1"
    );
    startValue = bw?.weight_lbs ?? null;
    if (startValue != null) direction = data.targetValue < startValue ? "down" : "up";
  }
  const result = await db.runAsync(
    `INSERT INTO goals (type, title, exercise_id, exercise_name, target_value, target_reps, notes, start_value, direction)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [data.type, data.title.trim(), data.exerciseId ?? null, data.exerciseName ?? null,
     data.targetValue ?? null, data.targetReps ?? null, data.notes?.trim() ?? null, startValue, direction]
  );
  return result.lastInsertRowId;
}

/** Finish time of the first workout since the goal was set whose best set reached a lift goal, else null. */
async function firstWorkoutReaching(goal: Goal): Promise<number | null> {
  if (goal.type !== "lift_pr" || goal.exercise_id == null || goal.target_value == null) return null;
  const db = await getDatabase();
  const reached =
    goal.target_reps != null
      ? "ls.weight_lbs >= ? AND ls.reps >= ?"
      : `${oneRmSql(setLoadSql(), "ls.reps")} >= ? AND ls.reps > 0`;
  const params = goal.target_reps != null ? [goal.target_value, goal.target_reps] : [goal.target_value];
  const row = await db.getFirstAsync<{ t: number | null }>(
    `SELECT MIN(w.finished_at) AS t
     FROM logged_sets ls
     JOIN logged_exercises le ON ls.logged_exercise_id = le.id
     JOIN workouts w ON le.workout_id = w.id
     WHERE le.exercise_id = ? AND ${workingSetSql()} AND w.finished_at IS NOT NULL
       AND w.finished_at >= ? AND ${reached}`,
    [goal.exercise_id, goal.created_at, ...params]
  );
  return row?.t ?? null;
}

/** Marks a goal done, dated to the workout that reached it when we can tell (otherwise now). */
export async function markGoalAchieved(id: number): Promise<void> {
  const db = await getDatabase();
  const goal = await db.getFirstAsync<Goal>("SELECT * FROM goals WHERE id = ?", [id]);
  const at = goal ? await firstWorkoutReaching(goal) : null;
  await db.runAsync(
    "UPDATE goals SET is_achieved = 1, achieved_at = COALESCE(?, unixepoch()) WHERE id = ?",
    [at, id]
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
// Otherwise: returns best estimated 1RM (see utils/oneRm.ts).
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
      `SELECT MAX(${oneRmSql(setLoadSql(), "ls.reps")}) AS one_rm
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

/** 0..1 share of the way to the goal, or null when it can't be measured (custom goals, or a bodyweight goal with no start). */
export function goalFraction(goal: Goal, progress: number | null): number | null {
  if (progress == null || goal.target_value == null) return null;
  const clamp = (n: number) => Math.max(0, Math.min(1, n));
  if (goal.type === "bodyweight") {
    if (goal.start_value == null || goal.start_value === goal.target_value) return null;
    return clamp((goal.start_value - progress) / (goal.start_value - goal.target_value));
  }
  const target = goal.target_reps != null ? goal.target_reps : goal.target_value;
  return target > 0 ? clamp(progress / target) : null;
}
