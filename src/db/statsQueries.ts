import { getDatabase } from "./database";

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

export type BodyweightLog = {
  id: number;
  weight_lbs: number;
  logged_at: number;
};

export type LifestyleLog = {
  id: number;
  logged_at: number;
  hydration_oz: number | null;
  pre_workout: number;
  location: string | null;
};

// ─── Stats Grid ───────────────────────────────────────────────────────────────

export async function getTotalHours(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ total: number }>(
    "SELECT COALESCE(SUM(duration_seconds), 0) as total FROM workouts WHERE finished_at IS NOT NULL"
  );
  return Math.round((row?.total ?? 0) / 3600);
}

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
     WHERE prev_best IS NULL OR max_weight > prev_best`
  );
  return row?.pr_count ?? 0;
}

export async function getTotalLifted(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(CAST(weight_lbs AS REAL) * CAST(reps AS INTEGER)), 0) as total
     FROM logged_sets
     WHERE is_completed = 1 AND weight_lbs IS NOT NULL AND reps IS NOT NULL`
  );
  return row?.total ?? 0;
}

export async function getWorkoutCount(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM workouts WHERE finished_at IS NOT NULL"
  );
  return row?.count ?? 0;
}

export async function getWorkoutDatesForStreak(): Promise<string[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ d: string }>(
    `SELECT DISTINCT DATE(started_at, 'unixepoch', 'localtime') as d
     FROM workouts
     WHERE finished_at IS NOT NULL
     ORDER BY d DESC`
  );
  return rows.map((r) => r.d);
}

export function calculateStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const set = new Set(dates);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today.getTime() - 86400_000);

  if (!set.has(fmt(today)) && !set.has(fmt(yesterday))) return 0;

  let cursor = set.has(fmt(today)) ? today : yesterday;
  let streak = 0;
  while (set.has(fmt(cursor))) {
    streak++;
    cursor = new Date(cursor.getTime() - 86400_000);
  }
  return streak;
}

export async function getLatestBodyweight(): Promise<number | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ weight_lbs: number }>(
    "SELECT weight_lbs FROM bodyweight_logs ORDER BY logged_at DESC LIMIT 1"
  );
  return row?.weight_lbs ?? null;
}

// ─── Muscle Tracker ───────────────────────────────────────────────────────────

export type RawMuscleSets = Record<string, number>; // muscle_group → raw set count

async function fetchRawSets(
  db: Awaited<ReturnType<typeof getDatabase>>,
  fromSecs: number | null,
  toSecs: number | null
): Promise<RawMuscleSets> {
  const conditions = [
    "ls.is_completed = 1",
    "ls.is_warmup = 0",
    "w.finished_at IS NOT NULL",
  ];
  const params: number[] = [];
  if (fromSecs !== null) { conditions.push("w.started_at >= ?"); params.push(fromSecs); }
  if (toSecs !== null)   { conditions.push("w.started_at < ?");  params.push(toSecs);   }

  const rows = await db.getAllAsync<{ muscle_group: string; set_count: number }>(
    `SELECT e.muscle_group, COUNT(*) AS set_count
     FROM logged_sets ls
     JOIN logged_exercises le ON ls.logged_exercise_id = le.id
     JOIN workouts w ON le.workout_id = w.id
     JOIN exercises e ON le.exercise_id = e.id
     WHERE ${conditions.join(" AND ")}
     GROUP BY e.muscle_group`,
    params
  );

  const result: RawMuscleSets = {};
  for (const r of rows) result[r.muscle_group] = r.set_count;
  return result;
}

export async function getMuscleSets(
  days: number | null // null = all time
): Promise<{ current: RawMuscleSets; previous: RawMuscleSets }> {
  const db = await getDatabase();
  const now = Math.floor(Date.now() / 1000);

  const [current, previous] = await Promise.all([
    fetchRawSets(db, days !== null ? now - days * 86400 : null, null),
    days !== null
      ? fetchRawSets(db, now - days * 2 * 86400, now - days * 86400)
      : Promise.resolve({} as RawMuscleSets),
  ]);
  return { current, previous };
}

// ─── Strength Score ───────────────────────────────────────────────────────────

export type ExerciseOneRM = { name: string; oneRM: number };

export async function getAllExercise1RMs(): Promise<ExerciseOneRM[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ name: string; one_rm: number }>(
    `SELECT e.name, MAX(ls.weight_lbs * (1.0 + ls.reps / 30.0)) AS one_rm
     FROM logged_sets ls
     JOIN logged_exercises le ON ls.logged_exercise_id = le.id
     JOIN workouts w ON le.workout_id = w.id
     JOIN exercises e ON le.exercise_id = e.id
     WHERE ls.is_completed = 1 AND ls.is_warmup = 0
       AND ls.weight_lbs IS NOT NULL AND ls.reps IS NOT NULL AND ls.reps > 0
       AND w.finished_at IS NOT NULL
     GROUP BY le.exercise_id`
  );
  return rows.map((r) => ({ name: r.name, oneRM: r.one_rm }));
}

