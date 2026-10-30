export type OneRmFormula = "epley" | "brzycki" | "lombardi";

/** Rep-max formulas drift badly past ~10-12 reps (Epley calls a 30-rep set a 2x max), so sets above this are treated as this many. */
export const MAX_1RM_REPS = 12;

export const ONE_RM_FORMULAS: { key: OneRmFormula; label: string }[] = [
  { key: "epley", label: "Epley" },
  { key: "brzycki", label: "Brzycki" },
  { key: "lombardi", label: "Lombardi" },
];

/** Estimated 1RM for `load` x `reps`. Epley by default; keep in sync with `oneRmSql` in sqlFragments.ts. */
export function estimateOneRm(load: number, reps: number, formula: OneRmFormula = "epley"): number {
  const r = Math.min(reps, MAX_1RM_REPS);
  if (formula === "brzycki") return (load * 36) / (37 - r);
  if (formula === "lombardi") return load * Math.pow(r, 0.1);
  return load * (1 + r / 30);
}

/** Reps you could do at `pct` percent of your 1RM, by inverting the formula (an estimate, not a promise). */
export function repsAtPercent(pct: number, formula: OneRmFormula = "epley"): number {
  const p = pct / 100;
  if (p >= 1) return 1;
  const reps =
    formula === "brzycki" ? 37 - 36 * p :
    formula === "lombardi" ? Math.pow(p, -10) :
    30 * (1 / p - 1);
  return Math.max(1, Math.round(reps));
}
