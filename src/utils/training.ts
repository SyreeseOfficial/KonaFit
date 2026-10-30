import { estimateOneRm } from "./oneRm";

// Pure training math: overload hints, warm-up ramps, RPE chart, weekly set targets, deload and balance checks. No DB, no React.

export type LastSet = { weightLbs: number | null; reps: number | null; rpe?: number | null };

const COMPOUND = /squat|deadlift|bench|press|row|pull-?up|chin-?up|dip|lunge|clean|snatch|thrust/i;
/** Compound lifts progress in 5 lb steps, isolation work in 2.5 lb steps. */
export const isCompoundLift = (name: string): boolean => COMPOUND.test(name) && !/curl|fly|raise|extension/i.test(name);

/** Rep count that counts as "top of the range" when no program range is known. */
export const topOfRange = (compound: boolean): number => (compound ? 8 : 10);

export type Suggestion = { weight: number; reps: number; label: string };

/**
 * "Last time 135 x 8. Try 140 x 8 or 135 x 9."
 * Every working set hit the top of the range at RPE <= 8 (missing RPE counts as fine) -> add weight; otherwise add a rep.
 */
export function suggestNext(last: LastSet[], compound: boolean): Suggestion | null {
  const sets = last.filter((s) => s.weightLbs != null && s.reps != null && s.reps > 0);
  if (sets.length === 0) return null;
  const top = sets.reduce((a, b) => ((b.weightLbs as number) > (a.weightLbs as number) ? b : a));
  const w = top.weightLbs as number;
  const reps = Math.min(...sets.filter((s) => s.weightLbs === w).map((s) => s.reps as number));
  const easy = sets.every((s) => (s.reps as number) >= topOfRange(compound) && (s.rpe == null || s.rpe <= 8));
  if (easy) {
    const next = w + (compound ? 5 : 2.5);
    return { weight: next, reps, label: `Try ${next} × ${reps}` };
  }
  return { weight: w, reps: reps + 1, label: `Try ${w} × ${reps + 1}` };
}

const WARMUP_PLANS: Record<number, (readonly [number, number])[]> = {
  1: [[0.6, 5]],
  2: [[0.5, 6], [0.75, 3]],
  3: [[0.4, 8], [0.6, 5], [0.8, 3]],
  4: [[0.3, 10], [0.5, 6], [0.7, 4], [0.85, 2]],
};

/**
 * Ramp of `count` (1-4) sets before the first working set, rounded to `step`, never at the working weight.
 * The bar is a floor only when the work is heavy enough to be a barbell lift (a 65 lb dumbbell press has no bar).
 */
export function warmupRamp(workingLbs: number, count = 3, barLbs = 45, step = 5): { weight: number; reps: number }[] {
  if (!(workingLbs > step)) return [];
  const floor = workingLbs >= barLbs * 2 ? barLbs : step;
  const out: { weight: number; reps: number }[] = [];
  for (const [pct, reps] of WARMUP_PLANS[count] ?? WARMUP_PLANS[3]) {
    const weight = Math.max(floor, Math.round((workingLbs * pct) / step) * step);
    if (weight >= workingLbs || out.some((o) => o.weight === weight)) continue;
    out.push({ weight, reps });
  }
  return out;
}

// ─── RPE chart (Tuchscherer): % of 1RM for reps 1-10 at RPE 10, 9.5 ... 6 ───

const RPE_LEVELS = [10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5, 6];
const RPE_TABLE: number[][] = [
  [100, 97.8, 95.5, 93.9, 92.2, 90.7, 89.2, 87.8, 86.3],
  [95.5, 93.9, 92.2, 90.7, 89.2, 87.8, 86.3, 85, 83.7],
  [92.2, 90.7, 89.2, 87.8, 86.3, 85, 83.7, 82.4, 81.1],
  [89.2, 87.8, 86.3, 85, 83.7, 82.4, 81.1, 79.9, 78.6],
  [86.3, 85, 83.7, 82.4, 81.1, 79.9, 78.6, 77.4, 76.2],
  [83.7, 82.4, 81.1, 79.9, 78.6, 77.4, 76.2, 75.1, 73.9],
  [81.1, 79.9, 78.6, 77.4, 76.2, 75.1, 73.9, 72.3, 70.7],
  [78.6, 77.4, 76.2, 75.1, 73.9, 72.3, 70.7, 69.4, 68],
  [76.2, 75.1, 73.9, 72.3, 70.7, 69.4, 68, 66.7, 65.3],
  [73.9, 72.3, 70.7, 69.4, 68, 66.7, 65.3, 64, 62.6],
];
export const RPE_CHART = { levels: RPE_LEVELS, rows: RPE_TABLE };

