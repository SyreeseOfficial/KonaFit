// Boxing DB tests: runs the real queries against in-memory SQLite.
import { setupDb } from "./helpers/sqlite";
import type { BoxingSession } from "../types/boxing";
import { buildRecap, sessionAvgRpe } from "../utils/boxingRecap";
import { createTimer } from "../utils/boxingTimer";
import { serializeSnapshot, parseSnapshot, updateRoundLog } from "../utils/boxingSnapshot";
import { serializeSession, parseSession } from "../utils/sessionReducers";

async function fresh() {
  const ctx = await setupDb();
  await ctx.init();
  return { ...ctx, q: await import("../db/boxingQueries") };
}

jest.mock("expo-sqlite", () => ({})); // static imports below only use pure helpers; DB tests re-mock via setupDb

const rounds = (n: number, extra: Partial<BoxingSession["rounds"][number]> = {}) =>
  Array.from({ length: n }, (_, i) => ({
    roundNumber: i + 1, rpe: null, focusTags: [], focusNote: null, workSeconds: 180, restSeconds: 60,
    actualWorkSeconds: null, actualRestSeconds: null, ...extra,
  }));

const session = (o: Partial<BoxingSession> = {}): BoxingSession => ({
  name: "Morning Boxing", startedAt: 1_000_000, finishedAt: 1_001_200, durationSeconds: 1140, rpe: 7,
  tags: ["Heavy bag"], notes: "felt good", rounds: rounds(3), ...o,
});

describe("boxing queries", () => {
  it("saves and reads a session round-trip, with created_at/app_version set", async () => {
    const { adapter, q } = await fresh();
    const s = session({ rounds: [{ ...rounds(1)[0], rpe: 8, focusTags: [1, 2], focusNote: "sharp", actualWorkSeconds: 210 }, ...rounds(2).map((r) => ({ ...r, roundNumber: r.roundNumber + 1 }))] });
    const id = await q.saveBoxingSession(s, "1.2.3");
    expect(await q.getBoxingSession(id)).toEqual({ ...s, id });
    const w = await adapter.getFirstAsync<{ type: string; created_at: number; app_version: string }>(
      "SELECT type, created_at, app_version FROM workouts WHERE id = ?", [id]);
    expect(w).toMatchObject({ type: "boxing", app_version: "1.2.3" });
    expect(w!.created_at).toBeGreaterThan(0);
  });

  it("getBoxingSession is null for a missing id or a lifting workout", async () => {
    const { adapter, q } = await fresh();
    const lift = await adapter.runAsync("INSERT INTO workouts (name) VALUES ('Push')");
    expect(await q.getBoxingSession(lift.lastInsertRowId)).toBeNull();
    expect(await q.getBoxingSession(9999)).toBeNull();
  });

  it("getLastBoxingSetup is null on an empty DB, else the newest session's shape", async () => {
    const { q } = await fresh();
    expect(await q.getLastBoxingSetup()).toBeNull();
    await q.saveBoxingSession(session({ startedAt: 1000, rounds: rounds(6) }));
    await q.saveBoxingSession(session({ startedAt: 2000, rounds: rounds(4).map((r) => ({ ...r, workSeconds: 120, restSeconds: 30 })) }));
    expect(await q.getLastBoxingSetup()).toEqual({ rounds: 4, workSec: 120, restSec: 30 });
  });

  it("focus chips: 13 defaults, hidden ones only when asked", async () => {
    const { adapter, q } = await fresh();
    expect(await q.getFocusChips()).toHaveLength(13);
    await adapter.runAsync("UPDATE boxing_focus_chips SET is_hidden = 1 WHERE name = 'Jab'");
    expect((await q.getFocusChips()).map((c) => c.name)).not.toContain("Jab");
    expect((await q.getFocusChips({ includeHidden: true })).map((c) => c.name)).toContain("Jab");
  });

  it("a failed round insert rolls the whole session back", async () => {
    const { adapter, q } = await fresh();
    const bad = session({ rounds: [{ ...rounds(1)[0], workSeconds: null as unknown as number }] });
    await expect(q.saveBoxingSession(bad)).rejects.toThrow();
    expect(await adapter.getAllAsync("SELECT 1 FROM workouts")).toHaveLength(0);
  });
});

