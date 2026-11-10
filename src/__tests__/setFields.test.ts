import { columnsFor, isFilled, copyFields, setSummary, ghostText, ghostExtra, clockToSec, fmtClock } from "../utils/setFields";

describe("setFields", () => {
  it("picks columns by target type, defaulting to lbs/reps/rpe", () => {
    expect(columnsFor("time")).toEqual(["duration", "rpe"]);
    expect(columnsFor("distance")).toEqual(["distance", "duration", "rpe"]);
    expect(columnsFor("calories")).toEqual(["calories", "rpe"]);
    expect(columnsFor(undefined)).toEqual(["weightLbs", "reps", "rpe"]);
    expect(columnsFor("nonsense")).toEqual(["weightLbs", "reps", "rpe"]);
  });

  it("isFilled / copyFields follow the type", () => {
    expect(isFilled({ duration: "1:30" }, "time")).toBe(true);
    expect(isFilled({ duration: "" }, "time")).toBe(false);
    expect(isFilled({ weightLbs: "", reps: "8" }, "reps", true)).toBe(true); // bodyweight: blank weight is fine
    expect(isFilled({ weightLbs: "", reps: "8" }, "reps")).toBe(false);
    expect(copyFields({ distance: "2", duration: "18:00", rpe: "7", reps: "9" }, "distance")).toEqual({ distance: "2", duration: "18:00", rpe: "7" });
    expect(copyFields({ distance: "2", duration: "18:00", rpe: "7" }, "distance", false)).toEqual({ distance: "2", duration: "18:00" });
  });

  it("formats saved sets per type", () => {
    const base = { weight_lbs: null, reps: null, duration_sec: null, distance_mi: null, calories: null };
    expect(setSummary({ ...base, weight_lbs: 135, reps: 5 }, "reps")).toBe("135 × 5");
    expect(setSummary({ ...base, weight_lbs: 135 }, "reps")).toBe("135 lb");
    expect(setSummary({ ...base, duration_sec: 90 }, "time")).toBe("1:30");
    expect(setSummary({ ...base, distance_mi: 2, duration_sec: 1080 }, "distance")).toBe("2 mi · 18:00");
    expect(setSummary({ ...base, distance_mi: 2 }, "distance")).toBe("2 mi");
    expect(setSummary({ ...base, calories: 250 }, "calories")).toBe("250 cal");
    expect(setSummary(base, "time")).toBe("—");
  });

  it("round-trips clock text and builds ghost text and prefill", () => {
    expect(clockToSec("1:30")).toBe(90);
    expect(clockToSec("")).toBeNull();
    expect(fmtClock(90)).toBe("1:30");
    expect(ghostText({ setNumber: 1, weightLbs: null, reps: null, durationSec: 75 }, "time")).toBe("1:15");
    expect(ghostText(undefined, "time")).toBe("—");
    expect(ghostExtra({ setNumber: 1, weightLbs: 100, reps: 5 })).toEqual({}); // lifts are prefilled elsewhere
    expect(ghostExtra({ setNumber: 1, weightLbs: null, reps: null, durationSec: 60, rpe: 6 })).toMatchObject({ duration: "1:00", rpe: "6", isGhostFilled: true });
  });
});
