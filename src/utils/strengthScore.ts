export type Gender = "male" | "female";
export type LiftCategory = "squat" | "bench" | "deadlift" | "press" | "pull";

export const CATEGORY_LABELS: Record<LiftCategory, string> = {
  squat: "Squat",
  bench: "Bench",
  deadlift: "Deadlift",
  press: "OHP",
  pull: "Pull",
};

export const CATEGORY_ORDER: LiftCategory[] = ["squat", "bench", "deadlift", "press", "pull"];

// 1RM / bodyweight thresholds: [beginner, novice, intermediate, advanced, elite, superElite]
type Thresholds = [number, number, number, number, number, number];

const STANDARDS: Record<Gender, Record<LiftCategory, Thresholds>> = {
  male: {
    squat:    [0.50, 0.75, 1.00, 1.50, 2.00, 2.50],
    bench:    [0.40, 0.65, 0.90, 1.30, 1.75, 2.10],
    deadlift: [0.70, 1.00, 1.35, 1.75, 2.25, 2.75],
    press:    [0.30, 0.45, 0.65, 0.90, 1.15, 1.40],
    pull:     [0.35, 0.55, 0.80, 1.10, 1.40, 1.70],
  },
  female: {
    squat:    [0.30, 0.50, 0.70, 1.00, 1.30, 1.60],
    bench:    [0.25, 0.40, 0.55, 0.80, 1.05, 1.30],
    deadlift: [0.40, 0.65, 0.90, 1.25, 1.60, 2.00],
    press:    [0.18, 0.28, 0.40, 0.58, 0.75, 0.95],
    pull:     [0.20, 0.35, 0.55, 0.75, 1.00, 1.25],
  },
};

// Score boundaries for each threshold crossing
// ratio=0→score 0, T[0]→33, T[1]→55, T[2]→80, T[3]→90, T[4]→99, T[5]→100
const SCORE_BREAKS = [0, 33, 55, 80, 90, 99, 100];

function ratioToScore(ratio: number, thresholds: Thresholds): number {
  const ratioBreaks = [0, ...thresholds];
  for (let i = 1; i < ratioBreaks.length; i++) {
    if (ratio <= ratioBreaks[i]) {
      const t = (ratio - ratioBreaks[i - 1]) / (ratioBreaks[i] - ratioBreaks[i - 1]);
      return SCORE_BREAKS[i - 1] + t * (SCORE_BREAKS[i] - SCORE_BREAKS[i - 1]);
    }
  }
  return 100;
}

function ageMultiplier(age: number): number {
  if (age < 23) return 1 + (23 - age) * 0.005;
  if (age > 40) return 1 + (age - 40) * 0.005;
  return 1;
}

export type Level = "Beginner" | "Novice" | "Intermediate" | "Advanced" | "Elite" | "Super Elite";

export const LEVEL_CONFIG: { name: Level; minScore: number; color: string }[] = [
  { name: "Beginner",      minScore: 0,  color: "#606060" },
  { name: "Novice",        minScore: 33, color: "#9E9E9E" },
  { name: "Intermediate",  minScore: 55, color: "#4CAF50" },
  { name: "Advanced",      minScore: 80, color: "#2196F3" },
  { name: "Elite",         minScore: 90, color: "#FF9800" },
  { name: "Super Elite",   minScore: 99, color: "#FF0000" },
];

export function getLevel(score: number) {
  for (let i = LEVEL_CONFIG.length - 1; i >= 0; i--) {
    if (score >= LEVEL_CONFIG[i].minScore) return LEVEL_CONFIG[i];
  }
  return LEVEL_CONFIG[0];
}

export function getNextLevel(score: number) {
  for (const level of LEVEL_CONFIG) {
    if (level.minScore > score) return level;
  }
  return null;
}

// Map an exercise name to a lift category
export function categorizeExercise(name: string): LiftCategory | null {
  if (/squat|leg press|pause squat|hack squat|box squat/i.test(name)) return "squat";
  if (/deadlift|romanian|rdl|hip thrust|good morning/i.test(name)) return "deadlift";
  if (/overhead press|shoulder press|military press|push press|arnold press|ohp/i.test(name)) return "press";
  if (/bench press|chest press|incline.*press|decline.*press|dip|push.?up|fly|flye/i.test(name)) return "bench";
  if (/pull.?up|chin.?up|pulldown|lat pull|row|t.?bar/i.test(name)) return "pull";
  return null;
}

export type CategoryScore = {
  category: LiftCategory;
  label: string;
  bestExercise: string | null;
  oneRM: number | null;
  score: number | null;
  level: (typeof LEVEL_CONFIG)[0] | null;
};

export type StrengthScoreResult = {
  overall: number;
  level: (typeof LEVEL_CONFIG)[0];
  categories: CategoryScore[];
};

export function computeStrengthScore(
  exerciseData: { name: string; oneRM: number }[],
  bodyweightLbs: number,
  gender: Gender,
  age: number
): StrengthScoreResult {
  const bests: Partial<Record<LiftCategory, { name: string; oneRM: number }>> = {};
  for (const ex of exerciseData) {
    const cat = categorizeExercise(ex.name);
    if (!cat) continue;
    if (!bests[cat] || ex.oneRM > bests[cat]!.oneRM) {
      bests[cat] = { name: ex.name, oneRM: ex.oneRM };
    }
  }

  const adj = ageMultiplier(age);
  const standards = STANDARDS[gender];

  const categories: CategoryScore[] = CATEGORY_ORDER.map((cat) => {
    const best = bests[cat];
    if (!best) {
      return { category: cat, label: CATEGORY_LABELS[cat], bestExercise: null, oneRM: null, score: null, level: null };
    }
    const ratio = best.oneRM / bodyweightLbs;
    const raw = ratioToScore(ratio, standards[cat]);
    const adjusted = Math.min(100, Math.round(raw * adj));
    return {
      category: cat,
      label: CATEGORY_LABELS[cat],
      bestExercise: best.name,
      oneRM: Math.round(best.oneRM),
      score: adjusted,
      level: getLevel(adjusted),
    };
  });

  const tracked = categories.filter((c) => c.score !== null);
  const overall = tracked.length > 0
    ? Math.round(tracked.reduce((s, c) => s + (c.score ?? 0), 0) / tracked.length)
    : 0;

  return { overall, level: getLevel(overall), categories };
}