// ─── Audit: a boxing row (zero sets) must not change any lift number ───────────
const DAY = 86400;
const nowSecs = () => Math.floor(Date.now() / 1000);

async function addLift(a: { runAsync: (s: string, p?: unknown[]) => Promise<{ lastInsertRowId: number }>; getFirstAsync: <T>(s: string, p?: unknown[]) => Promise<T | null> },
  startedAt: number, exercise = "Barbell Bench Press", weight = 135, rating: number | null = null) {
  const w = await a.runAsync(
    "INSERT INTO workouts (name, started_at, finished_at, duration_seconds, rating) VALUES ('Workout', ?, ?, 3600, ?)",
    [startedAt, startedAt + 3600, rating]);
  const ex = (await a.getFirstAsync<{ id: number }>("SELECT id FROM exercises WHERE name = ?", [exercise]))!.id;
  const le = await a.runAsync(
    "INSERT INTO logged_exercises (workout_id, exercise_id, exercise_name, order_index) VALUES (?, ?, ?, 0)", [w.lastInsertRowId, ex, exercise]);
  await a.runAsync(
    "INSERT INTO logged_sets (logged_exercise_id, set_number, weight_lbs, reps, is_completed, completed_at) VALUES (?, 1, ?, 5, 1, ?)",
    [le.lastInsertRowId, weight, startedAt + 600]);
  return w.lastInsertRowId;
}

/** Seeds lifts, runs `snap` (returns plain data), adds boxing sessions (some today and some with big RPE), runs `snap` again. */
async function liftUnchangedByBoxing<T>(snap: (ctx: Awaited<ReturnType<typeof fresh>>, liftIds: number[]) => Promise<T>) {
  const ctx = await fresh();
  const t = nowSecs();
  const ids = [
    await addLift(ctx.adapter, t - 2 * DAY, "Barbell Bench Press", 135, 4),
    await addLift(ctx.adapter, t - DAY, "Barbell Bench Press", 145, 5),
    await addLift(ctx.adapter, t - 3600 * 5, "Pull-Up", 0, 3),
  ];
  const before = await snap(ctx, ids);
  await ctx.q.saveBoxingSession(session({ startedAt: t - 3600, finishedAt: t - 1800, durationSeconds: 1800, rounds: rounds(6) }));
  await ctx.q.saveBoxingSession(session({ startedAt: t - 3 * DAY, finishedAt: t - 3 * DAY + 900, durationSeconds: 900, rounds: rounds(1) }));
  const after = await snap(ctx, ids);
  return { before, after };
}

describe("stats queries ignore boxing rows", () => {
  it("totals, volume trend, feel trend, PRs, streak dates and weekly count are unchanged", async () => {
    const { before, after } = await liftUnchangedByBoxing(async () => {
      const stats = await import("../db/statsQueries");
      return {
        totals: await stats.getStatsTotals(),
        volume: await stats.getVolumeTrend(null),
        volume30: await stats.getVolumeTrend(30),
        feel: await stats.getFeelTrend("rating", null),
        prs: await stats.getTotalPRCount(),
        dates: await stats.getWorkoutDatesForStreak(),
        week: await stats.getWorkoutsThisWeek(),
        muscles: await stats.getVolumeByMuscle(30),
        tracked: await stats.getTrackedExercises(),
      };
    });
    expect(after).toEqual(before);
    expect(before.totals.workoutCount).toBe(3);
    expect(before.volume).toHaveLength(3);
  });
});

