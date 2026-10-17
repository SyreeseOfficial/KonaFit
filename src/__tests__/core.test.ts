// Pure-function tests: stub the native modules the imports drag in.
jest.mock("expo-sqlite", () => ({}));
jest.mock("expo-file-system/legacy", () => ({}));
jest.mock("react-native", () => ({ Share: {}, Platform: { OS: "android" } }));

import { calculateStreak } from "../db/statsQueries";
import { calculatePlates, PLATES } from "../utils/plateCalc";
import { buildCsv } from "../utils/exportUtils";
import { localDateKey } from "../utils/time";
import { cleanDecimal, cleanInt } from "../utils/numberInput";
import { computePRBadges } from "../utils/prBadges";
import { autoWorkoutName } from "../db/workoutQueries";
import type { ActiveExercise, ActiveSet, HistPRs } from "../types/workout";

afterEach(() => jest.useRealTimers());

describe("calculateStreak", () => {
  it.each(["UTC", "Asia/Singapore", "America/Los_Angeles", "Pacific/Auckland"])(
    "counts local days in %s, including late evening",
    (tz) => {
      process.env.TZ = tz;
      jest.useFakeTimers().setSystemTime(new Date(2026, 5, 15, 23, 30)); // 23:30 local
      const day = (back: number) => localDateKey(new Date(2026, 5, 15 - back));
      expect(calculateStreak([day(0), day(1), day(2), day(4)])).toBe(3);
      expect(calculateStreak([day(1), day(2)])).toBe(2); // not trained yet today
      expect(calculateStreak([day(2)])).toBe(0);
      expect(calculateStreak([])).toBe(0);
    }
  );
});

describe("localDateKey", () => {
  it("uses the local date, not UTC", () => {
    process.env.TZ = "Pacific/Auckland"; // UTC+12/13: local date is ahead of UTC
    expect(localDateKey(new Date(2026, 0, 2, 1, 0))).toBe("2026-01-02");
    process.env.TZ = "America/Los_Angeles"; // behind UTC
    expect(localDateKey(new Date(2026, 0, 1, 20, 0))).toBe("2026-01-01");
  });
});

describe("calculatePlates", () => {
  const std = PLATES.filter((p) => !["15", "1.25"].includes(String(p.weight)));
  const summary = (r: ReturnType<typeof calculatePlates>) => r?.map((x) => `${x.plate.weight}x${x.count}`);

  it("loads 135 with a 45 lb bar", () => {
    expect(summary(calculatePlates(135, 45, std))).toEqual(["45x1"]);
  });
  it("handles fractional plates", () => {
    expect(summary(calculatePlates(100, 45, std))).toEqual(["25x1", "2.5x1"]);
  });
  it("returns [] for the bare bar and null below it", () => {
    expect(calculatePlates(45, 45, std)).toEqual([]);
    expect(calculatePlates(40, 45, std)).toBeNull();
  });
});

describe("buildCsv", () => {
  const row = {
    date: "2026-06-15", time: "11:30 PM", duration_min: 60, workout_id: 1,
    exercise: 'Curl, "EZ"', muscle_group: "Biceps", set_number: 1,
    weight_lbs: 40, reps: 10, rpe: null, notes: null, is_warmup: "No", is_completed: "Yes",
  };
  it("writes a header and quotes commas and quotes", () => {
    const lines = buildCsv([row]).split("\n");
    expect(lines[0].startsWith("Date,Time")).toBe(true);
    expect(lines[1]).toBe('2026-06-15,11:30 PM,60,1,"Curl, ""EZ""",Biceps,1,40,10,,,No,Yes');
  });
  it("prefixes formula-like text with a quote", () => {
    expect(buildCsv([{ ...row, exercise: "=SUM(A1)" }]).split("\n")[1]).toContain(",'=SUM(A1),");
  });
});

describe("number input", () => {
  it("accepts comma decimals, strips junk, rejects out-of-range keystrokes", () => {
    expect(cleanDecimal("62,5", 2000)).toBe("62.5");
    expect(cleanDecimal("1.2.3x", 2000)).toBe("1.23");
    expect(cleanDecimal("2255", 2000)).toBeNull();
    expect(cleanInt("12a", 999)).toBe("12");
    expect(cleanInt("1000", 999)).toBeNull();
  });
});

describe("computePRBadges", () => {
  const set = (w: string, r: string, done = true): ActiveSet => ({
    localId: `s${w}${r}`, setNumber: 1, weightLbs: w, reps: r, rpe: "", isWarmup: false, isCompleted: done,
  });
  const ex = (sets: ActiveSet[]) => ({ sets } as ActiveExercise);
  const hist: HistPRs = {
    maxWeight: 225, maxReps: 20, maxVolume: 2700,
    repsByWeight: [{ weight: 225, reps: 12 }, { weight: 45, reps: 20 }],
  };
  const none: HistPRs = { maxWeight: null, maxReps: null, maxVolume: null, repsByWeight: [] };

  it("labels the first set of a new exercise instead of calling it a PR", () => {
    expect(computePRBadges(ex([]), "x", 135, 8, none)).toEqual(["F"]);
    expect(computePRBadges(ex([set("135", "8")]), "x", 140, 8, none)).toEqual([]);
  });
  it("compares reps only against sets at the same or heavier weight", () => {
    expect(computePRBadges(ex([]), "x", 225, 13, hist)).toContain("R");
    expect(computePRBadges(ex([]), "x", 225, 11, hist)).not.toContain("R");
    expect(computePRBadges(ex([]), "x", 135, 11, hist)).not.toContain("R"); // 225x12 beats it; 45x20 does not count
  });
  it("flags weight and volume PRs", () => {
    expect(computePRBadges(ex([]), "x", 230, 12, hist)).toEqual(["W", "V"]);
  });
});

describe("autoWorkoutName", () => {
  it("summarises the top two primary muscle groups plus weekday", () => {
    const t = new Date(2026, 5, 15, 12).getTime() / 1000; // Monday
    expect(autoWorkoutName(["Chest, Front Delts", "Chest", "Triceps", "Biceps"], t)).toMatch(/^Chest \+ (Triceps|Biceps) · /);
    expect(autoWorkoutName([], t)).toMatch(/ Workout$/);
  });
});
