import type { ActiveExercise, HistPRs, PRBadge } from "../types/workout";

/** Badges that deserve a celebration (everything except the "first time" marker). */
export const isRealPR = (badges?: PRBadge[]) => !!badges?.some((b) => b !== "F");

/** Volume score of a set; mirrors `prVolumeSql`: a bodyweight set is worth at least its reps, so rep PRs register at 0 added load. */
const volumeScore = (isBodyweight: boolean | undefined, bodyweightLbs: number, weight: number, reps: number) =>
  isBodyweight ? Math.max(1, weight + bodyweightLbs) * reps : weight * reps;

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

  const bw = exercise.isBodyweight ? hist.bodyweightLbs ?? 0 : 0;
  const volume = (o: { weight: number; reps: number }) => volumeScore(exercise.isBodyweight, bw, o.weight, o.reps);
  const maxOf = (nums: number[], base: number) => Math.max(base, ...nums);
  const badges: PRBadge[] = [];
  if (weight > maxOf(others.map((o) => o.weight), hist.maxWeight ?? 0)) badges.push("W");

  // Reps only count against sets at the same or a heavier weight (20 @ 45 lb is not a PR over 12 @ 225 lb).
  const comparable = [...(hist.repsByWeight ?? []), ...others].filter((o) => o.weight >= weight);
  if (comparable.length > 0 && reps > Math.max(...comparable.map((o) => o.reps))) badges.push("R");

  if (volume({ weight, reps }) > maxOf(others.map(volume), hist.maxVolume)) badges.push("V");
  return badges;
}
