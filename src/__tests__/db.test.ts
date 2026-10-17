// Runs the real query/migration code against in-memory SQLite (better-sqlite3 behind an expo-sqlite-shaped adapter).
import { setupDb, createAdapter, type TestDb } from "./helpers/sqlite";

const DAY = 86400;
const now = () => Math.floor(Date.now() / 1000);

type SetSpec = { w: number | null; r: number | null; warm?: boolean; done?: boolean };

async function fresh() {
  const ctx = await setupDb();
  await ctx.init();
  return { ...ctx, q: await queries() };
}

async function queries() {
  return {
    stats: await import("../db/statsQueries"),
    history: await import("../db/historyQueries"),
    workouts: await import("../db/workoutQueries"),
    goals: await import("../db/goalQueries"),
  };
}

const exId = async (a: TestDb, name: string) =>
  (await a.getFirstAsync<{ id: number }>("SELECT id FROM exercises WHERE name = ?", [name]))!.id;

/** Insert a workout (finished unless told otherwise) with the given exercises/sets via raw SQL, for full control of timestamps. */
async function addWorkout(
  a: TestDb,
  exercises: Record<string, SetSpec[]>,
  o: { startedAt?: number; finished?: boolean; name?: string } = {}
) {
  const startedAt = o.startedAt ?? now();
  const w = await a.runAsync(
    "INSERT INTO workouts (name, started_at, finished_at, duration_seconds) VALUES (?, ?, ?, 3600)",
    [o.name ?? "Workout", startedAt, o.finished === false ? null : startedAt + 3600]
  );
  let order = 0;
  for (const [name, sets] of Object.entries(exercises)) {
    const le = await a.runAsync(
      "INSERT INTO logged_exercises (workout_id, exercise_id, exercise_name, order_index) VALUES (?, ?, ?, ?)",
      [w.lastInsertRowId, await exId(a, name), name, order++]
    );
    let n = 1;
    for (const s of sets) {
      await a.runAsync(
        "INSERT INTO logged_sets (logged_exercise_id, set_number, weight_lbs, reps, is_warmup, is_completed) VALUES (?, ?, ?, ?, ?, ?)",
        [le.lastInsertRowId, n++, s.w, s.r, s.warm ? 1 : 0, s.done === false ? 0 : 1]
      );
    }
  }
  return w.lastInsertRowId;
}

describe("seeding", () => {
  it("upgrade path adds missing exercises without duplicating existing names", async () => {
    const { adapter, init } = await fresh();
    const total = (await adapter.getFirstAsync<{ n: number }>("SELECT COUNT(*) n FROM exercises"))!.n;
    await adapter.runAsync("DELETE FROM kv_store WHERE key = '@konafit_exercises_v2'");
    await adapter.runAsync("UPDATE exercises SET name = LOWER(name) WHERE name = 'Pull-Up'"); // case differs from the seed list
    await adapter.runAsync("DELETE FROM exercises WHERE name = 'Dip'");
    await init();
    const n = (await adapter.getFirstAsync<{ n: number }>("SELECT COUNT(*) n FROM exercises"))!.n;
    expect(n).toBe(total); // Dip came back, pull-up was not added a second time
    expect(await adapter.getAllAsync("SELECT 1 FROM exercises WHERE LOWER(name) = 'pull-up'")).toHaveLength(1);
    expect(await adapter.getAllAsync("SELECT 1 FROM exercises WHERE name = 'Dip'")).toHaveLength(1);
  });

  // Open item in FINDINGS.md (Round 2, "Fresh installs get duplicate exercises"). Remove `.failing` when it's fixed.
  it.failing("a fresh install has no duplicate exercise names", async () => {
    const { adapter } = await fresh();
    const dupes = await adapter.getAllAsync("SELECT LOWER(name) FROM exercises GROUP BY LOWER(name) HAVING COUNT(*) > 1");
    expect(dupes).toEqual([]);
  });
});