/** % of 1RM for `reps` (1-10) at `rpe` (6-10, half steps); null outside the chart. */
export function rpePercent(reps: number, rpe: number): number | null {
  const col = RPE_LEVELS.indexOf(rpe);
  const row = RPE_TABLE[reps - 1];
  return row && col !== -1 ? row[col] : null;
}

/** Load for a program's target (reps at RPE) from the last top set's estimated 1RM, rounded to `step`. */
export function loadForTarget(last: LastSet, targetReps: number, targetRpe: number, step = 5): number | null {
  const pct = rpePercent(targetReps, targetRpe);
  if (pct == null || last.weightLbs == null || !last.reps) return null;
  return Math.round((estimateOneRm(last.weightLbs, last.reps) * pct) / 100 / step) * step;
}

/** First whole number in a rep target like "8-10" or "5". */
export const parseTargetReps = (s: string | null | undefined): number | null => {
  const n = parseInt(s ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

// ─── Last time ───

export function lastTimeSummary(sets: { weightLbs: number | null; reps: number | null }[]) {
  const done = sets.filter((s) => s.weightLbs != null && s.reps != null);
  if (done.length === 0) return null;
  const top = done.reduce((a, b) => ((b.weightLbs as number) > (a.weightLbs as number) ? b : a));
  const volume = done.reduce((v, s) => v + Math.max(0, s.weightLbs as number) * (s.reps as number), 0);
  return { top: top as { weightLbs: number; reps: number }, volume, sets: done.length };
}

// ─── Weekly sets per muscle (MEV / MAV start / MRV, hard sets per week) ───

export const LANDMARKS: Record<string, { mev: number; mav: number; mrv: number }> = {
  Chest: { mev: 8, mav: 12, mrv: 22 },
  Lats: { mev: 8, mav: 14, mrv: 25 },
  "Upper Back": { mev: 8, mav: 14, mrv: 25 },
  "Front Delts": { mev: 0, mav: 6, mrv: 12 },
  "Mid Delts": { mev: 8, mav: 16, mrv: 26 },
  "Rear Delts": { mev: 8, mav: 16, mrv: 26 },
  Biceps: { mev: 8, mav: 14, mrv: 26 },
  Triceps: { mev: 6, mav: 10, mrv: 18 },
  Forearms: { mev: 2, mav: 6, mrv: 14 },
  Quads: { mev: 8, mav: 12, mrv: 20 },
  Hamstrings: { mev: 6, mav: 10, mrv: 20 },
  Glutes: { mev: 0, mav: 4, mrv: 16 },
  Calves: { mev: 8, mav: 12, mrv: 20 },
  Abs: { mev: 0, mav: 16, mrv: 25 },
};

export type LandmarkStatus = "low" | "ok" | "high" | "over";

export function landmarkStatus(muscle: string, sets: number): LandmarkStatus | null {
  const l = LANDMARKS[muscle];
  if (!l) return null;
  return sets < l.mev ? "low" : sets < l.mav ? "ok" : sets <= l.mrv ? "high" : "over";
}

/** Rows come grouped by the exercise's muscle_group string ("Hamstrings, Lower Back"); each listed muscle gets the sets. */
export function setsByMuscle(rows: { muscle_group: string; sets: number }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    for (const m of r.muscle_group.split(",").map((x) => x.trim()).filter(Boolean)) out[m] = (out[m] ?? 0) + r.sets;
  }
  return out;
}

const PUSH = ["Chest", "Front Delts", "Mid Delts", "Triceps"];
const PULL = ["Lats", "Upper Back", "Rear Delts", "Biceps"];
const sum = (by: Record<string, number>, keys: string[]) => keys.reduce((n, k) => n + (by[k] ?? 0), 0);

/** Plain-words balance notes; empty when nothing is lopsided (ratio under 0.75 or over 1.33). */
export function muscleBalance(by: Record<string, number>): string[] {
  const notes: string[] = [];
  const pair = (aName: string, a: number, bName: string, b: number) => {
    if (a + b < 6) return; // too little data to judge
    if (a < b * 0.75) notes.push(`${aName} ${a} sets vs ${bName} ${b}: add about ${Math.ceil(b * 0.9 - a)} ${aName.toLowerCase()} sets.`);
    else if (b < a * 0.75) notes.push(`${bName} ${b} sets vs ${aName} ${a}: add about ${Math.ceil(a * 0.9 - b)} ${bName.toLowerCase()} sets.`);
  };
  pair("Push", sum(by, PUSH), "Pull", sum(by, PULL));
  pair("Quads", by.Quads ?? 0, "Hamstrings", by.Hamstrings ?? 0);
  return notes;
}

// ─── Deload ───

export type WeekLoad = { volume: number; avgRpe: number | null };

/** Four rises in a row (five complete weeks) in volume, or in average RPE, means it's time to think about a deload. */
export function deloadAlert(weeks: WeekLoad[]): string | null {
  const last = weeks.slice(-5);
  if (last.length < 5) return null;
  const rising = (get: (w: WeekLoad) => number | null) => {
    const v = last.map(get);
    return v.every((x, i) => x != null && (i === 0 || x > (v[i - 1] as number)));
  };
  if (rising((w) => w.volume)) return "Volume has gone up 4 weeks in a row. Consider a lighter deload week.";
  if (rising((w) => w.avgRpe)) return "Average RPE has climbed 4 weeks in a row. Consider a lighter deload week.";
  return null;
}

// ─── Bodyweight ───

export type Point = { x: number; y: number }; // x = ms
const DAY_MS = 86400000;

/** 7-day trailing average at each point. */
export function movingAverage(points: Point[], windowDays = 7): Point[] {
  return points.map((p, i) => {
    const inWin = points.slice(0, i + 1).filter((q) => q.x > p.x - windowDays * DAY_MS);
    return { x: p.x, y: inWin.reduce((s, q) => s + q.y, 0) / inWin.length };
  });
}

/** Linear fit over the last 28 days; the date the goal weight is reached, or null when flat, moving away, or too little data. */
export function projectGoalDate(points: Point[], goal: number): number | null {
  if (points.length < 3) return null;
  const end = points[points.length - 1].x;
  const win = points.filter((p) => p.x >= end - 28 * DAY_MS);
  if (win.length < 3) return null;
  const n = win.length;
  const mx = win.reduce((s, p) => s + p.x, 0) / n;
  const my = win.reduce((s, p) => s + p.y, 0) / n;
  const den = win.reduce((s, p) => s + (p.x - mx) ** 2, 0);
  if (den === 0) return null;
  const slope = win.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0) / den; // lbs per ms
  const now = my + slope * (end - mx);
  const ms = (goal - now) / slope;
  return slope !== 0 && ms > 0 && ms < 730 * DAY_MS ? end + ms : null;
}