describe("insight + history queries ignore boxing rows", () => {
  it("insights, history rows, repeat-last and PR/ghost lookups are unchanged; detail of a boxing id does not crash", async () => {
    const { before, after } = await liftUnchangedByBoxing(async (ctx) => {
      const ins = await import("../db/insightQueries");
      const hist = await import("../db/historyQueries");
      const w = await import("../db/workoutQueries");
      const benchId = (await ctx.adapter.getFirstAsync<{ id: number }>("SELECT id FROM exercises WHERE name = 'Barbell Bench Press'"))!.id;
      const lastLift = (await ctx.adapter.getFirstAsync<{ id: number }>("SELECT id FROM workouts WHERE type = 'lift' ORDER BY started_at DESC"))!.id;
      return {
        rvr: await ins.getReadinessVsRating(),
        prior: await ins.getPriorVolumes(lastLift),
        liftHistory: await hist.getWorkoutHistory(50, 0, "", "lift"),
        search: await hist.getWorkoutHistory(50, 0, "bench"),
        repeat: await hist.getLastWorkoutExercises(),
        prs: await hist.getExercisePRs(benchId),
        csv: await hist.getAllWorkoutDataForExport(),
        ghost: await w.getGhostSets(benchId, lastLift),
      };
    });
    expect(after).toEqual(before);
    expect(before.liftHistory).toHaveLength(3);
    expect(before.liftHistory.every((r) => r.type === "lift")).toBe(true);
  });

  it("'repeat last workout' skips a newer boxing session; type filter and detail work on boxing ids", async () => {
    const { adapter, q } = await fresh();
    const t = nowSecs();
    await addLift(adapter, t - 2 * DAY);
    const box = await q.saveBoxingSession(session({ startedAt: t - 3600, finishedAt: t - 1800, rounds: rounds(2) }));
    const hist = await import("../db/historyQueries");
    expect((await hist.getLastWorkoutExercises()).map((e) => e.exerciseName)).toEqual(["Barbell Bench Press"]);
    expect((await hist.getWorkoutHistory(50, 0, "", "boxing")).map((r) => r.id)).toEqual([box]);
    expect(await hist.getWorkoutHistory(50, 0)).toHaveLength(2);
    const d = await hist.getWorkoutDetail(box);
    expect(d).toMatchObject({ type: "boxing", exercises: [], totalVolume: 0 });
  });
});

describe("misc workouts reads ignore boxing rows", () => {
  it("goal progress and program day dates are unchanged, and startup cleanup keeps finished boxing sessions", async () => {
    const { before, after } = await liftUnchangedByBoxing(async (ctx) => {
      const goalsQ = await import("../db/goalQueries");
      const benchId = (await ctx.adapter.getFirstAsync<{ id: number }>("SELECT id FROM exercises WHERE name = 'Barbell Bench Press'"))!.id;
      const g = await goalsQ.createGoal({ type: "lift_pr", title: "Bench 200", exerciseId: benchId, exerciseName: "Barbell Bench Press", targetValue: 200 });
      const goal = (await goalsQ.getGoals()).find((x) => x.id === g)!;
      return { progress: await goalsQ.getGoalProgress(goal), days: await (await import("../db/programQueries")).getLastUsedDatesByDay(1) };
    });
    expect(after).toEqual(before);
    expect(before.progress).not.toBeNull();

    const { adapter, q } = await fresh();
    const box = await q.saveBoxingSession(session());
    await (await import("../db/workoutQueries")).deleteUnfinishedWorkouts(null);
    expect(await adapter.getAllAsync("SELECT 1 FROM workouts WHERE id = ?", [box])).toHaveLength(1);
  });
});