// ─── 1RM Trajectory ───────────────────────────────────────────────────────────

export async function getOneRMHistory(exerciseId: number): Promise<OneRMDataPoint[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ started_at: number; one_rm: number }>(
    `SELECT w.started_at,
            MAX(ls.weight_lbs * (1.0 + ls.reps / 30.0)) as one_rm
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

export async function getTrackedExercises(): Promise<{ id: number; name: string }[]> {
  const db = await getDatabase();
  return db.getAllAsync<{ id: number; name: string }>(
    `SELECT DISTINCT e.id, e.name
     FROM exercises e
     JOIN logged_exercises le ON e.id = le.exercise_id
     JOIN workouts w ON le.workout_id = w.id
     WHERE w.finished_at IS NOT NULL
     ORDER BY e.use_count DESC
     LIMIT 20`
  );
}

// ─── Volume Distribution ──────────────────────────────────────────────────────

export async function getVolumeByMuscle(days: 7 | 30): Promise<VolumeByMuscle[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ muscle_group: string; volume: number }>(
    `SELECT e.muscle_group,
            COALESCE(SUM(ls.weight_lbs * ls.reps), 0) as volume
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

// ─── Habit Calendar ───────────────────────────────────────────────────────────

export async function getWorkoutDays(pastDays = 91): Promise<Set<string>> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ d: string }>(
    `SELECT DISTINCT DATE(started_at, 'unixepoch', 'localtime') as d
     FROM workouts
     WHERE finished_at IS NOT NULL
       AND started_at > unixepoch() - ? * 86400`,
    [pastDays]
  );
  return new Set(rows.map((r) => r.d));
}

// ─── Lifestyle Logs ───────────────────────────────────────────────────────────

export async function logBodyweight(weightLbs: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "INSERT INTO bodyweight_logs (weight_lbs) VALUES (?)",
    [weightLbs]
  );
}

export async function logLifestyle(data: {
  caffeineM?: number;
}): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO lifestyle_logs (caffeine_mg) VALUES (?)`,
    [data.caffeineM ?? 0]
  );
}

export async function getLatestLifestyle(): Promise<LifestyleLog | null> {
  const db = await getDatabase();
  return db.getFirstAsync<LifestyleLog>(
    "SELECT * FROM lifestyle_logs ORDER BY logged_at DESC LIMIT 1"
  );
}

export async function getBodyweightHistory(limit = 30): Promise<BodyweightLog[]> {
  const db = await getDatabase();
  return db.getAllAsync<BodyweightLog>(
    "SELECT * FROM bodyweight_logs ORDER BY logged_at DESC LIMIT ?",
    [limit]
  );
}

// ─── Training Trends ──────────────────────────────────────────────────────────

export type TrendPoint = { x: number; y: number }; // x = ms timestamp

export async function getVolumeTrend(days: number | null): Promise<TrendPoint[]> {
  const db = await getDatabase();
  const cond = days !== null ? "AND w.started_at >= unixepoch() - ? * 86400" : "";
  const params = days !== null ? [days] : [];
  const rows = await db.getAllAsync<{ ts: number; volume: number }>(
    `SELECT w.started_at * 1000 AS ts,
            COALESCE(SUM(CASE WHEN ls.is_completed = 1 THEN ls.weight_lbs * ls.reps ELSE 0 END), 0) AS volume
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

export async function getFrequencyTrend(days: number | null): Promise<TrendPoint[]> {
  const db = await getDatabase();
  const cond = days !== null ? "WHERE finished_at IS NOT NULL AND started_at >= unixepoch() - ? * 86400" : "WHERE finished_at IS NOT NULL";
  const params = days !== null ? [days] : [];
  const rows = await db.getAllAsync<{ ts: number }>(
    `SELECT started_at * 1000 AS ts FROM workouts ${cond} ORDER BY started_at ASC`,
    params
  );
  return rows.map((r) => ({ x: r.ts, y: 1 }));
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

export async function getCaffeineTrend(days: number | null): Promise<TrendPoint[]> {
  const db = await getDatabase();
  const cond = days !== null ? "AND logged_at >= unixepoch() - ? * 86400" : "";
  const params = days !== null ? [days] : [];
  const rows = await db.getAllAsync<{ ts: number; mg: number }>(
    `SELECT logged_at * 1000 AS ts, caffeine_mg AS mg
     FROM lifestyle_logs
     WHERE caffeine_mg >= 0 ${cond}
     ORDER BY logged_at ASC`,
    params
  );
  return rows.map((r) => ({ x: r.ts, y: r.mg }));
}