describe("migrations", () => {
  const MIGRATION_COLUMNS: [string, string][] = [
    ["exercises", "target_type"], ["exercises", "is_custom"], ["exercises", "is_deleted"], ["exercises", "notes"],
    ["lifestyle_logs", "caffeine_mg"], ["programs", "program_type"], ["programs", "workout_duration_min"],
    ["programs", "focus_tags"], ["programs", "equipment"], ["programs", "difficulty"], ["programs", "archived"],
    ["goals", "target_reps"], ["logged_sets", "notes"],
  ];
  const version = async (a: TestDb) => (await a.getFirstAsync<{ user_version: number }>("PRAGMA user_version"))!.user_version;
  const columns = async (a: TestDb, t: string) =>
    (await a.getAllAsync<{ name: string }>(`PRAGMA table_info(${t})`)).map((c) => c.name);

  /** Roll a current DB back to look like a pre-versioning install (no migration columns, user_version 0). */
  async function downgrade(a: TestDb) {
    for (const [t, c] of MIGRATION_COLUMNS) await a.execAsync(`ALTER TABLE ${t} DROP COLUMN ${c}`);
    await a.execAsync("CREATE TABLE exercises_fts (name TEXT); PRAGMA user_version = 0");
  }

  it("a fresh install ends at the latest version, and a second launch changes nothing", async () => {
    const { adapter, init } = await fresh();
    const v = await version(adapter);
    expect(v).toBeGreaterThanOrEqual(4);
    await init();
    expect(await version(adapter)).toBe(v);
  });

  it("upgrades a pre-versioning install: adds columns, backfills once, drops exercises_fts", async () => {
    const { adapter, init } = await fresh();
    const done = await addWorkout(adapter, {
      "Barbell Bench Press": [{ w: 135, r: 5, done: false }, { w: null, r: 5, done: false }],
      "Pull-Up": [{ w: null, r: 8, done: false }],
    });
    await downgrade(adapter);

    await init();
    for (const [t, c] of MIGRATION_COLUMNS) expect(await columns(adapter, t)).toContain(c);
    expect(await adapter.getAllAsync("SELECT 1 FROM sqlite_master WHERE name = 'exercises_fts'")).toHaveLength(0);

    // migration 1: finished-workout set with weight+reps gets completed; the one without weight stays open
    const sets = await adapter.getAllAsync<{ weight_lbs: number | null; is_completed: number; name: string }>(
      `SELECT ls.weight_lbs, ls.is_completed, le.exercise_name AS name FROM logged_sets ls
       JOIN logged_exercises le ON le.id = ls.logged_exercise_id WHERE le.workout_id = ? ORDER BY ls.id`, [done]);
    expect(sets.map((s) => s.is_completed)).toEqual([1, 0, 0]); // only bench 135x5 had weight+reps when migration 1 ran
    // migration 4: the bodyweight set with reps and no weight now stores 0 added load
    expect(sets[2].weight_lbs).toBe(0);
    expect(sets[1].weight_lbs).toBeNull(); // barbell stays NULL
  });

  it("does not re-run the is_completed backfill on later launches", async () => {
    const { adapter, init } = await fresh();
    await addWorkout(adapter, { "Barbell Bench Press": [{ w: 135, r: 5 }] });
    await adapter.runAsync("UPDATE logged_sets SET is_completed = 0"); // user un-ticks it in the edit screen
    await init();
    expect((await adapter.getFirstAsync<{ is_completed: number }>("SELECT is_completed FROM logged_sets"))!.is_completed).toBe(0);
  });

  it("from an old user_version only runs the migrations after it", async () => {
    const { adapter, init } = await fresh();
    await addWorkout(adapter, { "Barbell Bench Press": [{ w: 135, r: 5, done: false }], "Dip": [{ w: null, r: 10 }] });
    await adapter.execAsync("PRAGMA user_version = 3");
    await init();
    expect(await version(adapter)).toBeGreaterThanOrEqual(4);
    // migration 1 (the backfill) did not run again...
    expect((await adapter.getFirstAsync<{ c: number }>(
      "SELECT is_completed c FROM logged_sets WHERE weight_lbs = 135"))!.c).toBe(0);
    // ...but migration 4 did
    expect((await adapter.getFirstAsync<{ w: number | null }>(
      "SELECT weight_lbs w FROM logged_sets WHERE reps = 10"))!.w).toBe(0);
  });
});

