import { setupDb } from "./helpers/sqlite";

describe("DB doctor", () => {
  it("finds orphans, unfinished workouts and missing photos, and repairs only those", async () => {
    const { adapter: a, init } = await setupDb();
    await init();
    const ex = (await a.getFirstAsync<{ id: number }>("SELECT id FROM exercises LIMIT 1"))!.id;
    const good = (await a.runAsync("INSERT INTO workouts (name, started_at, finished_at) VALUES ('ok', 1, 2)")).lastInsertRowId;
    const open = (await a.runAsync("INSERT INTO workouts (name, started_at) VALUES ('open', 1)")).lastInsertRowId;
    const le = (await a.runAsync("INSERT INTO logged_exercises (workout_id, exercise_id, exercise_name) VALUES (?, ?, 'x')", [good, ex])).lastInsertRowId;
    await a.runAsync("INSERT INTO logged_sets (logged_exercise_id, set_number, weight_lbs, reps, is_completed) VALUES (?, 1, 100, 5, 1)", [le]);
    await a.runAsync("INSERT INTO progress_photos (photo_uri) VALUES ('here.jpg'), ('gone.jpg')");
    a.raw.pragma("foreign_keys = OFF"); // simulate an old install that never enforced them
    await a.runAsync("INSERT INTO logged_exercises (workout_id, exercise_id, exercise_name) VALUES (999, ?, 'orphan')", [ex]);
    await a.runAsync("INSERT INTO logged_sets (logged_exercise_id, set_number) VALUES (12345, 1)");
    a.raw.pragma("foreign_keys = ON");

    const { diagnoseDb, repairDb, problemTotal } = await import("../db/doctor");
    const exists = async (n: string) => n === "here.jpg";
    const r = await diagnoseDb(null, exists);
    expect(r.problems).toEqual({
      "Exercises with no workout": 1,
      "Sets with no exercise": 1,
      "Unfinished workouts": 1,
      "Photos with a missing file": 1,
    });
    expect((await diagnoseDb(open, exists)).problems["Unfinished workouts"]).toBeUndefined(); // the resumable one is fine

    await repairDb(null, r);
    expect(problemTotal(await diagnoseDb(null, exists))).toBe(0);
    const left = await diagnoseDb(null, exists);
    expect(left.counts).toMatchObject({ Workouts: 1, Exercises: 1, Sets: 1, Photos: 1 }); // real data untouched
  });
});

describe("error log", () => {
  it("parses junk safely and keeps messages short", async () => {
    await setupDb(); // mocks expo-sqlite, which errors.ts reaches through kvStore
    const { parseErrorLog, toLoggedError, MAX_LOGGED_ERRORS } = await import("../utils/errors");
    expect(parseErrorLog("{nope")).toEqual([]);
    expect(parseErrorLog('{"a":1}')).toEqual([]);
    expect(parseErrorLog(JSON.stringify([{ message: "m" }, 5, { x: 1 }]))).toHaveLength(1);
    expect(toLoggedError("x".repeat(900), "ctx").message).toHaveLength(500);
    expect(MAX_LOGGED_ERRORS).toBe(50);
  });

  it("logError keeps the newest 50", async () => {
    const { adapter, init } = await setupDb();
    await init();
    jest.spyOn(console, "error").mockImplementation(() => {});
    const { logError, loadErrorLog } = await import("../utils/errors");
    for (let i = 0; i < 55; i++) logError(new Error(`e${i}`), "t");
    await new Promise((r) => setTimeout(r, 50));
    const list = await loadErrorLog();
    expect(list).toHaveLength(50);
    expect(list[0].message).toBe("e54"); // newest first
    expect(adapter).toBeTruthy();
  });
});
