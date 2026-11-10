import { getDatabase } from "./database";
import { setVolumeSql, workingSetSql } from "./sqlFragments";
import { localDateKey } from "../utils/time";
import { estimateOneRm } from "../utils/oneRm";
import type { WeekLoad } from "../utils/training";
import type { TrendPoint } from "./statsQueries";

// Queries behind the Stats trend cards, the readiness check-in and the workout-complete insights.

type WeeklyLoad = WeekLoad & { x: number; current: boolean }; // x = ms of the week's first workout

/** Weekly volume and average RPE for the last `weeks` weeks (weeks start Monday, local time). `current` marks the unfinished week. */
export async function getWeeklyLoad(weeks = 12): Promise<WeeklyLoad[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ wk: string; ts: number; volume: number; avg_rpe: number | null }>(
    `SELECT strftime('%Y-%W', w.started_at, 'unixepoch', 'localtime') AS wk,
            MIN(w.started_at) * 1000 AS ts,
            COALESCE(SUM(${setVolumeSql()}), 0) AS volume,
            AVG(ls.rpe) AS avg_rpe
     FROM logged_sets ls
     JOIN logged_exercises le ON ls.logged_exercise_id = le.id
     JOIN workouts w ON le.workout_id = w.id
     WHERE ${workingSetSql()} AND w.finished_at IS NOT NULL
       AND w.started_at >= unixepoch() - ? * 7 * 86400
     GROUP BY wk ORDER BY wk ASC`,
    [weeks]
  );
  const thisWeek = await db.getFirstAsync<{ wk: string }>("SELECT strftime('%Y-%W', 'now', 'localtime') AS wk");
  return rows.map((r) => ({ x: r.ts, volume: r.volume, avgRpe: r.avg_rpe, current: r.wk === thisWeek?.wk }));
}

/** Working sets ticked in the last 7 days at RPE 6+ (or no RPE), per exercise muscle_group string. */
export async function getHardSetsLastWeek(): Promise<{ muscle_group: string; sets: number }[]> {
  const db = await getDatabase();
  return db.getAllAsync(
    `SELECT e.muscle_group, COUNT(*) AS sets
     FROM logged_sets ls
     JOIN logged_exercises le ON ls.logged_exercise_id = le.id
     JOIN workouts w ON le.workout_id = w.id
     JOIN exercises e ON e.id = le.exercise_id
     WHERE ${workingSetSql()} AND w.finished_at IS NOT NULL
       AND w.started_at >= unixepoch() - 7 * 86400
       AND (ls.rpe IS NULL OR ls.rpe >= 6)
     GROUP BY e.muscle_group`
  );
}

/** Most recent finished workout per exercise muscle_group string (unix secs). */
export async function getLastTrainedByGroup(): Promise<{ muscle_group: string; last: number }[]> {
  const db = await getDatabase();
  return db.getAllAsync(
    `SELECT e.muscle_group, MAX(w.started_at) AS last
     FROM logged_sets ls
     JOIN logged_exercises le ON ls.logged_exercise_id = le.id
     JOIN workouts w ON le.workout_id = w.id
     JOIN exercises e ON e.id = le.exercise_id
     WHERE ${workingSetSql()} AND w.finished_at IS NOT NULL
     GROUP BY e.muscle_group`
  );
}

/** Target 1RM of the open lift goal for an exercise (a rep target is converted with the same formula as the chart), or null. */
export async function getLiftGoalOneRm(exerciseId: number): Promise<number | null> {
  const db = await getDatabase();
  const g = await db.getFirstAsync<{ target_value: number | null; target_reps: number | null }>(
    `SELECT target_value, target_reps FROM goals
     WHERE type = 'lift_pr' AND exercise_id = ? AND is_achieved = 0 AND target_value IS NOT NULL
     ORDER BY created_at DESC LIMIT 1`,
    [exerciseId]
  );
  if (!g || g.target_value == null) return null;
  return g.target_reps ? estimateOneRm(g.target_value, g.target_reps) : g.target_value;
}

export async function getBodyweightGoal(): Promise<number | null> {
  const db = await getDatabase();
  const g = await db.getFirstAsync<{ target_value: number }>(
    `SELECT target_value FROM goals WHERE type = 'bodyweight' AND is_achieved = 0 AND target_value IS NOT NULL
     ORDER BY created_at DESC LIMIT 1`
  );
  return g?.target_value ?? null;
}

// ─── Daily readiness ──────────────────────────────────────────────────────────

export type Readiness = { sleep: number; soreness: number; mood: number }; // each 1-5; soreness 5 = very sore

/** 1-5 where higher is more ready (soreness is flipped). */
export const readinessScore = (r: Readiness): number => (r.sleep + (6 - r.soreness) + r.mood) / 3;

export async function saveReadiness(r: Readiness, day = localDateKey(new Date())): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO readiness_checkins (day, sleep, soreness, mood) VALUES (?, ?, ?, ?)
     ON CONFLICT(day) DO UPDATE SET sleep = excluded.sleep, soreness = excluded.soreness, mood = excluded.mood`,
    [day, r.sleep, r.soreness, r.mood]
  );
}

export async function getTodayReadiness(day = localDateKey(new Date())): Promise<Readiness | null> {
  const db = await getDatabase();
  return db.getFirstAsync<Readiness>("SELECT sleep, soreness, mood FROM readiness_checkins WHERE day = ?", [day]);
}

export async function getReadinessTrend(days = 90): Promise<TrendPoint[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<Readiness & { day: string }>(
    "SELECT day, sleep, soreness, mood FROM readiness_checkins WHERE day >= date('now', 'localtime', ?) ORDER BY day ASC",
    [`-${days} days`]
  );
  return rows.map((r) => ({ x: new Date(`${r.day}T12:00:00`).getTime(), y: readinessScore(r) }));
}

/** Average "how did it feel" rating of workouts done on high-readiness days (score 4+) vs the rest. */
export async function getReadinessVsRating(): Promise<{ high: number | null; low: number | null }> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ score: number; rating: number }>(
    `SELECT (r.sleep + (6 - r.soreness) + r.mood) / 3.0 AS score, w.rating
     FROM workouts w
     JOIN readiness_checkins r ON r.day = date(w.started_at, 'unixepoch', 'localtime')
     WHERE w.finished_at IS NOT NULL AND w.type = 'lift' AND w.rating IS NOT NULL`
  );
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
  return {
    high: avg(rows.filter((r) => r.score >= 4).map((r) => r.rating)),
    low: avg(rows.filter((r) => r.score < 4).map((r) => r.rating)),
  };
}

// ─── Workout-complete insights ────────────────────────────────────────────────

/** Volume of the last `n` finished workouts with the same name before this one, newest first. */
export async function getPriorVolumes(workoutId: number, n = 4): Promise<number[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ volume: number }>(
    `SELECT COALESCE(SUM(CASE WHEN ${workingSetSql()} THEN ${setVolumeSql()} ELSE 0 END), 0) AS volume
     FROM workouts w
     LEFT JOIN logged_exercises le ON le.workout_id = w.id
     LEFT JOIN logged_sets ls ON ls.logged_exercise_id = le.id
     WHERE w.finished_at IS NOT NULL AND w.type = 'lift'
       AND w.name = (SELECT name FROM workouts WHERE id = ?)
       AND w.started_at < (SELECT started_at FROM workouts WHERE id = ?)
     GROUP BY w.id ORDER BY w.started_at DESC LIMIT ?`,
    [workoutId, workoutId, n]
  );
  return rows.map((r) => r.volume);
}
