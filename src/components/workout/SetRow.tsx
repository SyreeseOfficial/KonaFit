import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { Check } from "lucide-react-native";
import type { ActiveSet, GhostSet } from "../../types/workout";

type Props = {
  set: ActiveSet;
  ghost?: GhostSet;
  onUpdate: (patch: Partial<Pick<ActiveSet, "weightLbs" | "reps" | "rpe">>) => void;
  onToggleComplete: () => void;
  onToggleWarmup: () => void;
  onRemove: () => void;
};

export function SetRow({ set, ghost, onUpdate, onToggleComplete, onToggleWarmup, onRemove }: Props) {
  const completed = set.isCompleted;

  const previousText =
    ghost?.weightLbs != null && ghost?.reps != null
      ? `${ghost.weightLbs} lb × ${ghost.reps}`
      : ghost?.weightLbs != null
      ? `${ghost.weightLbs} lb`
      : "—";

  const inputBase =
    "h-9 bg-surface-2 text-center font-mono text-white text-sm";

  return (
    <View
      className={`flex-row items-center px-3 py-2 border-b border-surface-2 ${
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
            set.isWarmup ? "text-crimson" : "text-text-secondary"
          }`}
        >
          {set.isWarmup ? "W" : set.setNumber}
        </Text>
      </TouchableOpacity>

      {/* Previous (ghost) */}
      <View className="flex-1 mx-2 items-center">
        <Text className="font-mono text-text-muted text-xs" numberOfLines={1}>
          {previousText}
        </Text>
      </View>

      {/* Lbs */}
      <TextInput
        className={`${inputBase} w-14 mr-1.5`}
        style={{ borderRadius: 6 }}
        placeholder={ghost?.weightLbs != null ? String(ghost.weightLbs) : "lbs"}
        placeholderTextColor="#606060"
        value={set.weightLbs}
        onChangeText={(v) => onUpdate({ weightLbs: v })}
        keyboardType="decimal-pad"
        selectTextOnFocus
        editable={!completed}
      />

      {/* Reps */}
      <TextInput
        className={`${inputBase} w-12 mr-1.5`}
        style={{ borderRadius: 6 }}
        placeholder={ghost?.reps != null ? String(ghost.reps) : "reps"}
        placeholderTextColor="#606060"
        value={set.reps}
        onChangeText={(v) => onUpdate({ reps: v })}
        keyboardType="number-pad"
        selectTextOnFocus
        editable={!completed}
      />

      {/* RPE */}
      <TextInput
        className={`${inputBase} w-10 mr-1.5`}
        style={{ borderRadius: 6 }}
        placeholder="rpe"
        placeholderTextColor="#606060"
        value={set.rpe}
        onChangeText={(v) => onUpdate({ rpe: v })}
        keyboardType="decimal-pad"
        selectTextOnFocus
        editable={!completed}
      />

      {/* Complete */}
      <TouchableOpacity
        onPress={onToggleComplete}
        className={`w-8 h-8 items-center justify-center ${
          completed ? "bg-crimson" : "bg-surface-2"
        }`}
        style={{ borderRadius: 16 }}
        activeOpacity={0.7}
      >
        <Check
          size={14}
          color={completed ? "#FFFFFF" : "#606060"}
          strokeWidth={2.5}
        />
      </TouchableOpacity>
    </View>
  );
}
