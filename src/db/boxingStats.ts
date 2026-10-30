import { getDatabase } from "./database";
import { workingSetSql } from "./sqlFragments";
import { weekStartSecs, type TrendPoint } from "./statsQueries";

export type BoxingPeriod = "week" | "month";

export type BoxingBucket = {
  x: number; // ms of the bucket's first session
  rounds: number;
  minutes: number;
  sessions: number;
  avgRpe: number | null;
};

/**
 * Boxing totals per week (Monday start, like the other weekly stats) or per calendar month for the last `count` buckets,
 * oldest first. avgRpe averages each session's own average (round RPEs, else the overall RPE). Empty when there is no boxing.
 */
export async function getBoxingBuckets(period: BoxingPeriod, count = 12): Promise<BoxingBucket[]> {
  const db = await getDatabase();
  const fmt = period === "week" ? "%Y-%W" : "%Y-%m";
  const days = period === "week" ? count * 7 : count * 31;
  const rows = await db.getAllAsync<{ ts: number; rounds: number; secs: number; sessions: number; avg_rpe: number | null }>(
    `SELECT MIN(started_at) * 1000 AS ts, SUM(rounds) AS rounds, SUM(dur) AS secs, COUNT(*) AS sessions, AVG(srpe) AS avg_rpe
     FROM (
       SELECT w.started_at,
              strftime(?, w.started_at, 'unixepoch', 'localtime') AS bucket,
              (SELECT COUNT(*) FROM boxing_rounds br WHERE br.workout_id = w.id) AS rounds,
              COALESCE(w.duration_seconds, 0) AS dur,
              COALESCE((SELECT AVG(br.rpe) FROM boxing_rounds br WHERE br.workout_id = w.id), w.rpe) AS srpe
       FROM workouts w
       WHERE w.type = 'boxing' AND w.finished_at IS NOT NULL AND w.started_at >= unixepoch() - ? * 86400
     )
     GROUP BY bucket ORDER BY bucket ASC`,
    [fmt, days]
  );
  return rows.map((r) => ({ x: r.ts, rounds: r.rounds, minutes: Math.round(r.secs / 6) / 10, sessions: r.sessions, avgRpe: r.avg_rpe }));
}

export const roundsTrend = (b: BoxingBucket[]): TrendPoint[] => b.map((p) => ({ x: p.x, y: p.rounds }));
export const minutesTrend = (b: BoxingBucket[]): TrendPoint[] => b.map((p) => ({ x: p.x, y: p.minutes }));
export const rpeTrend = (b: BoxingBucket[]): TrendPoint[] =>
  b.filter((p) => p.avgRpe != null).map((p) => ({ x: p.x, y: Math.round(p.avgRpe! * 10) / 10 }));

/** True once there is at least one finished boxing session (the Stats section stays hidden until then). */
export async function hasBoxingSessions(): Promise<boolean> {
  const db = await getDatabase();
  return (await db.getFirstAsync("SELECT 1 FROM workouts WHERE type = 'boxing' AND finished_at IS NOT NULL LIMIT 1")) != null;
}

// ─── Training load (sRPE x minutes) ──────────────────────────────────────────

export type LoadSession = { rpe: number | null; avgRpe: number | null; durationSec: number | null };

/**
 * RPE x minutes. RPE is the session's overall RPE if set, else the average of its logged RPEs (lift working sets / boxing
 * rounds), else the session is left out (null). A session with no recorded length is left out too.
 */
export function sessionLoad(s: LoadSession): number | null {
  const rpe = s.rpe ?? s.avgRpe;
  if (rpe == null || !s.durationSec || s.durationSec <= 0) return null;
  return rpe * (s.durationSec / 60);
}

export type TrainingLoad = { thisWeek: number; lastWeek: number; changePct: number | null };

export const loadChangePct = (thisWeek: number, lastWeek: number): number | null =>
  lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : null;

/** Load this week (since Monday) vs last week across lifting and boxing. changePct is null when last week has no load. */
export async function getTrainingLoad(): Promise<TrainingLoad> {
  const db = await getDatabase();
  const thisStart = weekStartSecs();
  const lastStart = weekStartSecs(new Date((thisStart - 3 * 86400) * 1000)); // a day in last week, so DST can't shift it
  const rows = await db.getAllAsync<{ started_at: number; rpe: number | null; avg_rpe: number | null; dur: number | null }>(
    `SELECT w.started_at, w.rpe, w.duration_seconds AS dur,
            CASE WHEN w.type = 'boxing'
              THEN (SELECT AVG(br.rpe) FROM boxing_rounds br WHERE br.workout_id = w.id)
              ELSE (SELECT AVG(ls.rpe) FROM logged_sets ls JOIN logged_exercises le ON le.id = ls.logged_exercise_id
                     WHERE le.workout_id = w.id AND ${workingSetSql()} AND ls.rpe IS NOT NULL)
            END AS avg_rpe
     FROM workouts w WHERE w.finished_at IS NOT NULL AND w.started_at >= ?`,
    [lastStart]
  );
  let thisWeek = 0, lastWeek = 0;
  for (const r of rows) {
    const load = sessionLoad({ rpe: r.rpe, avgRpe: r.avg_rpe, durationSec: r.dur });
    if (load == null) continue;
    if (r.started_at >= thisStart) thisWeek += load;
    else lastWeek += load;
  }
  thisWeek = Math.round(thisWeek);
  lastWeek = Math.round(lastWeek);
  return { thisWeek, lastWeek, changePct: loadChangePct(thisWeek, lastWeek) };
}