describe("export and wipe cover boxing", () => {
  it("export has the boxing tables and workout type", async () => {
    const { q } = await fresh();
    const id = await q.saveBoxingSession(session({ rounds: rounds(2) }));
    const { buildFullExport } = await import("../db/exportJson");
    const out = await buildFullExport("1.0.0");
    expect(out.formatVersion).toBe(2);
    expect(out.tables.boxing_rounds).toHaveLength(2);
    expect(out.tables.boxing_focus_chips).toHaveLength(13);
    expect(out.tables.workouts.find((w) => w.id === id)).toMatchObject({ type: "boxing", rpe: 7 });
  });

  it("wipe removes boxing sessions and resets chips to the 13 defaults", async () => {
    const { adapter, q } = await fresh();
    await q.saveBoxingSession(session());
    await adapter.runAsync("INSERT INTO boxing_focus_chips (name, group_name, order_index) VALUES ('Slip', 'Movement', 99)");
    await adapter.runAsync("UPDATE boxing_focus_chips SET is_hidden = 1, name = 'Renamed' WHERE name = 'Jab'");
    await (await import("../db/wipe")).wipeAllData([]);
    expect(await adapter.getAllAsync("SELECT 1 FROM boxing_rounds")).toHaveLength(0);
    expect(await adapter.getAllAsync("SELECT 1 FROM workouts")).toHaveLength(0);
    const chips = await q.getFocusChips();
    expect(chips).toHaveLength(13);
    expect(chips.map((c) => c.name)).toContain("Jab");
    expect(chips.every((c) => c.isDefault)).toBe(true);
  });
});

describe("boxing snapshot", () => {
  const timer = () => createTimer({ rounds: 3, workSec: 30, restSec: 10, getReadySec: 5 }, 1_000_000);
  const snap = { timer: timer(), roundLog: [{ rpe: 7, focusTags: [1, 2], focusNote: "x" }], tagsDraft: ["Heavy bag"] };

  it("round-trips, including through the kv store", async () => {
    expect(parseSnapshot(serializeSnapshot(snap))).toEqual({ kind: "boxing", v: 1, ...snap });
    await fresh();
    const { saveSnapshot, loadSnapshot, clearSnapshot } = await import("../utils/boxingSnapshot");
    expect(await loadSnapshot()).toBeNull();
    await saveSnapshot(snap);
    expect(await loadSnapshot()).toEqual({ kind: "boxing", v: 1, ...snap });
    await clearSnapshot();
    expect(await loadSnapshot()).toBeNull();
  });

  it("rejects a lifting snapshot, and a boxing one is not a valid lifting snapshot", () => {
    const lifting = serializeSession({ workoutId: 1, startedAt: 1, exercises: [] });
    expect(parseSnapshot(lifting)).toBeNull();
    expect(parseSession(serializeSnapshot(snap))).toBeNull();
  });

  it("returns null for corrupt, wrong-version or impossible snapshots", () => {
    const good = JSON.parse(serializeSnapshot(snap));
    const bad = [
      "{not json", "null", "", JSON.stringify({ ...good, v: 2 }), JSON.stringify({ ...good, kind: "lift" }),
      JSON.stringify({ ...good, timer: { ...good.timer, phaseIndex: 99 } }),
      JSON.stringify({ ...good, timer: { ...good.timer, setup: { ...good.timer.setup, rounds: 0 } } }),
      JSON.stringify({ ...good, timer: { ...good.timer, rounds: [] } }),
      JSON.stringify({ ...good, roundLog: "x" }),
    ];
    for (const b of bad) expect(parseSnapshot(b)).toBeNull();
  });
});

describe("round log carry-over", () => {
  const blank = () => Array.from({ length: 4 }, () => ({ rpe: null as number | null, focusTags: [] as number[], focusNote: "" }));

  it("chips picked for a round pre-select for the untouched rounds after it", () => {
    const log = updateRoundLog(blank(), 0, { focusTags: [1, 2] });
    expect(log.map((e) => e.focusTags)).toEqual([[1, 2], [1, 2], [1, 2], [1, 2]]);
  });
  it("stops at a round the user changed on its own, and never touches earlier rounds", () => {
    let log = updateRoundLog(blank(), 0, { focusTags: [1] });
    log = updateRoundLog(log, 2, { focusTags: [5] }); // round 3 diverges (and carries to round 4)
    log = updateRoundLog(log, 1, { focusTags: [1, 3] }); // round 2 changes: round 3 diverged, so it keeps [5]
    expect(log.map((e) => e.focusTags)).toEqual([[1], [1, 3], [5], [5]]);
  });
  it("rpe and notes are per round only", () => {
    const log = updateRoundLog(blank(), 1, { rpe: 8, focusNote: "sharp" });
    expect(log.map((e) => e.rpe)).toEqual([null, 8, null, null]);
    expect(log.map((e) => e.focusNote)).toEqual(["", "sharp", "", ""]);
  });
});

