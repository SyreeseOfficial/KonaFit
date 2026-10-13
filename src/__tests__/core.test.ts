// Pure-function tests: stub the native modules the imports drag in.
jest.mock("expo-sqlite", () => ({}));
jest.mock("expo-file-system/legacy", () => ({}));
jest.mock("react-native", () => ({ Share: {}, Platform: { OS: "android" } }));

import { calculateStreak } from "../db/statsQueries";
import { calculatePlates, PLATES } from "../utils/plateCalc";
import { computeStrengthScore } from "../utils/strengthScore";
import { buildCsv } from "../utils/exportUtils";
import { localDateKey } from "../utils/time";

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

describe("computeStrengthScore", () => {
  it("scores only the tracked categories and ignores unknown exercises", () => {
    const r = computeStrengthScore([{ name: "Barbell Bench Press", oneRM: 225 }, { name: "Unknown Move", oneRM: 999 }], 180, "male", 30);
    const tracked = r.categories.filter((c) => c.score !== null);
    expect(tracked).toHaveLength(1);
    expect(tracked[0].oneRM).toBe(225);
    expect(r.overall).toBe(tracked[0].score);
  });
  it("is 0 with no lifts", () => {
    expect(computeStrengthScore([], 180, "male", 30).overall).toBe(0);
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
