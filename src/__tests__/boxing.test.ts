// Boxing DB tests: runs the real queries against in-memory SQLite.
import { setupDb } from "./helpers/sqlite";
import type { BoxingSession } from "../types/boxing";

async function fresh() {
  const ctx = await setupDb();
  await ctx.init();
  return { ...ctx, q: await import("../db/boxingQueries") };
}

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
