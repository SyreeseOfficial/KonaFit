// Frozen-schema fixtures: build a DB exactly as it looked at every user_version (by stopping the real migrations there),
// fill it with rows, then upgrade to latest and check nothing was lost.
import { setupDb, createAdapter, type TestDb } from "./helpers/sqlite";

jest.spyOn(console, "error").mockImplementation(() => {}); // the deliberate stop below goes through logError

/** Run the real init but abort migration `v + 1`, leaving a DB at user_version `v`. */
async function dbAtVersion(v: number) {
  const adapter = createAdapter();
  const realExec = adapter.execAsync.bind(adapter);
  adapter.execAsync = async (sql: string) => {
    if (sql.includes(`PRAGMA user_version = ${v + 1}`)) throw new Error("stop here");
    return realExec(sql);
  };
  const { init, database } = await setupDb(adapter);
  await init().catch(() => {});
  adapter.execAsync = realExec;
  return { adapter, init, database };
}

async function fill(a: TestDb) {
  const ex = await a.runAsync("INSERT INTO exercises (name, muscle_group) VALUES ('Fixture Press', 'Chest')");
  for (let w = 0; w < 3; w++) {
    const wo = await a.runAsync("INSERT INTO workouts (name, started_at, finished_at, duration_seconds) VALUES (?, ?, ?, 3600)", [`W${w}`, 1700000000 + w * 86400, 1700003600 + w * 86400]);
    const le = await a.runAsync("INSERT INTO logged_exercises (workout_id, exercise_id, exercise_name) VALUES (?, ?, 'Fixture Press')", [wo.lastInsertRowId, ex.lastInsertRowId]);
    for (let s = 1; s <= 2; s++) await a.runAsync("INSERT INTO logged_sets (logged_exercise_id, set_number, weight_lbs, reps, is_completed) VALUES (?, ?, 135, 5, 1)", [le.lastInsertRowId, s]);
  }
  await a.runAsync("INSERT INTO bodyweight_logs (weight_lbs) VALUES (180.5)");
}

const count = async (a: TestDb, t: string) => (await a.getFirstAsync<{ n: number }>(`SELECT COUNT(*) n FROM ${t}`))!.n;
const version = async (a: TestDb) => (await a.getFirstAsync<{ user_version: number }>("PRAGMA user_version"))!.user_version;

describe("upgrading from every schema version", () => {
  it("finds the latest version", async () => {
    const { adapter } = await dbAtVersion(10_000); // never stops
    expect(await version(adapter)).toBeGreaterThanOrEqual(16);
  });

  const latest = 16;
  it.each(Array.from({ length: latest }, (_, i) => i))("from user_version %i keeps all rows and sample data", async (v) => {
    const { adapter, init } = await dbAtVersion(v);
    expect(await version(adapter)).toBe(v);
    await fill(adapter);
    const before = { workouts: await count(adapter, "workouts"), sets: await count(adapter, "logged_sets"), bw: await count(adapter, "bodyweight_logs") };

    await init();

    expect(await version(adapter)).toBeGreaterThanOrEqual(latest);
    expect({ workouts: await count(adapter, "workouts"), sets: await count(adapter, "logged_sets"), bw: await count(adapter, "bodyweight_logs") }).toEqual(before);
    const sample = await adapter.getFirstAsync<{ weight_lbs: number; reps: number; exercise_name: string }>(
      "SELECT ls.weight_lbs, ls.reps, le.exercise_name FROM logged_sets ls JOIN logged_exercises le ON le.id = ls.logged_exercise_id ORDER BY ls.id LIMIT 1");
    expect(sample).toEqual({ weight_lbs: 135, reps: 5, exercise_name: "Fixture Press" });
    expect(await adapter.getAllAsync("PRAGMA foreign_key_check")).toEqual([]);
    expect((await adapter.getFirstAsync<{ integrity_check: string }>("PRAGMA integrity_check"))!.integrity_check).toBe("ok");
  });
});