describe("finalizeWorkout", () => {
  it("completes filled sets, stamps the finish, and names the workout from its muscles", async () => {
    const { adapter, q } = await fresh();
    const id = await q.workouts.createWorkout();
    const bench = await q.workouts.createLoggedExercise(id, await exId(adapter, "Barbell Bench Press"), "Barbell Bench Press", 0);
    for (const [n, w, r] of [[1, 135, 5], [2, 135, 0], [3, null, 5]] as const) {
      await adapter.runAsync("INSERT INTO logged_sets (logged_exercise_id, set_number, weight_lbs, reps) VALUES (?, ?, ?, ?)", [bench, n, w, r]);
    }
    await q.workouts.finalizeWorkout(id, "Home Gym");
    const w = (await adapter.getFirstAsync<{ name: string; finished_at: number | null; location: string }>(
      "SELECT name, finished_at, location FROM workouts WHERE id = ?", [id]))!;
    expect(w.finished_at).not.toBeNull();
    expect(w.location).toBe("Home Gym");
    expect(w.name).toMatch(/^Chest · /);
    const done = await adapter.getAllAsync<{ is_completed: number }>("SELECT is_completed FROM logged_sets ORDER BY set_number");
    expect(done.map((s) => s.is_completed)).toEqual([1, 0, 0]); // zero reps and blank weight are not auto-completed
  });

  it("keeps a name the user (or a program day) already set", async () => {
    const { adapter, q } = await fresh();
    const id = await q.workouts.createWorkout();
    await adapter.runAsync("UPDATE workouts SET name = 'Leg Day' WHERE id = ?", [id]);
    await q.workouts.finalizeWorkout(id);
    expect((await adapter.getFirstAsync<{ name: string }>("SELECT name FROM workouts WHERE id = ?", [id]))!.name).toBe("Leg Day");
  });
});

describe("streak", () => {
  it("only counts days with a finished workout that has a completed set", async () => {
    const { adapter, q } = await fresh();
    const t = now();
    await addWorkout(adapter, { "Barbell Bench Press": [{ w: 135, r: 5 }] }, { startedAt: t });                    // today, real
    await addWorkout(adapter, {}, { startedAt: t - DAY });                                                        // yesterday: finished but empty
    await addWorkout(adapter, { "Barbell Bench Press": [{ w: 135, r: 5, done: false }] }, { startedAt: t - 2 * DAY }); // nothing ticked
    await addWorkout(adapter, { "Barbell Bench Press": [{ w: 135, r: 5 }] }, { startedAt: t - 3 * DAY, finished: false }); // never finished
    const dates = await q.stats.getWorkoutDatesForStreak();
    expect(dates).toHaveLength(1);
    expect(q.stats.calculateStreak(dates)).toBe(1);
  });

  it("counts consecutive real days", async () => {
    const { adapter, q } = await fresh();
    const t = now();
    for (const back of [0, 1, 2, 4]) await addWorkout(adapter, { "Barbell Bench Press": [{ w: 100, r: 5 }] }, { startedAt: t - back * DAY });
    expect(q.stats.calculateStreak(await q.stats.getWorkoutDatesForStreak())).toBe(3);
  });
});

