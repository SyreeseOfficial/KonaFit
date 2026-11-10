/** Rep-max formulas drift badly past ~10-12 reps (Epley calls a 30-rep set a 2x max), so sets above this are treated as this many. */
export const MAX_1RM_REPS = 12;

/** Estimated 1RM (Epley) for `load` x `reps`. Keep in sync with `oneRmSql` in sqlFragments.ts. */
export const estimateOneRm = (load: number, reps: number): number => load * (1 + Math.min(reps, MAX_1RM_REPS) / 30);

/** Reps you could do at `pct` percent of your 1RM, by inverting Epley (an estimate, not a promise). */
export const repsAtPercent = (pct: number): number => (pct >= 100 ? 1 : Math.max(1, Math.round(30 * (100 / pct - 1))));
