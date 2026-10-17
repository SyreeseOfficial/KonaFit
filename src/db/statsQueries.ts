import { getDatabase } from "./database";
import { localDateKey } from "../utils/time";
import { setLoadSql } from "./sqlFragments";

export type StatsGrid = {
  totalLiftedLbs: number;
  workoutCount: number;
  streak: number;
  latestBodyweightLbs: number | null;
};

export type OneRMDataPoint = {
  date: number; // unix timestamp
  oneRM: number;
};

export type VolumeByMuscle = {
  muscleGroup: string;
  volumeLbs: number;
};

// ─── Stats Grid ───────────────────────────────────────────────────────────────

export async function getTotalPRCount(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ pr_count: number }>(
    `WITH per_workout AS (
       SELECT le.exercise_id, w.id AS workout_id, w.started_at,
              MAX(ls.weight_lbs) AS max_weight
       FROM logged_sets ls
       JOIN logged_exercises le ON ls.logged_exercise_id = le.id
       JOIN workouts w ON le.workout_id = w.id
       WHERE w.finished_at IS NOT NULL
         AND ls.is_completed = 1 AND ls.is_warmup = 0
         AND ls.weight_lbs IS NOT NULL
       GROUP BY le.exercise_id, w.id
     ),
     with_prev AS (
       SELECT *,
         MAX(max_weight) OVER (
           PARTITION BY exercise_id
           ORDER BY started_at
           ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
         ) AS prev_best
       FROM per_workout
     )
     SELECT COUNT(*) AS pr_count FROM with_prev
     WHERE max_weight > prev_best`  // a first appearance has no prev_best and is not a PR
  );
  return row?.pr_count ?? 0;
}

/** Total time, workout count and total lifted in one round trip. */
export async function getStatsTotals(): Promise<{ seconds: number; workoutCount: number; totalLifted: number }> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ secs: number; n: number; lifted: number }>(
    `SELECT
       (SELECT COALESCE(SUM(duration_seconds), 0) FROM workouts WHERE finished_at IS NOT NULL) AS secs,
       (SELECT COUNT(*) FROM workouts WHERE finished_at IS NOT NULL) AS n,
       (SELECT COALESCE(SUM(${setLoadSql()} * ls.reps), 0) FROM logged_sets ls
         JOIN logged_exercises le ON le.id = ls.logged_exercise_id
         WHERE ls.is_completed = 1 AND ls.weight_lbs IS NOT NULL AND ls.reps IS NOT NULL) AS lifted`
  );
  return {
    seconds: row?.secs ?? 0,
    workoutCount: row?.n ?? 0,
    totalLifted: row?.lifted ?? 0,
  };
}

// ponytail: streaks cap at ~400 days; widen the window if anyone gets there.
export async function getWorkoutDatesForStreak(): Promise<string[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ d: string }>(
    `SELECT DISTINCT DATE(started_at, 'unixepoch', 'localtime') as d
     FROM workouts
     WHERE finished_at IS NOT NULL
       AND started_at >= unixepoch() - 400 * 86400
       AND EXISTS (
         SELECT 1 FROM logged_exercises le JOIN logged_sets ls ON ls.logged_exercise_id = le.id
         WHERE le.workout_id = workouts.id AND ls.is_completed = 1
       )
     ORDER BY d DESC`
  );
  return rows.map((r) => r.d);
}