describe("boxing recap", () => {
  const withRpes = (rpes: (number | null)[], o: Partial<BoxingSession> = {}) =>
    session({ rounds: rpes.map((rpe, i) => ({ ...rounds(1)[0], roundNumber: i + 1, rpe })), ...o });

  it("sums work/rest using actual seconds where they differ, and averages only rounds that have an RPE", () => {
    const s = session({ rpe: null, rounds: [
      { ...rounds(1)[0], roundNumber: 1, rpe: 6, actualWorkSeconds: 210 },
      { ...rounds(1)[0], roundNumber: 2, rpe: null, restSeconds: 60, actualRestSeconds: 20 },
      { ...rounds(1)[0], roundNumber: 3, rpe: 8, restSeconds: 0 },
    ] });
    const r = buildRecap(s, []);
    expect(r).toMatchObject({ rounds: 3, workSec: 210 + 180 + 180, restSec: 60 + 20 + 0, avgRpe: 7, comparison: null });
    expect(r.rpePoints.map((p) => p.rpe)).toEqual([6, null, 8]);
  });

  it("no round RPEs: falls back to the overall RPE, else null, and never NaN", () => {
    expect(buildRecap(withRpes([null, null], { rpe: 8 }), []).avgRpe).toBe(8);
    expect(buildRecap(withRpes([null, null], { rpe: null }), []).avgRpe).toBeNull();
    expect(buildRecap(withRpes([]), []).rounds).toBe(0);
    expect(sessionAvgRpe([], null)).toBeNull();
  });

  it("comparison needs 3 prior sessions with an RPE; then harder / easier / about the same", () => {
    const s = withRpes([8, 8]);
    expect(buildRecap(s, [6, 6]).comparison).toBeNull();
    expect(buildRecap(s, [6, null, 6, null]).comparison).toBeNull(); // only 2 usable
    expect(buildRecap(s, [6, 6, 6]).comparison).toMatchObject({ verdict: "harder", usualRpe: 6 });
    expect(buildRecap(s, [9, 9, 9]).comparison?.verdict).toBe("easier");
    expect(buildRecap(s, [8, 7.8, 8.2]).comparison?.verdict).toBe("about the same");
    expect(buildRecap(withRpes([null], { rpe: null }), [6, 6, 6]).comparison).toBeNull(); // nothing to compare
  });

  it("getPriorAvgRpes: newest first, excludes itself and later sessions", async () => {
    const { q } = await fresh();
    const a = await q.saveBoxingSession(withRpes([4, 6], { startedAt: 1000 }));
    const b = await q.saveBoxingSession(withRpes([null], { startedAt: 2000, rpe: 7 }));
    const c = await q.saveBoxingSession(withRpes([9], { startedAt: 3000 }));
    const later = await q.saveBoxingSession(withRpes([1], { startedAt: 9000 }));
    expect(later).toBeGreaterThan(c);
    expect(await q.getPriorAvgRpes(3000, c)).toEqual([7, 5]);
    expect(a).toBeLessThan(b);
  });
});

describe("history rows for boxing", () => {
  it("carry round count and avg RPE; lifts report 0 rounds", async () => {
    const { adapter, q } = await fresh();
    const hist = await import("../db/historyQueries");
    await addLift(adapter, nowSecs() - 5 * DAY);
    await q.saveBoxingSession(session({ rpe: 9, rounds: rounds(3).map((r, i) => ({ ...r, rpe: [4, 6, null][i] })) }));
    await q.saveBoxingSession(session({ startedAt: 5, rpe: 8, rounds: rounds(2) }));
    const rows = await hist.getWorkoutHistory(10);
    const box = rows.filter((r) => r.type === "boxing");
    expect(box.map((r) => [r.round_count, r.avg_rpe])).toEqual([[3, 5], [2, 8]]); // round avg first, else overall
    expect(rows.find((r) => r.type === "lift")).toMatchObject({ round_count: 0, avg_rpe: null });
  });
});