// ─── Workout-complete insights ───

export type InsightInput = {
  volume: number;
  priorVolumes: number[]; // last sessions of the same workout, newest first
  exercises: { name: string; sets: { weight: number | null; reps: number | null }[] }[]; // ticked working sets, in order
};

export function sessionInsights(i: InsightInput) {
  const prior = i.priorVolumes.slice(0, 4);
  const avg = prior.length ? prior.reduce((a, b) => a + b, 0) / prior.length : null;
  let best: { name: string; weight: number; reps: number } | null = null;
  let bestRm = 0;
  const fatigue: string[] = [];
  for (const ex of i.exercises) {
    const sets = ex.sets.filter((s) => s.weight != null && s.reps != null && s.reps > 0) as { weight: number; reps: number }[];
    for (const s of sets) {
      const rm = estimateOneRm(s.weight, s.reps);
      if (rm > bestRm) { bestRm = rm; best = { name: ex.name, weight: s.weight, reps: s.reps }; }
    }
    if (sets.length >= 3 && sets[sets.length - 1].reps <= sets[0].reps * 0.6) fatigue.push(ex.name);
  }
  return {
    volumeVsAvgPct: avg ? Math.round(((i.volume - avg) / avg) * 100) : null,
    comparedTo: prior.length,
    best,
    fatigue,
  };
}
