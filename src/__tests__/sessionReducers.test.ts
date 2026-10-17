import * as R from "../utils/sessionReducers";
import type { ActiveExercise, ActiveSession, ActiveSet } from "../types/workout";

const set = (n: number, o: Partial<ActiveSet> = {}): ActiveSet => ({
  localId: `s${n}`, setNumber: n, weightLbs: "", reps: "", rpe: "", isWarmup: false, isCompleted: false, ...o,
});
const ex = (id: string, sets: ActiveSet[] = [set(1)], o: Partial<ActiveExercise> = {}): ActiveExercise => ({
  localId: id, exerciseId: 1, exerciseName: id, muscleGroup: "Chest", orderIndex: 0, notes: "",
  sets, ghostSets: [], histPRs: { maxWeight: null, maxReps: null, maxVolume: null }, ...o,
});
const session = (...exercises: ActiveExercise[]): ActiveSession => ({
  workoutId: 1, startedAt: 0, exercises: R.reindex(exercises),
});
const names = (s: ActiveSession) => s.exercises.map((e) => e.localId);

describe("copyLastSetToAll", () => {
  it("copies the last filled set into incomplete sets and leaves completed ones alone", () => {
    const s = session(ex("bench", [
      set(1, { weightLbs: "135", reps: "8", rpe: "7", isCompleted: true }),
      set(2, { weightLbs: "145", reps: "6", rpe: "9" }),
      set(3),
      set(4, { weightLbs: "100", reps: "10", isCompleted: true }),
    ]));
    // last filled = set 4 (completed): copied into the incomplete sets 2 and 3
    const next = R.copyLastSetToAll(s, "bench");
    const sets = next.exercises[0].sets;
    expect(sets.map((x) => [x.weightLbs, x.reps])).toEqual([["135", "8"], ["100", "10"], ["100", "10"], ["100", "10"]]);
    expect(sets[0]).toBe(s.exercises[0].sets[0]);
    expect(sets[3]).toBe(s.exercises[0].sets[3]);
  });

  it("is a no-op when no set is filled", () => {
    const s = session(ex("bench"));
    expect(R.copyLastSetToAll(s, "bench").exercises[0]).toBe(s.exercises[0]);
  });

  it("treats a blank weight as filled on bodyweight exercises", () => {
    const s = session(ex("pullup", [set(1, { reps: "8" }), set(2)], { isBodyweight: true }));
    expect(R.copyLastSetToAll(s, "pullup").exercises[0].sets[1].reps).toBe("8");
    const plain = session(ex("row", [set(1, { reps: "8" }), set(2)]));
    expect(R.copyLastSetToAll(plain, "row").exercises[0].sets[1].reps).toBe("");
  });
});

describe("sets", () => {
  it("removeSet renumbers and insertSet restores the original order", () => {
    const s = session(ex("a", [set(1), set(2), set(3)]));
    const removed = R.removeSet(s, "a", "s2");
    expect(removed.exercises[0].sets.map((x) => [x.localId, x.setNumber])).toEqual([["s1", 1], ["s3", 2]]);
    const back = R.insertSet(removed, "a", s.exercises[0].sets[1], 1);
    expect(back.exercises[0].sets.map((x) => [x.localId, x.setNumber])).toEqual([["s1", 1], ["s2", 2], ["s3", 3]]);
  });
});

describe("exercises", () => {
  it("removeExercise reindexes and insertExercise puts it back", () => {
    const s = session(ex("a"), ex("b"), ex("c"));
    const removed = R.removeExercise(s, "b");
    expect(names(removed)).toEqual(["a", "c"]);
    expect(removed.exercises.map((e) => e.orderIndex)).toEqual([0, 1]);
    const back = R.insertExercise(removed, s.exercises[1], 1);
    expect(names(back)).toEqual(["a", "b", "c"]);
    expect(back.exercises.map((e) => e.orderIndex)).toEqual([0, 1, 2]);
  });

  it("insertExercise clamps an index past the end", () => {
    expect(names(R.insertExercise(session(ex("a")), ex("z"), 9))).toEqual(["a", "z"]);
  });

  it("moveExercise swaps neighbours, reindexes, and ignores moves off either end", () => {
    const s = session(ex("a"), ex("b"), ex("c"));
    const down = R.moveExercise(s, "a", "down");
    expect(names(down)).toEqual(["b", "a", "c"]);
    expect(down.exercises.map((e) => e.orderIndex)).toEqual([0, 1, 2]);
    expect(names(R.moveExercise(s, "c", "up"))).toEqual(["a", "c", "b"]);
    expect(R.moveExercise(s, "a", "up")).toBe(s);
    expect(R.moveExercise(s, "c", "down")).toBe(s);
    expect(R.moveExercise(s, "nope", "down")).toBe(s);
  });

  it("swapExercise changes the movement and keeps the sets and position", () => {
    const sets = [set(1, { weightLbs: "100", reps: "5", isCompleted: true })];
    const s = session(ex("a"), ex("b", sets));
    const next = R.swapExercise(s, "b", {
      exerciseId: 7, exerciseName: "Pull-Up", muscleGroup: "Lats", ghostSets: [], isBodyweight: true,
      histPRs: { maxWeight: 5, maxReps: 9, maxVolume: 45 },
    });
    expect(next.exercises[1]).toMatchObject({ localId: "b", exerciseId: 7, exerciseName: "Pull-Up", isBodyweight: true });
    expect(next.exercises[1].sets).toBe(sets);
    expect(next.exercises[0]).toBe(s.exercises[0]);
  });

  it("addSupersetAfter links both exercises, reusing an existing superset id", () => {
    const s = session(ex("a"), ex("c"));
    const one = R.addSupersetAfter(s, "a", ex("b"), "ss1");
    expect(names(one)).toEqual(["a", "b", "c"]);
    expect(one.exercises.map((e) => e.supersetId)).toEqual(["ss1", "ss1", undefined]);
    const two = R.addSupersetAfter(one, "b", ex("d"), "ss2");
    expect(two.exercises.map((e) => e.supersetId)).toEqual(["ss1", "ss1", "ss1", undefined]);
    expect(R.addSupersetAfter(s, "missing", ex("x"), "ss")).toBe(s);
  });
});
