// Snapshots + fake clocks. Dates are built from local parts so output is identical in UTC and America/Los_Angeles.
jest.mock("expo-sqlite", () => ({}));
jest.mock("expo-file-system/legacy", () => ({}));
jest.mock("react-native", () => ({ Share: {}, Platform: { OS: "android" } }));

import { autoWorkoutName } from "../db/workoutQueries";
import { calculateStreak } from "../db/statsQueries";
import { buildWorkoutMarkdown } from "../utils/exportUtils";
import { localDateKey } from "../utils/time";
import type { WorkoutDetail } from "../db/historyQueries";

afterEach(() => jest.useRealTimers());
const secs = (y: number, m: number, d: number, h = 9) => new Date(y, m, d, h).getTime() / 1000;

describe("autoWorkoutName", () => {
  it("matches the snapshot for typical inputs", () => {
    const thu = secs(2026, 0, 15);
    expect({
      twoGroups: autoWorkoutName(["Chest, Front Delts", "Chest", "Triceps"], thu),
      topTwoOnly: autoWorkoutName(["Back", "Back", "Biceps", "Legs"], thu),
      empty: autoWorkoutName([], thu),
      blankGroup: autoWorkoutName([" , "], secs(2026, 0, 18)),
    }).toMatchInlineSnapshot(`
{
  "blankGroup": "Sunday Workout",
  "empty": "Thursday Workout",
  "topTwoOnly": "Back + Biceps · Thu",
  "twoGroups": "Chest + Triceps · Thu",
}
`);
  });
});

describe("calculateStreak with a fake clock", () => {
  const keys = (n: number, from: Date) =>
    Array.from({ length: n }, (_, i) => localDateKey(new Date(from.getFullYear(), from.getMonth(), from.getDate() - i)));

  it("counts across the US spring-forward day (Mar 8 2026) in any time zone", () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 2, 10, 12));
    expect(calculateStreak(keys(5, new Date(2026, 2, 10)))).toBe(5);
  });

  it("counts across the fall-back day (Nov 1 2026)", () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 10, 3, 0, 30));
    expect(calculateStreak(keys(5, new Date(2026, 10, 3)))).toBe(5);
  });

  it("an empty today does not break the streak, an empty yesterday does", () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 5, 15, 8));
    expect(calculateStreak(keys(3, new Date(2026, 5, 14)))).toBe(3);
    expect(calculateStreak(keys(3, new Date(2026, 5, 13)))).toBe(0);
  });
});

describe("buildWorkoutMarkdown", () => {
  const set = (n: number, w: number | null, reps: number | null, extra: object = {}) => ({
    id: n, set_number: n, weight_lbs: w, reps, duration_sec: null, distance_mi: null, calories: null,
    rpe: null, notes: null, is_warmup: 0, is_completed: 1, ...extra,
  });
  const workout: WorkoutDetail = {
    id: 1, name: "Push", type: "lift", started_at: secs(2026, 0, 15), finished_at: secs(2026, 0, 15) + 3600,
    duration_seconds: 3725, location: null, totalVolume: 12450,
    exercises: [
      { id: 1, exercise_id: 1, exercise_name: "Barbell Bench Press", muscle_group: "Chest, Triceps", order_index: 0, notes: null,
        is_bodyweight: false, target_type: "reps",
        sets: [set(1, 95, 10, { is_warmup: 1 }), set(2, 185, 8, { rpe: 8 }), set(3, 185, 6, { is_completed: 0, notes: "grindy" })] },
      { id: 2, exercise_id: 2, exercise_name: "Plank", muscle_group: "Core", order_index: 1, notes: null,
        is_bodyweight: true, target_type: "time", sets: [set(1, null, null, { duration_sec: 60 })] },
    ],
  };

  it("matches the snapshot", () => {
    expect(buildWorkoutMarkdown(workout)).toMatchSnapshot();
  });
});
