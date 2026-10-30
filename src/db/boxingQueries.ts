import { getDatabase } from "./database";
import type { BoxingPlan, BoxingRound, BoxingSession, FocusChip } from "../types/boxing";

const parseJson = <T>(s: string | null, fallback: T): T => {
  try {
    return s ? (JSON.parse(s) as T) : fallback;
  } catch {
    return fallback;
  }
};

/** Writes the workout (type 'boxing', already finished) and its rounds in one transaction. Returns the workout id. */
export async function saveBoxingSession(session: BoxingSession, appVersion?: string): Promise<number> {
  const db = await getDatabase();
  let id = 0;
  await db.withTransactionAsync(async () => {
    const r = await db.runAsync(
      `INSERT INTO workouts (name, type, started_at, finished_at, duration_seconds, rpe, session_tags, notes, created_at, app_version)
       VALUES (?, 'boxing', ?, ?, ?, ?, ?, ?, unixepoch(), ?)`,
      [session.name, session.startedAt, session.finishedAt, session.durationSeconds, session.rpe,
       JSON.stringify(session.tags), session.notes, appVersion ?? null]
    );
    id = r.lastInsertRowId;
    for (const rd of session.rounds) {
      await db.runAsync(
        `INSERT INTO boxing_rounds (workout_id, round_number, rpe, focus_tags, focus_note, work_seconds, rest_seconds, actual_work_seconds, actual_rest_seconds)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, rd.roundNumber, rd.rpe, JSON.stringify(rd.focusTags), rd.focusNote, rd.workSeconds, rd.restSeconds,
         rd.actualWorkSeconds, rd.actualRestSeconds]
      );
    }
  });
  return id;
}

type WorkoutRow = {
  id: number; name: string; started_at: number; finished_at: number | null; duration_seconds: number | null;
  rpe: number | null; session_tags: string | null; notes: string | null;
};
type RoundRow = {
  round_number: number; rpe: number | null; focus_tags: string | null; focus_note: string | null;
  work_seconds: number; rest_seconds: number; actual_work_seconds: number | null; actual_rest_seconds: number | null;
};

/** Null when the id is missing or is not a boxing workout. */
export async function getBoxingSession(id: number): Promise<BoxingSession | null> {
  const db = await getDatabase();
  const w = await db.getFirstAsync<WorkoutRow>(
    `SELECT id, name, started_at, finished_at, duration_seconds, rpe, session_tags, notes
     FROM workouts WHERE id = ? AND type = 'boxing'`, [id]);
  if (!w) return null;
  const rows = await db.getAllAsync<RoundRow>(
    "SELECT * FROM boxing_rounds WHERE workout_id = ? ORDER BY round_number", [id]);
  const rounds: BoxingRound[] = rows.map((r) => ({
    roundNumber: r.round_number, rpe: r.rpe, focusTags: parseJson<number[]>(r.focus_tags, []), focusNote: r.focus_note,
    workSeconds: r.work_seconds, restSeconds: r.rest_seconds,
    actualWorkSeconds: r.actual_work_seconds, actualRestSeconds: r.actual_rest_seconds,
  }));
  return {
    id: w.id, name: w.name, startedAt: w.started_at, finishedAt: w.finished_at ?? w.started_at,
    durationSeconds: w.duration_seconds ?? 0, rpe: w.rpe, tags: parseJson<string[]>(w.session_tags, []),
    notes: w.notes, rounds,
  };
}

/** Hidden chips are left out unless asked; recap/detail pass includeHidden so old rounds keep their labels. */
export async function getFocusChips(opts: { includeHidden?: boolean } = {}): Promise<FocusChip[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: number; name: string; group_name: string; is_default: number; is_hidden: number; order_index: number;
  }>(`SELECT * FROM boxing_focus_chips ${opts.includeHidden ? "" : "WHERE is_hidden = 0"} ORDER BY order_index, id`);
  return rows.map((r) => ({
    id: r.id, name: r.name, group: r.group_name, isDefault: r.is_default === 1, isHidden: r.is_hidden === 1, order: r.order_index,
  }));
}

/** Rounds/work/rest of the newest finished boxing session, or null when there is none. */
export async function getLastBoxingSetup(): Promise<BoxingPlan | null> {
  const db = await getDatabase();
  const w = await db.getFirstAsync<{ id: number }>(
    "SELECT id FROM workouts WHERE type = 'boxing' AND finished_at IS NOT NULL ORDER BY started_at DESC, id DESC LIMIT 1");
  if (!w) return null;
  const n = await db.getFirstAsync<{ n: number }>("SELECT COUNT(*) n FROM boxing_rounds WHERE workout_id = ?", [w.id]);
  const first = await db.getFirstAsync<{ work_seconds: number; rest_seconds: number }>(
    "SELECT work_seconds, rest_seconds FROM boxing_rounds WHERE workout_id = ? ORDER BY round_number LIMIT 1", [w.id]);
  if (!n || !first) return null;
  return { rounds: n.n, workSec: first.work_seconds, restSec: first.rest_seconds };
}

/** Average RPE of the newest `limit` finished boxing sessions before `beforeStartedAt` (round average, else overall; null if neither). */
export async function getPriorAvgRpes(beforeStartedAt: number, excludeId: number, limit = 5): Promise<(number | null)[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ avg: number | null }>(
    `SELECT COALESCE((SELECT AVG(rpe) FROM boxing_rounds r WHERE r.workout_id = w.id), w.rpe) AS avg
     FROM workouts w
     WHERE w.type = 'boxing' AND w.finished_at IS NOT NULL AND w.id != ? AND w.started_at < ?
     ORDER BY w.started_at DESC, w.id DESC LIMIT ?`,
    [excludeId, beforeStartedAt, limit]
  );
  return rows.map((r) => r.avg);
}
