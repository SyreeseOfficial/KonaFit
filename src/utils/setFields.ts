import { cleanClock, cleanDecimal, cleanInt, MAX_REPS, MAX_WEIGHT } from "./numberInput";
import { parseClock } from "./boxingTimer";
import type { GhostSet } from "../types/workout";

// Which inputs a set row shows, by the exercise's target type. Unknown/missing type = the classic lbs/reps/rpe layout.
export type SetField = "weightLbs" | "reps" | "duration" | "distance" | "calories" | "rpe";

const COLUMNS: Record<string, SetField[]> = {
  reps: ["weightLbs", "reps", "rpe"],
  weight: ["weightLbs", "reps", "rpe"],
  time: ["duration", "rpe"],
  distance: ["distance", "duration", "rpe"],
  calories: ["calories", "rpe"],
};

export const columnsFor = (targetType?: string | null): SetField[] => COLUMNS[targetType ?? ""] ?? COLUMNS.reps;
/** Everything but RPE: what "filled in" and "same as previous" mean. */
export const valueFields = (targetType?: string | null): SetField[] => columnsFor(targetType).filter((f) => f !== "rpe");

type Meta = {
  label: string;
  width: string; // tailwind width class of the input
  keyboard: "number-pad" | "decimal-pad";
  /** Cleaned text, or null to ignore the keystroke (over the max). */
  clean: (v: string, bodyweight?: boolean) => string | null;
};

export const FIELD_META: Record<SetField, Meta> = {
  weightLbs: { label: "Lbs", width: "w-16", keyboard: "decimal-pad", clean: (v, bw) => cleanDecimal(v, MAX_WEIGHT, bw) },
  reps: { label: "Reps", width: "w-12", keyboard: "number-pad", clean: (v) => cleanInt(v, MAX_REPS) },
  duration: { label: "Time", width: "w-16", keyboard: "number-pad", clean: cleanClock },
  distance: { label: "Mi", width: "w-16", keyboard: "decimal-pad", clean: (v) => cleanDecimal(v, 999) },
  calories: { label: "Cal", width: "w-16", keyboard: "number-pad", clean: (v) => cleanInt(v, 9999) },
  rpe: { label: "RPE", width: "w-10", keyboard: "decimal-pad", clean: (v) => cleanDecimal(v, 10) },
};

type Texts = Partial<Record<SetField, string>>;

/** True when every value input has text (a bodyweight set may leave weight blank = no added load). */
export const isFilled = (s: Texts, targetType: string | null | undefined, bodyweight?: boolean): boolean =>
  valueFields(targetType).every((f) => (s[f] ?? "") !== "" || (f === "weightLbs" && !!bodyweight));

/** The inputs this exercise type shows, copied out of `s`. */
export const copyFields = (s: Texts, targetType: string | null | undefined, withRpe = true): Texts =>
  Object.fromEntries((withRpe ? columnsFor(targetType) : valueFields(targetType)).map((f) => [f, s[f] ?? ""]));

export const fmtClock = (sec: number): string => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;

/** "1:30" -> 90 (null when blank or not a time). */
export const clockToSec = (text: string | undefined): number | null => {
  const n = parseClock(text ?? "");
  return Number.isFinite(n) ? n : null;
};

/** Stored time/distance/calories for the saved-set rows (history, export). */
export type SetValues = {
  weight_lbs: number | null; reps: number | null;
  duration_sec: number | null; distance_mi: number | null; calories: number | null;
};

/** One saved set as text for the type, e.g. "135 × 5", "1:30", "2 mi · 18:00", "250 cal". */
export function setSummary(s: SetValues, targetType?: string | null): string {
  const parts: string[] = [];
  for (const f of valueFields(targetType)) {
    if (f === "weightLbs" && s.weight_lbs != null) parts.push(s.reps != null ? `${s.weight_lbs} ×` : `${s.weight_lbs} lb`);
    else if (f === "reps" && s.reps != null) parts.push(String(s.reps));
    else if (f === "duration" && s.duration_sec != null) parts.push(fmtClock(s.duration_sec));
    else if (f === "distance" && s.distance_mi != null) parts.push(`${s.distance_mi} mi ·`);
    else if (f === "calories" && s.calories != null) parts.push(`${s.calories} cal`);
  }
  return parts.join(" ").replace(/ ·$/, "") || "—";
}

/** The "Previous" column text for a ghost set. */
export function ghostText(g: GhostSet | undefined, targetType?: string | null): string {
  if (!g) return "—";
  return setSummary(
    { weight_lbs: g.weightLbs, reps: g.reps, duration_sec: g.durationSec ?? null, distance_mi: g.distance ?? null, calories: g.calories ?? null },
    targetType
  );
}

/** Prefill from last session's time/distance/calories set (weight/reps ghosts are handled where they were before). */
export function ghostExtra(g?: GhostSet) {
  if (!g || (g.durationSec == null && g.distance == null && g.calories == null)) return {};
  return {
    duration: g.durationSec != null ? fmtClock(g.durationSec) : "",
    distance: g.distance != null ? String(g.distance) : "",
    calories: g.calories != null ? String(g.calories) : "",
    rpe: g.rpe != null ? String(g.rpe) : "",
    isGhostFilled: true,
  };
}
