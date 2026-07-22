import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { Check } from "lucide-react-native";
import type { ActiveSet, GhostSet, PRBadge } from "../../types/workout";

const PR_LABELS: Record<PRBadge, string> = { W: "WT", R: "REP", V: "VOL" };

type Props = {
  set: ActiveSet;
  ghost?: GhostSet;
  onUpdate: (patch: Partial<Pick<ActiveSet, "weightLbs" | "reps">>) => void;
  onToggleComplete: () => void;
  onToggleWarmup: () => void;
  onRemove: () => void;
};

export function SetRow({ set, ghost, onUpdate, onToggleComplete, onToggleWarmup, onRemove }: Props) {
  const completed = set.isCompleted;

  const previousText = set.isGhostFilled
    ? "—"
    : ghost?.weightLbs != null && ghost?.reps != null
    ? `${ghost.weightLbs} × ${ghost.reps}`
    : ghost?.weightLbs != null
    ? `${ghost.weightLbs} lb`
    : "—";

  const inputBase = "h-10 bg-surface-2 dark:bg-zinc-800 text-center font-mono text-text-primary dark:text-white text-sm rounded-lg";

  return (
    <View
      className={`flex-row items-center px-3 py-2.5 border-b border-surface-2 dark:border-zinc-800 ${
        completed ? "opacity-50" : ""
      }`}
    >
      {/* Set number / warmup — long press to remove, tap to toggle warmup */}
      <TouchableOpacity
        onPress={onToggleWarmup}
        onLongPress={onRemove}
        hitSlop={6}
        className="w-6 items-center"
      >
        <Text
          className={`font-mono-medium text-sm ${
            set.isWarmup ? "text-amber-500" : "text-text-secondary dark:text-zinc-400"
          }`}
        >
          {set.isWarmup ? "W" : set.setNumber}
        </Text>
      </TouchableOpacity>

      {/* Previous (ghost) */}
      <View className="flex-1 mx-2 items-center">
        <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs" numberOfLines={1}>
          {previousText}
        </Text>
      </View>

      {/* Lbs */}
      <TextInput
        className={`${inputBase} w-14 mr-1.5`}
        placeholder="lbs"
        placeholderTextColor="#94A3B8"
        value={set.weightLbs}
        onChangeText={(v) => onUpdate({ weightLbs: v })}
        keyboardType="decimal-pad"
        selectTextOnFocus
        editable={!completed}
        style={set.isGhostFilled ? { opacity: 0.45 } : undefined}
      />

      {/* Reps */}
      <TextInput
        className={`${inputBase} w-12 mr-1.5`}
        placeholder="reps"
        placeholderTextColor="#94A3B8"
        value={set.reps}
        onChangeText={(v) => onUpdate({ reps: v })}
        keyboardType="number-pad"
        selectTextOnFocus
        editable={!completed}
        style={set.isGhostFilled ? { opacity: 0.45 } : undefined}
      />

      {/* Complete */}
      <TouchableOpacity
        onPress={onToggleComplete}
        className={`w-8 h-8 items-center justify-center rounded-full ${
          completed ? "bg-crimson dark:bg-blue-500" : "bg-surface-2 dark:bg-zinc-800"
        }`}
        activeOpacity={0.7}
      >
        <Check
          size={14}
          color={completed ? "#FFFFFF" : "#94A3B8"}
          strokeWidth={2.5}
        />
      </TouchableOpacity>

      {/* PR badges */}
      {set.prBadges && set.prBadges.length > 0 && (
        <View className="flex-row gap-0.5 ml-1.5">
          {set.prBadges.map((badge) => (
            <View key={badge} className="bg-amber-500 px-1 py-0.5 rounded">
              <Text className="font-mono text-white" style={{ fontSize: 8, lineHeight: 10 }}>
                {PR_LABELS[badge]}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