describe("PR counting", () => {
  it("counts a new best working weight, not first appearances, ties, warmups or unfinished workouts", async () => {
    const { adapter, q } = await fresh();
    const t = now();
    const bench = "Barbell Bench Press";
    await addWorkout(adapter, { [bench]: [{ w: 100, r: 5 }], "Barbell Back Squat": [{ w: 200, r: 5 }] }, { startedAt: t - 5 * DAY }); // first time: no PR
    await addWorkout(adapter, { [bench]: [{ w: 110, r: 5 }] }, { startedAt: t - 4 * DAY });                                       // PR
    await addWorkout(adapter, { [bench]: [{ w: 105, r: 5 }] }, { startedAt: t - 3 * DAY });                                       // lower
    await addWorkout(adapter, { [bench]: [{ w: 110, r: 5 }] }, { startedAt: t - 2 * DAY });                                       // tie
    await addWorkout(adapter, { [bench]: [{ w: 300, r: 1, warm: true }] }, { startedAt: t - 1 * DAY });                           // warmup
    await addWorkout(adapter, { [bench]: [{ w: 400, r: 1 }] }, { startedAt: t, finished: false });                                // in progress
    expect(await q.stats.getTotalPRCount()).toBe(1);
  });
});

describe("volume", () => {
  it("agrees across stats, history, detail, trend and muscle queries, with bodyweight as added load", async () => {
    const { adapter, q } = await fresh();
    await q.stats.logBodyweight(180);
    const id = await addWorkout(adapter, {
      "Barbell Bench Press": [{ w: 100, r: 5 }],                       // 500
      "Pull-Up": [{ w: 10, r: 8 }, { w: -50, r: 5 }, { w: 0, r: 10 }], // 190*8 + 130*5 + 180*10 = 1520 + 650 + 1800
    });
    const expected = 500 + 1520 + 650 + 1800;

    expect((await q.stats.getStatsTotals()).totalLifted).toBe(expected);
    expect((await q.history.getWorkoutHistory())[0].total_volume).toBe(expected);
    expect((await q.history.getWorkoutDetail(id))!.totalVolume).toBe(expected);
    expect((await q.stats.getVolumeTrend(null))[0].y).toBe(expected);
    const byMuscle = await q.stats.getVolumeByMuscle(30);
    expect(byMuscle.reduce((sum, m) => sum + m.volumeLbs, 0)).toBe(expected);
  });

  it("never lets an assist larger than bodyweight make a set negative", async () => {
    const { adapter, q } = await fresh();
    await q.stats.logBodyweight(150);
    await addWorkout(adapter, { "Pull-Up": [{ w: -200, r: 5 }] });
    expect((await q.stats.getStatsTotals()).totalLifted).toBe(0);
  });

  it("uses the latest bodyweight, and counts bodyweight sets as plain added weight when none is logged", async () => {
    const { adapter, q } = await fresh();
    await addWorkout(adapter, { "Dip": [{ w: 25, r: 10 }] });
    expect((await q.stats.getStatsTotals()).totalLifted).toBe(250);
    await q.stats.logBodyweight(200);
    expect((await q.stats.getStatsTotals()).totalLifted).toBe(2250);
  });
});

describe("bodyweight exercises", () => {
  it("store a blank weight as 0 added load (barbell stays NULL) when a set is saved", async () => {
    const { adapter, q } = await fresh();
    const w = await q.workouts.createWorkout();
    const pull = await q.workouts.createLoggedExercise(w, await exId(adapter, "Pull-Up"), "Pull-Up", 0);
    const bench = await q.workouts.createLoggedExercise(w, await exId(adapter, "Barbell Bench Press"), "Barbell Bench Press", 1);
    const base = { localId: "x", setNumber: 1, weightLbs: "", reps: "8", rpe: "", isWarmup: false, isCompleted: true };
    await q.workouts.upsertLoggedSet({ ...base, loggedExerciseId: pull });
    await q.workouts.upsertLoggedSet({ ...base, loggedExerciseId: bench });
    const pullSetId = (await adapter.getFirstAsync<{ id: number }>("SELECT id FROM logged_sets WHERE logged_exercise_id = ?", [pull]))!.id;
    await q.workouts.upsertLoggedSet({ ...base, dbId: pullSetId, weightLbs: "-", loggedExerciseId: pull }); // lone minus while typing
    const rows = await adapter.getAllAsync<{ weight_lbs: number | null }>("SELECT weight_lbs FROM logged_sets ORDER BY id");
    expect(rows.map((r) => r.weight_lbs)).toEqual([0, null]);
  });

  it("estimate 1RM and PRs from effective load", async () => {
    const { adapter, q } = await fresh();
    await q.stats.logBodyweight(180);
    await addWorkout(adapter, { "Pull-Up": [{ w: 10, r: 8 }, { w: -50, r: 5 }] });
    const id = await exId(adapter, "Pull-Up");
    expect((await q.stats.getOneRMHistory(id))[0].oneRM).toBe(Math.round(190 * (1 + 8 / 30)));
    const prs = await q.history.getExercisePRs(id);
    expect(prs.maxOneRM).toMatchObject({ weightLbs: 190, reps: 8 });
    expect(prs.maxVolume).toMatchObject({ weightLbs: 190, reps: 8 }); // 1520 beats 650
    expect(prs.maxWeight.weightLbs).toBe(10); // the raw added weight is still the "weight PR"
  });
});

