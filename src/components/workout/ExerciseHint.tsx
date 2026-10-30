import { View, Text, TouchableOpacity } from "react-native";
import { ArrowUpRight } from "lucide-react-native";
import {
  isCompoundLift, suggestNext, lastTimeSummary, loadForTarget, parseTargetReps, type Suggestion,
} from "../../utils/training";
import { compactNumber } from "../../utils/format";
import type { ActiveExercise } from "../../types/workout";

/** "Last time" line (date, top set, volume) and a one-tap next-load hint (program RPE target first, else overload rule). */
export function ExerciseHint({ exercise, onApply }: { exercise: ActiveExercise; onApply: (weight: number, reps: number) => void }) {
  const last = exercise.ghostSets;
  const summary = lastTimeSummary(last);
  if (!summary) return null;

  const compound = isCompoundLift(exercise.exerciseName);
  const targetReps = parseTargetReps(exercise.targetReps);
  let hint: Suggestion | null = null;
  if (exercise.targetRpe != null && targetReps != null && !exercise.isBodyweight) {
    const top = last.reduce((a, b) => ((b.weightLbs ?? 0) > (a.weightLbs ?? 0) ? b : a));
    const weight = loadForTarget(top, targetReps, exercise.targetRpe);
    if (weight != null) hint = { weight, reps: targetReps, label: `RPE ${exercise.targetRpe}: ${weight} × ${targetReps}` };
  }
  hint ??= exercise.isBodyweight ? null : suggestNext(last, compound);

  const date = last[0]?.at ? new Date(last[0].at * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "";
  const mono = "font-mono text-text-muted dark:text-zinc-500 text-xs";
  return (
    <View className="px-4 pb-2 gap-1.5">
      <Text className={mono} numberOfLines={1}>
        Last time{date ? ` · ${date}` : ""} · top {summary.top.weightLbs} × {summary.top.reps} · {compactNumber(summary.volume)} lb
      </Text>
      {hint && (
        <TouchableOpacity
          onPress={() => onApply(hint.weight, hint.reps)}
          className="self-start flex-row items-center gap-1 h-9 px-3 rounded-full bg-surface-2 dark:bg-zinc-800"
          activeOpacity={0.7}
        >
          <ArrowUpRight size={14} color="#2563EB" />
          <Text className="font-mono-medium text-crimson dark:text-blue-400 text-xs">{hint.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
