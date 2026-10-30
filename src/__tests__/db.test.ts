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

  it("a fresh install has no duplicate exercise names", async () => {
    const { adapter } = await fresh();
    const dupes = await adapter.getAllAsync("SELECT LOWER(name) FROM exercises GROUP BY LOWER(name) HAVING COUNT(*) > 1");
    expect(dupes).toEqual([]);
  });
});

describe("migrations", () => {
  const MIGRATION_COLUMNS: [string, string][] = [
    ["exercises", "target_type"], ["exercises", "is_custom"], ["exercises", "is_deleted"], ["exercises", "notes"],
    ["programs", "program_type"], ["programs", "workout_duration_min"],
    ["programs", "focus_tags"], ["programs", "equipment"], ["programs", "difficulty"], ["programs", "archived"],
    ["goals", "target_reps"], ["logged_sets", "notes"],
    ["logged_sets", "completed_at"], ["goals", "start_value"], ["goals", "direction"],
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
  it("counts only ticked sets, stamps the finish, and names the workout from its muscles", async () => {
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
    expect(done.map((s) => s.is_completed)).toEqual([0, 0, 0]); // filled-in but never ticked: not counted
  });

  it("ends the workout 2 minutes after the last ticked set, not whenever Finish was tapped", async () => {
    const { adapter, q } = await fresh();
    const t = now();
    const id = (await adapter.runAsync("INSERT INTO workouts (name, started_at) VALUES ('Workout', ?)", [t - 3 * 3600])).lastInsertRowId;
    const le = await q.workouts.createLoggedExercise(id, await exId(adapter, "Barbell Bench Press"), "Barbell Bench Press", 0);
    const setId = await q.workouts.createLoggedSet(le, 1);
    await q.workouts.upsertLoggedSet({ dbId: setId, localId: "x", setNumber: 1, weightLbs: "135", reps: "5", rpe: "", isWarmup: false, isCompleted: true, loggedExerciseId: le });
    await adapter.runAsync("UPDATE logged_sets SET completed_at = ?", [t - 2 * 3600]); // ticked 2 h ago, then lunch
    await q.workouts.finalizeWorkout(id);
    const w = (await adapter.getFirstAsync<{ finished_at: number; duration_seconds: number }>("SELECT finished_at, duration_seconds FROM workouts WHERE id = ?", [id]))!;
    expect(w.duration_seconds).toBe(3600 + 120);
    expect(w.finished_at).toBe(t - 3 * 3600 + 3600 + 120);
  });

  it("stamps completed_at when a set is first ticked and keeps it on later edits", async () => {
    const { adapter, q } = await fresh();
    const id = await q.workouts.createWorkout();
    const le = await q.workouts.createLoggedExercise(id, await exId(adapter, "Barbell Bench Press"), "Barbell Bench Press", 0);
    const setId = await q.workouts.createLoggedSet(le, 1);
    const base = { dbId: setId, localId: "x", setNumber: 1, weightLbs: "135", reps: "5", rpe: "", isWarmup: false, loggedExerciseId: le };
    const at = async () => (await adapter.getFirstAsync<{ c: number | null }>("SELECT completed_at c FROM logged_sets WHERE id = ?", [setId]))!.c;
    await q.workouts.upsertLoggedSet({ ...base, isCompleted: false });
    expect(await at()).toBeNull();
    await q.workouts.upsertLoggedSet({ ...base, isCompleted: true });
    const first = await at();
    expect(first).not.toBeNull();
    await adapter.runAsync("UPDATE logged_sets SET completed_at = ?", [first! - 50]);
    await q.workouts.upsertLoggedSet({ ...base, reps: "6", isCompleted: true });
    expect(await at()).toBe(first! - 50);
    await q.workouts.upsertLoggedSet({ ...base, isCompleted: false });
    expect(await at()).toBeNull();
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

describe("startup", () => {
  it("turns foreign keys on, so deleting a workout cascades", async () => {
    const { adapter, q } = await fresh();
    expect((await adapter.getFirstAsync<{ foreign_keys: number }>("PRAGMA foreign_keys"))!.foreign_keys).toBe(1);
    const id = await addWorkout(adapter, { "Barbell Bench Press": [{ w: 100, r: 5 }] });
    await q.workouts.deleteWorkout(id);
    expect(await adapter.getAllAsync("SELECT 1 FROM logged_sets")).toHaveLength(0);
  });

  it("deleteUnfinishedWorkouts keeps finished ones and the one a saved session can resume", async () => {
    const { adapter, q } = await fresh();
    const done = await addWorkout(adapter, { "Barbell Bench Press": [{ w: 100, r: 5 }] });
    const resumable = await addWorkout(adapter, { "Barbell Bench Press": [{ w: 100, r: 5 }] }, { finished: false });
    const leftover = await addWorkout(adapter, {}, { finished: false });
    await q.workouts.deleteUnfinishedWorkouts(resumable);
    const ids = (await adapter.getAllAsync<{ id: number }>("SELECT id FROM workouts ORDER BY id")).map((r) => r.id);
    expect(ids).toEqual([done, resumable]);
    expect(ids).not.toContain(leftover);
    await q.workouts.deleteUnfinishedWorkouts(null);
    expect(await adapter.getAllAsync("SELECT 1 FROM workouts WHERE id = ?", [resumable])).toHaveLength(0);
  });
});

describe("Wipe All Data", () => {
  it("clears kvStore's cache, so wiped keys don't come back from memory, and keeps settings", async () => {
    const { adapter } = await fresh();
    const { kvStore } = await import("../utils/kvStore");
    const { wipeAllData } = await import("../db/wipe");
    await kvStore.setItem("@konafit_last_prs", "[\"Squat\"]");
    await kvStore.setItem("@konafit_weekly_goal", "5");
    expect(await kvStore.getItem("@konafit_last_prs")).toBe("[\"Squat\"]"); // now cached
    await addWorkout(adapter, { "Barbell Bench Press": [{ w: 100, r: 5 }] });
    await wipeAllData(["@konafit_weekly_goal"]);
    expect(await kvStore.getItem("@konafit_last_prs")).toBeNull();
    expect(await kvStore.getItem("@konafit_weekly_goal")).toBe("5");
    expect(await adapter.getAllAsync("SELECT 1 FROM workouts")).toHaveLength(0);
  });
});

describe("volume rule", () => {
  it("counts only ticked working sets of finished workouts, everywhere", async () => {
    const { adapter, q } = await fresh();
    const id = await addWorkout(adapter, {
      "Barbell Bench Press": [{ w: 100, r: 5 }, { w: 45, r: 10, warm: true }, { w: 100, r: 5, done: false }], // only 500 counts
    });
    await addWorkout(adapter, { "Barbell Bench Press": [{ w: 400, r: 5 }] }, { finished: false });            // in progress: 0
    expect((await q.stats.getStatsTotals()).totalLifted).toBe(500);
    expect((await q.history.getWorkoutHistory())[0].total_volume).toBe(500);
    expect((await q.history.getWorkoutDetail(id))!.totalVolume).toBe(500);
    expect((await q.stats.getVolumeTrend(null))[0].y).toBe(500);
    expect((await q.stats.getVolumeByMuscle(30)).reduce((n, m) => n + m.volumeLbs, 0)).toBe(500);
  });
});

describe("1RM", () => {
  it("SQL and JS agree, and a 30-rep set is not a 2x max", async () => {
    const { estimateOneRm } = await import("../utils/oneRm");
    const { oneRmSql } = await import("../db/sqlFragments");
    const { adapter } = await fresh();
    for (const [w, r] of [[100, 1], [100, 5], [100, 12], [100, 30]] as const) {
      const sql = (await adapter.getFirstAsync<{ v: number }>(`SELECT ${oneRmSql("?", "?")} AS v`, [w, r]))!.v;
      expect(sql).toBeCloseTo(estimateOneRm(w, r), 6);
    }
    expect(estimateOneRm(100, 30)).toBeCloseTo(140); // capped at 12 reps
  });
});

describe("PR count", () => {
  it("ignores a typo'd weight instead of letting it block every later PR", async () => {
    const { adapter, q } = await fresh();
    const t = now();
    const bench = "Barbell Bench Press";
    await addWorkout(adapter, { [bench]: [{ w: 225, r: 5 }] }, { startedAt: t - 4 * DAY });
    await addWorkout(adapter, { [bench]: [{ w: 2250, r: 5 }] }, { startedAt: t - 3 * DAY }); // meant 225
    await addWorkout(adapter, { [bench]: [{ w: 230, r: 5 }] }, { startedAt: t - 2 * DAY });  // real PR
    expect(await q.stats.getTotalPRCount()).toBe(1);
  });
});

describe("live PR badges vs history", () => {
  it("getHistPRs and getExercisePRs agree on the same working sets, and ignore unfinished workouts", async () => {
    const { adapter, q } = await fresh();
    const t = now();
    const bench = "Barbell Bench Press";
    await addWorkout(adapter, { [bench]: [{ w: 135, r: 8 }, { w: 185, r: 3 }, { w: 95, r: 12, warm: true }] }, { startedAt: t - DAY });
    const open = await addWorkout(adapter, { [bench]: [{ w: 400, r: 20 }] }, { finished: false });
    const id = await exId(adapter, bench);
    const hist = await q.history.getHistPRs(id, open + 1);
    const prs = await q.history.getExercisePRs(id);
    expect(hist.maxWeight).toBe(prs.maxWeight.weightLbs);
    expect(hist.maxReps).toBe(prs.maxReps.reps);
    expect(hist.maxVolume).toBe(prs.maxVolume.weightLbs! * prs.maxVolume.reps!);
    expect(hist.maxWeight).toBe(185);
  });

  it("a bodyweight exercise gets a volume PR from more reps at the same load", async () => {
    const { computePRBadges } = await import("../utils/prBadges");
    const { adapter, q } = await fresh();
    await q.stats.logBodyweight(180);
    await addWorkout(adapter, { "Pull-Up": [{ w: 0, r: 8 }] });
    const id = await exId(adapter, "Pull-Up");
    const hist = await q.history.getHistPRs(id, -1);
    expect(hist.maxVolume).toBe(180 * 8);
    const ex = { sets: [], isBodyweight: true } as never;
    expect(computePRBadges(ex, "new", 0, 9, hist)).toContain("V");
    expect(computePRBadges(ex, "new", 0, 8, hist)).not.toContain("V");
    // no bodyweight logged: reps alone still rank
    const { adapter: a2, q: q2 } = await fresh();
    await addWorkout(a2, { "Pull-Up": [{ w: 0, r: 8 }] });
    const h2 = await q2.history.getHistPRs(await exId(a2, "Pull-Up"), -1);
    expect(h2.maxVolume).toBe(8);
    expect(computePRBadges(ex, "new", 0, 9, h2)).toContain("V");
  });
});

describe("repeat last workout", () => {
  it("repeats ticked sets only, keeps warm-ups and supersets", async () => {
    const { adapter, q } = await fresh();
    await addWorkout(adapter, {
      "Barbell Bench Press": [{ w: 45, r: 10, warm: true }, { w: 135, r: 5 }, { w: 135, r: 5 }, { w: 135, r: 5, done: false }],
      "Dumbbell Fly": [{ w: 30, r: 10 }],
    });
    await q.workouts.setLoggedExerciseSuperset(
      (await adapter.getAllAsync<{ id: number }>("SELECT id FROM logged_exercises")).map((r) => r.id), "ss1");
    const last = await q.history.getLastWorkoutExercises();
    expect(last.map((e) => [e.exerciseName, e.targetSets, e.warmupSets, e.supersetId])).toEqual([
      ["Barbell Bench Press", 2, 1, "ss1"],
      ["Dumbbell Fly", 1, 0, "ss1"],
    ]);
  });
});

describe("save as program", () => {
  it("gives every exercise at least one set, even when none were ticked", async () => {
    const { adapter } = await fresh();
    const { createProgramFromWorkout } = await import("../db/programQueries");
    const id = await addWorkout(adapter, { "Barbell Bench Press": [{ w: 100, r: 5, done: false }], "Dip": [{ w: 0, r: 5 }, { w: 0, r: 5 }] });
    await createProgramFromWorkout(id, "P");
    const sets = await adapter.getAllAsync<{ exercise_name: string; target_sets: number }>("SELECT exercise_name, target_sets FROM program_exercises ORDER BY order_index");
    expect(sets.map((r) => r.target_sets)).toEqual([1, 2]);
  });
});

describe("custom exercises", () => {
  it("rejects a name that already exists (any case) and cleans muscle lists", async () => {
    const { q } = await fresh();
    await expect(q.workouts.createCustomExercise("barbell bench press", ["Chest"], ["barbell"], "reps")).rejects.toThrow(/already exists/);
    const ex = await q.workouts.createCustomExercise("Cable Pullover", ["Lats", " ", "lats", "Chest "], ["cable"], "reps");
    expect(ex.muscle_group).toBe("Lats, Chest");
    await expect(q.workouts.updateExercise(ex.id, { name: "Dip" })).rejects.toThrow(/already exists/);
    await q.workouts.updateExercise(ex.id, { muscleGroup: "Chest,, Lats ,Chest" });
    expect((await q.workouts.getCustomExercises())[0].muscle_group).toBe("Chest, Lats");
  });
});

describe("goals", () => {
  it("bodyweight goals remember the start and the direction", async () => {
    const { adapter, q } = await fresh();
    await q.stats.logBodyweight(200);
    const cut = await q.goals.createGoal({ type: "bodyweight", title: "cut", targetValue: 180 });
    const bulk = await q.goals.createGoal({ type: "bodyweight", title: "bulk", targetValue: 220 });
    const rows = await adapter.getAllAsync<{ start_value: number; direction: string }>("SELECT start_value, direction FROM goals ORDER BY id");
    expect(rows).toEqual([{ start_value: 200, direction: "down" }, { start_value: 200, direction: "up" }]);
    const [g1, g2] = await q.goals.getGoals();
    const goal = (id: number) => [g1, g2].find((g) => g.id === id)!;
    expect(q.goals.goalFraction(goal(cut), 190)).toBeCloseTo(0.5);
    expect(q.goals.goalFraction(goal(bulk), 190)).toBe(0); // moving the wrong way is 0, not negative
  });

  it("dates a lift goal to the workout that reached it", async () => {
    const { adapter, q } = await fresh();
    const t = now();
    const gid = await q.goals.createGoal({ type: "lift_pr", title: "bench", exerciseId: await exId(adapter, "Barbell Bench Press"), targetValue: 200, targetReps: 1 });
    await adapter.runAsync("UPDATE goals SET created_at = ?", [t - 10 * DAY]);
    await addWorkout(adapter, { "Barbell Bench Press": [{ w: 205, r: 1 }] }, { startedAt: t - 5 * DAY });
    await q.goals.markGoalAchieved(gid);
    const at = (await adapter.getFirstAsync<{ achieved_at: number }>("SELECT achieved_at FROM goals"))!.achieved_at;
    expect(at).toBe(t - 5 * DAY + 3600);
  });
});