describe("bodyweight log", () => {
  it("lists newest first, edits and deletes, and the Stats value follows", async () => {
    const { adapter, q } = await fresh();
    await adapter.runAsync("INSERT INTO bodyweight_logs (weight_lbs, logged_at) VALUES (180, 1000), (1850, 2000)");
    expect((await q.stats.getBodyweightHistory()).map((e) => e.weight_lbs)).toEqual([1850, 180]);
    expect(await q.stats.getLatestBodyweight()).toBe(1850);

    const typo = (await q.stats.getBodyweightHistory())[0];
    await q.stats.updateBodyweight(typo.id, 185);
    expect(await q.stats.getLatestBodyweight()).toBe(185);
    await q.stats.deleteBodyweight(typo.id);
    expect(await q.stats.getLatestBodyweight()).toBe(180);
  });

  it("breaks same-second ties by insertion order", async () => {
    const { adapter, q } = await fresh();
    await adapter.runAsync("INSERT INTO bodyweight_logs (weight_lbs, logged_at) VALUES (180, 1000), (182, 1000)");
    expect(await q.stats.getLatestBodyweight()).toBe(182);
  });
});

describe("history paging and filter", () => {
  it("pages without overlap, newest first, and filters by exercise words", async () => {
    const { adapter, q } = await fresh();
    const t = now();
    for (let i = 0; i < 5; i++) {
      await addWorkout(adapter, i % 2 === 0 ? { "Barbell Bench Press": [{ w: 100, r: 5 }] } : { "Barbell Back Squat": [{ w: 100, r: 5 }] }, { startedAt: t - i * DAY });
    }
    const page1 = await q.history.getWorkoutHistory(2, 0);
    const page2 = await q.history.getWorkoutHistory(2, 2);
    const page3 = await q.history.getWorkoutHistory(2, 4);
    const all = [...page1, ...page2, ...page3];
    expect(all.map((w) => w.started_at)).toEqual([...all.map((w) => w.started_at)].sort((a, b) => b - a));
    expect(new Set(all.map((w) => w.id)).size).toBe(5);
    expect(page3).toHaveLength(1);

    expect(await q.history.getWorkoutHistory(50, 0, "bench")).toHaveLength(3);
    expect(await q.history.getWorkoutHistory(50, 0, "press bench")).toHaveLength(3); // any word order
    expect(await q.history.getWorkoutHistory(50, 0, "squat")).toHaveLength(2);
    expect(await q.history.getWorkoutHistory(50, 0, "deadlift")).toHaveLength(0);
    expect((await q.history.getWorkoutHistory(50, 0, "bench"))[0].exercise_count).toBe(1); // totals are not narrowed by the filter
  });
});

describe("adapter", () => {
  it("rolls a failed transaction back", async () => {
    const a = createAdapter();
    await a.execAsync("CREATE TABLE t (x INTEGER)");
    await expect(a.withTransactionAsync(async () => { await a.runAsync("INSERT INTO t VALUES (1)"); throw new Error("boom"); })).rejects.toThrow("boom");
    expect(await a.getAllAsync("SELECT * FROM t")).toEqual([]);
  });
});
