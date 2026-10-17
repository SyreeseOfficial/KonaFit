import type { ActiveExercise, HistPRs, PRBadge } from "../types/workout";

/** Badges that deserve a celebration (everything except the "first time" marker). */
export const isRealPR = (badges?: PRBadge[]) => !!badges?.some((b) => b !== "F");

export function computePRBadges(
  exercise: ActiveExercise,
  excludeSetLocalId: string,
  weight: number,
  reps: number,
  hist: HistPRs
): PRBadge[] {
  const others = exercise.sets
    .filter((s) => s.localId !== excludeSetLocalId && s.isCompleted && !s.isWarmup && (s.weightLbs !== "" || exercise.isBodyweight) && s.reps !== "")
    .map((s) => ({ weight: parseFloat(s.weightLbs) || 0, reps: parseInt(s.reps, 10) }));

  // No history for this exercise: nothing to beat. Mark the first set instead of faking PRs.
  if (hist.maxVolume == null) return others.length === 0 ? ["F"] : [];

  const maxOf = (nums: number[], base: number) => Math.max(base, ...nums);
  const badges: PRBadge[] = [];
  if (weight > maxOf(others.map((o) => o.weight), hist.maxWeight ?? 0)) badges.push("W");

  // Reps only count against sets at the same or a heavier weight (20 @ 45 lb is not a PR over 12 @ 225 lb).
  const comparable = [...(hist.repsByWeight ?? []), ...others].filter((o) => o.weight >= weight);
  if (comparable.length > 0 && reps > Math.max(...comparable.map((o) => o.reps))) badges.push("R");

  if (weight * reps > maxOf(others.map((o) => o.weight * o.reps), hist.maxVolume)) badges.push("V");
  return badges;
}
