import { getDatabase } from "./database";
import { localDateKey } from "../utils/time";
import { setVolumeSql, workingSetSql, oneRmSql, setLoadSql } from "./sqlFragments";

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

/** A set heavier than this multiple of the best so far is treated as a typo (2250 for 225), not a PR. */
export const PR_OUTLIER_FACTOR = 3;

/** Rows must be ordered by exercise then date; each is one workout's best working weight for that exercise. */
export function countPRs(rows: { exercise_id: number; max_weight: number }[]): number {
  let count = 0;
  let current = -1;
  let best = 0;
  for (const r of rows) {
    if (r.exercise_id !== current) { current = r.exercise_id; best = r.max_weight; continue; } // first appearance is not a PR
    if (r.max_weight > best * PR_OUTLIER_FACTOR) continue; // typo: neither a PR nor the new bar to beat
    if (r.max_weight > best) { count++; best = r.max_weight; }
  }
  return count;
}

export async function getTotalPRCount(): Promise<number> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ exercise_id: number; max_weight: number }>(
    `SELECT le.exercise_id, MAX(ls.weight_lbs) AS max_weight
     FROM logged_sets ls
     JOIN logged_exercises le ON ls.logged_exercise_id = le.id
     JOIN workouts w ON le.workout_id = w.id
     WHERE w.finished_at IS NOT NULL AND ${workingSetSql()}
     GROUP BY le.exercise_id, w.id
     ORDER BY le.exercise_id, w.started_at, w.id`
  );
  return countPRs(rows);
}

/** Total time, workout count and total lifted in one round trip. */
export async function getStatsTotals(): Promise<{ seconds: number; workoutCount: number; totalLifted: number }> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ secs: number; n: number; lifted: number }>(
    `SELECT
       (SELECT COALESCE(SUM(duration_seconds), 0) FROM workouts WHERE finished_at IS NOT NULL) AS secs,
       (SELECT COUNT(*) FROM workouts WHERE finished_at IS NOT NULL) AS n,
       (SELECT COALESCE(SUM(${setVolumeSql()}), 0) FROM logged_sets ls
         JOIN logged_exercises le ON le.id = ls.logged_exercise_id
         JOIN workouts w ON w.id = le.workout_id
         WHERE w.finished_at IS NOT NULL AND ${workingSetSql()}) AS lifted`
  );
  return {
    seconds: row?.secs ?? 0,
    workoutCount: row?.n ?? 0,
    totalLifted: row?.lifted ?? 0,
  };
}

// Streak rule: a workout counts for the local day it was finished (so one that crosses midnight lands on the day you ended it).
// ponytail: streaks cap at ~400 days; widen the window if anyone gets there.
export async function getWorkoutDatesForStreak(): Promise<string[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ d: string }>(
    `SELECT DISTINCT DATE(finished_at, 'unixepoch', 'localtime') as d
     FROM workouts
     WHERE finished_at IS NOT NULL
       AND finished_at >= unixepoch() - 400 * 86400
       AND EXISTS (
         SELECT 1 FROM logged_exercises le JOIN logged_sets ls ON ls.logged_exercise_id = le.id
         WHERE le.workout_id = workouts.id AND ls.is_completed = 1
       )
     ORDER BY d DESC`
  );
  return rows.map((r) => r.d);
}

/** Local Monday 00:00 of the week containing `now`, in unix seconds. */
export function weekStartSecs(now = new Date()): number {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return Math.floor(d.getTime() / 1000);
}

/** Finished workouts with a ticked set since Monday, for the "2 / 4 this week" goal progress. */
export async function getWorkoutsThisWeek(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ n: number }>(
    `SELECT COUNT(*) AS n FROM workouts
     WHERE finished_at >= ?
       AND EXISTS (
         SELECT 1 FROM logged_exercises le JOIN logged_sets ls ON ls.logged_exercise_id = le.id
         WHERE le.workout_id = workouts.id AND ls.is_completed = 1
       )`,
    [weekStartSecs()]
  );
  return row?.n ?? 0;
}

/** Consecutive local days with a workout. Today may still be empty; `restDays` (0 = Sunday) are planned and never break the streak. */
export function calculateStreak(dates: string[], restDays: number[] = []): number {
  const set = new Set(dates);
  const rest = new Set(restDays);
  const cursor = new Date(); // setDate steps calendar days, so DST shifts can't skip or repeat a day
  let streak = 0;
  for (let i = 0; i < 800; i++) {
    if (set.has(localDateKey(cursor))) streak++;
    else if (i > 0 && !rest.has(cursor.getDay())) break;
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
            MAX(${oneRmSql(setLoadSql(), "ls.reps")}) as one_rm
     FROM logged_sets ls
     JOIN logged_exercises le ON ls.logged_exercise_id = le.id
     JOIN workouts w ON le.workout_id = w.id
     WHERE le.exercise_id = ?
       AND ${workingSetSql()}
       AND w.finished_at IS NOT NULL
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
            COALESCE(SUM(${setVolumeSql()}), 0) as volume
     FROM logged_sets ls
     JOIN logged_exercises le ON ls.logged_exercise_id = le.id
     JOIN workouts w ON le.workout_id = w.id
     JOIN exercises e ON le.exercise_id = e.id
     WHERE ${workingSetSql()}
       AND w.finished_at IS NOT NULL
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
            COALESCE(SUM(CASE WHEN ${workingSetSql()} THEN ${setVolumeSql()} ELSE 0 END), 0) AS volume
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


export type FeelField = "rating" | "energy" | "sleep_hours";

/** One point per finished workout that has the field filled in (x = start, ms). */
export async function getFeelTrend(field: FeelField, days: number | null = 90): Promise<TrendPoint[]> {
  const db = await getDatabase();
  const cond = days !== null ? "AND started_at >= unixepoch() - ? * 86400" : "";
  const rows = await db.getAllAsync<{ ts: number; v: number }>(
    `SELECT started_at * 1000 AS ts, ${field} AS v FROM workouts
     WHERE finished_at IS NOT NULL AND ${field} IS NOT NULL ${cond} ORDER BY started_at ASC`,
    days !== null ? [days] : []
  );
  return rows.map((r) => ({ x: r.ts, y: r.v }));
}
