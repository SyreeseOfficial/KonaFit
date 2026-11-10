import { getDatabase } from "./database";
import { setLoadSql, oneRmSql, workingSetSql } from "./sqlFragments";
import { weekStartSecs } from "./statsQueries";

export type GoalType =
  | "lift_pr" | "bodyweight" | "custom"
  | "boxing_rounds" | "boxing_sessions" | "boxing_minutes" | "boxing_avg_rpe";

const BOXING_GOAL_TYPES: GoalType[] = ["boxing_rounds", "boxing_sessions", "boxing_minutes", "boxing_avg_rpe"];
export const isBoxingGoal = (t: GoalType) => BOXING_GOAL_TYPES.includes(t);

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
  direction: "up" | "down" | null; // bodyweight goals: bulking (up) or cutting (down). Avg-RPE goals: floor (up) or ceiling (down)
  start_date: number | null; // unix seconds; boxing goals' date range (null = open-ended)
  end_date: number | null;
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
  startDate?: number | null;
  endDate?: number | null;
  /** Avg-RPE goals: "down" = keep it under the target (ceiling), "up" = keep it at or over (floor). */
  direction?: "up" | "down" | null;
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
  if (data.type === "boxing_avg_rpe") direction = data.direction ?? "down";
  const result = await db.runAsync(
    `INSERT INTO goals (type, title, exercise_id, exercise_name, target_value, target_reps, notes, start_value, direction, start_date, end_date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [data.type, data.title.trim(), data.exerciseId ?? null, data.exerciseName ?? null,
     data.targetValue ?? null, data.targetReps ?? null, data.notes?.trim() ?? null, startValue, direction,
     data.startDate ?? null, data.endDate ?? null]
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
  if (isBoxingGoal(goal.type)) return getBoxingGoalProgress(goal);
  return null;
}

/** True once a goal's end date has passed. Open-ended goals never end. */
export const goalEnded = (goal: Goal, nowMs = Date.now()): boolean => goal.end_date != null && nowMs / 1000 > goal.end_date;

/**
 * The slice of time a boxing goal measures, in unix seconds, or null before the goal starts.
 * Per-week goals (rounds, sessions, minutes) look at the current week, or the last week of the range once it has ended,
 * cut to the goal's dates. The average-RPE goal looks at the whole range so far.
 */
function boxingGoalWindow(goal: Goal, nowMs = Date.now()): { from: number; to: number } | null {
  const now = nowMs / 1000;
  const start = goal.start_date ?? goal.created_at;
  if (now < start) return null;
  const ref = goal.end_date != null ? Math.min(now, goal.end_date) : now;
  let from = start;
  if (goal.type !== "boxing_avg_rpe") from = Math.max(start, weekStartSecs(new Date(ref * 1000)));
  return { from, to: ref };
}

async function getBoxingGoalProgress(goal: Goal): Promise<number | null> {
  const w = boxingGoalWindow(goal);
  if (!w) return goal.type === "boxing_avg_rpe" ? null : 0;
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ sessions: number; rounds: number | null; secs: number | null; avg_rpe: number | null }>(
    `SELECT COUNT(*) AS sessions, SUM(rounds) AS rounds, SUM(dur) AS secs, AVG(srpe) AS avg_rpe FROM (
       SELECT (SELECT COUNT(*) FROM boxing_rounds br WHERE br.workout_id = w.id) AS rounds,
              COALESCE(w.duration_seconds, 0) AS dur,
              COALESCE((SELECT AVG(br.rpe) FROM boxing_rounds br WHERE br.workout_id = w.id), w.rpe) AS srpe
       FROM workouts w
       WHERE w.type = 'boxing' AND w.finished_at IS NOT NULL AND w.started_at >= ? AND w.started_at <= ?
     )`,
    [w.from, w.to]
  );
  switch (goal.type) {
    case "boxing_rounds": return row?.rounds ?? 0;
    case "boxing_sessions": return row?.sessions ?? 0;
    case "boxing_minutes": return Math.round((row?.secs ?? 0) / 6) / 10;
    default: return row?.avg_rpe ?? null;
  }
}

/** 0..1 share of the way to the goal, or null when it can't be measured (custom goals, or a bodyweight goal with no start). */
export function goalFraction(goal: Goal, progress: number | null): number | null {
  if (progress == null || goal.target_value == null) return null;
  const clamp = (n: number) => Math.max(0, Math.min(1, n));
  if (goal.type === "bodyweight") {
    if (goal.start_value == null || goal.start_value === goal.target_value) return null;
    return clamp((goal.start_value - progress) / (goal.start_value - goal.target_value));
  }
  if (goal.type === "boxing_avg_rpe") {
    if (goal.target_value <= 0 || progress <= 0) return progress <= 0 ? 1 : null;
    // ceiling ("down"): at or under the target is full; floor ("up"): at or over is full. Otherwise how close you are.
    return goal.direction === "up" ? clamp(progress / goal.target_value) : clamp(goal.target_value / progress);
  }
  const target = goal.target_reps != null ? goal.target_reps : goal.target_value;
  return target > 0 ? clamp(progress / target) : null;
}
