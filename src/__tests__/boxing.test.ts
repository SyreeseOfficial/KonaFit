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
