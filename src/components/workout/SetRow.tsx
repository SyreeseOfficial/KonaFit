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
  const label = set.isWarmup ? "W" : String(set.setNumber);
  const completed = set.isCompleted;

  return (
    <View
      className={`flex-row items-center gap-2 py-1.5 px-3 ${
        completed ? "opacity-50" : ""
      }`}
    >
      {/* Set number / warmup badge */}
      <TouchableOpacity onPress={onToggleWarmup} onLongPress={onRemove} hitSlop={8}>
        <View
          className={`w-7 h-7 items-center justify-center ${
            set.isWarmup ? "bg-surface-3" : "bg-surface-2"
          }`}
        >
          <Text
            className={`font-mono-medium text-xs ${
              set.isWarmup ? "text-text-secondary" : "text-text-muted"
            }`}
          >
            {label}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Weight */}
      <TextInput
        className="flex-1 h-9 bg-surface-2 text-center font-mono text-white text-sm"
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
        className="flex-1 h-9 bg-surface-2 text-center font-mono text-white text-sm"
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
        className="w-12 h-9 bg-surface-2 text-center font-mono text-white text-sm"
        placeholder="rpe"
        placeholderTextColor="#606060"
        value={set.rpe}
        onChangeText={(v) => onUpdate({ rpe: v })}
        keyboardType="decimal-pad"
        selectTextOnFocus
        editable={!completed}
      />

      {/* Complete button */}
      <TouchableOpacity
        onPress={onToggleComplete}
        className={`w-9 h-9 items-center justify-center ${
          completed ? "bg-crimson" : "bg-surface-2"
        }`}
        activeOpacity={0.7}
      >
        <Check size={16} color={completed ? "#FFFFFF" : "#606060"} strokeWidth={2.5} />
      </TouchableOpacity>
    </View>
  );
}