export function calculateStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const set = new Set(dates);
  const fmt = localDateKey; // local-date keys match SQLite DATE(..., 'localtime')

  // setDate steps calendar days, so DST shifts can't skip or repeat a day.
  const cursor = new Date();
  if (!set.has(fmt(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!set.has(fmt(cursor))) return 0;
  }
  let streak = 0;
  while (set.has(fmt(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export async function getLatestBodyweight(): Promise<number | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ weight_lbs: number }>(
    "SELECT weight_lbs FROM bodyweight_logs ORDER BY logged_at DESC, id DESC LIMIT 1"
  );
  return row?.weight_lbs ?? null;
}

// ─── 1RM Trajectory ───────────────────────────────────────────────────────────

export async function getOneRMHistory(exerciseId: number): Promise<OneRMDataPoint[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ started_at: number; one_rm: number }>(
    `SELECT w.started_at,
            MAX(${setLoadSql()} * (1.0 + ls.reps / 30.0)) as one_rm
     FROM logged_sets ls
     JOIN logged_exercises le ON ls.logged_exercise_id = le.id
     JOIN workouts w ON le.workout_id = w.id
     WHERE le.exercise_id = ?
       AND ls.is_completed = 1
       AND ls.is_warmup = 0
       AND ls.weight_lbs IS NOT NULL
       AND ls.reps IS NOT NULL
       AND ls.reps > 0
     GROUP BY w.id
     ORDER BY w.started_at ASC`,
    [exerciseId]
  );
  return rows.map((r) => ({ date: r.started_at * 1000, oneRM: Math.round(r.one_rm) }));
}

export async function getTrackedExercises(limit = 20): Promise<{ id: number; name: string }[]> {
  const db = await getDatabase();
  return db.getAllAsync<{ id: number; name: string }>(
    `SELECT DISTINCT e.id, e.name
     FROM exercises e
     JOIN logged_exercises le ON e.id = le.exercise_id
     JOIN workouts w ON le.workout_id = w.id
     WHERE w.finished_at IS NOT NULL
     ORDER BY e.use_count DESC
     LIMIT ?`,
    [limit]
  );
}

// ─── Volume Distribution ──────────────────────────────────────────────────────

export async function getVolumeByMuscle(days: 7 | 30): Promise<VolumeByMuscle[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ muscle_group: string; volume: number }>(
    `SELECT e.muscle_group,
            COALESCE(SUM(${setLoadSql()} * ls.reps), 0) as volume
     FROM logged_sets ls
     JOIN logged_exercises le ON ls.logged_exercise_id = le.id
     JOIN workouts w ON le.workout_id = w.id
     JOIN exercises e ON le.exercise_id = e.id
     WHERE ls.is_completed = 1
       AND ls.weight_lbs IS NOT NULL
       AND ls.reps IS NOT NULL
       AND w.started_at > unixepoch() - ? * 86400
     GROUP BY e.muscle_group
     ORDER BY volume DESC`,
    [days]
  );
  return rows.map((r) => ({ muscleGroup: r.muscle_group, volumeLbs: r.volume }));
}

// ─── Bodyweight ───────────────────────────────────────────────────────────

export async function logBodyweight(weightLbs: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "INSERT INTO bodyweight_logs (weight_lbs) VALUES (?)",
    [weightLbs]
  );
}

export type BodyweightEntry = { id: number; weight_lbs: number; logged_at: number };

export async function getBodyweightHistory(limit = 8): Promise<BodyweightEntry[]> {
  const db = await getDatabase();
  return db.getAllAsync<BodyweightEntry>(
    "SELECT id, weight_lbs, logged_at FROM bodyweight_logs ORDER BY logged_at DESC, id DESC LIMIT ?",
    [limit]
  );
}

export async function updateBodyweight(id: number, weightLbs: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("UPDATE bodyweight_logs SET weight_lbs = ? WHERE id = ?", [weightLbs, id]);
}

export async function deleteBodyweight(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM bodyweight_logs WHERE id = ?", [id]);
}

// ─── Training Trends ──────────────────────────────────────────────────────────

export type TrendPoint = { x: number; y: number }; // x = ms timestamp

export async function getVolumeTrend(days: number | null): Promise<TrendPoint[]> {
  const db = await getDatabase();
  const cond = days !== null ? "AND w.started_at >= unixepoch() - ? * 86400" : "";
  const params = days !== null ? [days] : [];
  const rows = await db.getAllAsync<{ ts: number; volume: number }>(
    `SELECT w.started_at * 1000 AS ts,
            COALESCE(SUM(CASE WHEN ls.is_completed = 1 THEN ${setLoadSql()} * ls.reps ELSE 0 END), 0) AS volume
     FROM workouts w
     LEFT JOIN logged_exercises le ON le.workout_id = w.id
     LEFT JOIN logged_sets ls ON ls.logged_exercise_id = le.id
     WHERE w.finished_at IS NOT NULL ${cond}
     GROUP BY w.id
     ORDER BY w.started_at ASC`,
    params
  );
  return rows.map((r) => ({ x: r.ts, y: r.volume }));
}

export async function getBodyweightTrend(days: number | null): Promise<TrendPoint[]> {
  const db = await getDatabase();
  const cond = days !== null ? "WHERE logged_at >= unixepoch() - ? * 86400" : "";
  const params = days !== null ? [days] : [];
  const rows = await db.getAllAsync<{ ts: number; weight: number }>(
    `SELECT logged_at * 1000 AS ts, weight_lbs AS weight
     FROM bodyweight_logs ${cond} ORDER BY logged_at ASC`,
    params
  );
  return rows.map((r) => ({ x: r.ts, y: r.weight }));
}

