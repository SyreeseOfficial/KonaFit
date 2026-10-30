import {
  suggestNext, warmupRamp, rpePercent, loadForTarget, lastTimeSummary, landmarkStatus, setsByMuscle,
  muscleBalance, deloadAlert, movingAverage, projectGoalDate, sessionInsights, isCompoundLift, parseTargetReps,
} from "../utils/training";

const DAY = 86400000;

describe("suggestNext", () => {
  it("adds weight when every set hit the top of the range at RPE <= 8", () => {
    const s = suggestNext([{ weightLbs: 135, reps: 8, rpe: 8 }, { weightLbs: 135, reps: 9, rpe: 7 }], true);
    expect(s).toMatchObject({ weight: 140, reps: 8 });
  });
  it("uses 2.5 lb steps for isolation", () => {
    expect(suggestNext([{ weightLbs: 30, reps: 10 }], false)).toMatchObject({ weight: 32.5 });
  });
  it("adds a rep when RPE was too high or reps fell short", () => {
    expect(suggestNext([{ weightLbs: 135, reps: 8, rpe: 9.5 }], true)).toMatchObject({ weight: 135, reps: 9 });
    expect(suggestNext([{ weightLbs: 135, reps: 6 }], true)).toMatchObject({ weight: 135, reps: 7 });
  });
  it("returns null with no usable sets", () => {
    expect(suggestNext([{ weightLbs: null, reps: null }], true)).toBeNull();
  });
  it("classifies compound lifts", () => {
    expect(isCompoundLift("Barbell Back Squat")).toBe(true);
    expect(isCompoundLift("Dumbbell Lateral Raise")).toBe(false);
    expect(isCompoundLift("Triceps Extension")).toBe(false);
  });
});

describe("warmupRamp", () => {
  it("builds 40/60/80% ramps rounded to 5", () => {
    expect(warmupRamp(225)).toEqual([{ weight: 90, reps: 8 }, { weight: 135, reps: 5 }, { weight: 180, reps: 3 }]);
  });
  it("keeps light (non-barbell) weights at 3 distinct steps", () => {
    expect(warmupRamp(65)).toEqual([{ weight: 25, reps: 8 }, { weight: 40, reps: 5 }, { weight: 50, reps: 3 }]);
  });
  it("floors at the bar for heavy work and drops duplicates", () => {
    expect(warmupRamp(95)).toEqual([{ weight: 45, reps: 8 }, { weight: 55, reps: 5 }, { weight: 75, reps: 3 }]);
  });
  it("honours the requested count", () => {
    expect(warmupRamp(200, 1)).toEqual([{ weight: 120, reps: 5 }]);
    expect(warmupRamp(200, 4).map((s) => s.weight)).toEqual([60, 100, 140, 170]);
  });
  it("is empty when there is nothing to ramp to", () => {
    expect(warmupRamp(5)).toEqual([]);
  });
});

describe("RPE chart", () => {
  it("looks up percentages and rejects out-of-chart values", () => {
    expect(rpePercent(5, 8)).toBe(81.1);
    expect(rpePercent(1, 10)).toBe(100);
    expect(rpePercent(11, 8)).toBeNull();
    expect(rpePercent(5, 5)).toBeNull();
  });
  it("turns a target into a load", () => {
    // 200 x 5 -> e1RM 233.3; 8 reps @ RPE 8 = 73.9% -> 172 -> 170
    expect(loadForTarget({ weightLbs: 200, reps: 5 }, 8, 8)).toBe(170);
    expect(parseTargetReps("8-10")).toBe(8);
    expect(parseTargetReps(null)).toBeNull();
  });
});

describe("summaries", () => {
  it("last time: top set and volume", () => {
    expect(lastTimeSummary([{ weightLbs: 135, reps: 8 }, { weightLbs: 145, reps: 5 }])).toEqual({
      top: { weightLbs: 145, reps: 5 }, volume: 135 * 8 + 145 * 5, sets: 2,
    });
    expect(lastTimeSummary([])).toBeNull();
  });
  it("muscle landmarks and split groups", () => {
    expect(landmarkStatus("Chest", 4)).toBe("low");
    expect(landmarkStatus("Chest", 15)).toBe("high");
    expect(landmarkStatus("Chest", 30)).toBe("over");
    expect(landmarkStatus("Neck", 3)).toBeNull();
    expect(setsByMuscle([{ muscle_group: "Hamstrings, Lower Back", sets: 3 }, { muscle_group: "Hamstrings", sets: 2 }]))
      .toEqual({ Hamstrings: 5, "Lower Back": 3 });
  });
  it("balance notes only when lopsided", () => {
    expect(muscleBalance({ Chest: 10, Lats: 10 })).toEqual([]);
    expect(muscleBalance({ Chest: 20, Lats: 8 })[0]).toMatch(/Pull 8 sets vs Push 20/);
    expect(muscleBalance({ Chest: 2, Lats: 1 })).toEqual([]);
  });
});

describe("deloadAlert", () => {
  const w = (volume: number, avgRpe: number | null = null) => ({ volume, avgRpe });
  it("fires after 4 rises in a row", () => {
    expect(deloadAlert([w(1), w(2), w(3), w(4), w(5)])).toMatch(/Volume/);
    expect(deloadAlert([w(5, 7), w(4, 7), w(3, 7), w(2, 7), w(1, 7)])).toBeNull();
    expect(deloadAlert([w(5, 7), w(4, 8), w(5, 7), w(4, 8), w(5, 7)])).toBeNull();
    expect(deloadAlert([w(1), w(2), w(3), w(4)])).toBeNull();
  });
  it("watches RPE too", () => {
    expect(deloadAlert([w(9, 6), w(8, 7), w(9, 7.5), w(8, 8), w(7, 9)])).toMatch(/RPE/);
  });
});

describe("bodyweight", () => {
  const pts = [0, 7, 14, 21, 28].map((d, i) => ({ x: d * DAY, y: 200 - i * 1 })); // -1 lb/week
  it("7-day average smooths", () => {
    const avg = movingAverage([{ x: 0, y: 200 }, { x: DAY, y: 202 }]);
    expect(avg[1].y).toBe(201);
  });
  it("projects the goal date on the trend", () => {
    const at = projectGoalDate(pts, 190)!;
    expect(Math.round((at - 28 * DAY) / DAY)).toBe(42); // 6 lb more at 1 lb/week
  });
  it("no projection when moving away from the goal", () => {
    expect(projectGoalDate(pts, 210)).toBeNull();
  });
});

describe("sessionInsights", () => {
  it("compares volume, finds the best set and flags rep drop-off", () => {
    const r = sessionInsights({
      volume: 11000,
      priorVolumes: [10000, 10000, 10000, 10000, 1],
      exercises: [
        { name: "Bench Press", sets: [{ weight: 185, reps: 10 }, { weight: 185, reps: 8 }, { weight: 185, reps: 5 }] },
        { name: "Row", sets: [{ weight: 100, reps: 10 }] },
      ],
    });
    expect(r.volumeVsAvgPct).toBe(10);
    expect(r.comparedTo).toBe(4);
    expect(r.best).toMatchObject({ name: "Bench Press", reps: 10 });
    expect(r.fatigue).toEqual(["Bench Press"]);
  });
  it("no comparison for a first session", () => {
    expect(sessionInsights({ volume: 5, priorVolumes: [], exercises: [] }).volumeVsAvgPct).toBeNull();
  });
});
