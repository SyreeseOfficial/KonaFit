import { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, useColorScheme } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { Check } from "lucide-react-native";
import { haptics } from "../../utils/haptics";
import { cleanDecimal, cleanInt, MAX_WEIGHT, MAX_REPS } from "../../utils/numberInput";
import type { ActiveSet, GhostSet, PRBadge } from "../../types/workout";

const PR_LABELS: Record<PRBadge, string> = { W: "PR WT", R: "PR REP", V: "PR VOL", F: "FIRST TIME" };

function PRBadgeChip({ badge }: { badge: PRBadge }) {
  const scale = useSharedValue(0);
  useEffect(() => {
    scale.value = withSpring(1, { damping: 8, stiffness: 180 });
  }, []);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={style} className={`${badge === "F" ? "bg-zinc-500" : "bg-amber-500"} px-1.5 py-0.5 rounded`}>
      <Text className="font-mono-medium text-white" style={{ fontSize: 11, lineHeight: 14 }}>
        {PR_LABELS[badge]}
      </Text>
    </Animated.View>
  );
}

type Props = {
  set: ActiveSet;
  ghost?: GhostSet;
  prevSet?: ActiveSet;
  onUpdate: (patch: Partial<Pick<ActiveSet, "weightLbs" | "reps" | "rpe" | "notes">>) => void;
  onCommitEdit: () => void;
  onToggleComplete: () => void;
  onToggleWarmup: () => void;
  onRemove: () => void;
};

const WEIGHT_STEPS = [-5, -2.5, 2.5, 5];
const RPE_VALUES = ["6", "7", "8", "9", "10"];

export function SetRow({ set, ghost, prevSet, onUpdate, onCommitEdit, onToggleComplete, onToggleWarmup, onRemove }: Props) {
  const completed = set.isCompleted;
  const [focused, setFocused] = useState<"weight" | "reps" | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const note = set.notes ?? "";

  const previousText = set.isGhostFilled
    ? "—"
    : ghost?.weightLbs != null && ghost?.reps != null
    ? `${ghost.weightLbs} × ${ghost.reps}`
    : ghost?.weightLbs != null
    ? `${ghost.weightLbs} lb`
    : "—";

  const inputBase = "h-11 bg-surface-2 dark:bg-zinc-800 text-center font-mono text-text-primary dark:text-white text-sm rounded-lg";
  const focusBorder = { borderWidth: 1, borderColor: useColorScheme() === "dark" ? "#3B82F6" : "#2563EB" };

  // Completed sets stay editable; re-run the PR check once the user leaves the field.
  const handleBlur = () => {
    setFocused(null);
    if (completed) onCommitEdit();
  };

  const stepWeight =(delta: number) => {
    const next = Math.min(MAX_WEIGHT, Math.max(0, (parseFloat(set.weightLbs) || 0) + delta));
    onUpdate({ weightLbs: String(Math.round(next * 100) / 100) });
  };

  const chip = "h-9 px-3 mr-2 rounded-full bg-surface-2 dark:bg-zinc-800 items-center justify-center";
  const chipText = "font-mono-medium text-text-primary dark:text-white text-xs";

  return (
    <View className="border-b border-surface-2 dark:border-zinc-800">
    <View
      className={`flex-row items-center px-3 py-1 ${completed ? "opacity-50" : ""}`}
    >
      {/* Set number / warmup — long press to remove, tap to toggle warmup */}
      <TouchableOpacity
        onPress={onToggleWarmup}
        onLongPress={onRemove}
        className="w-12 h-12 items-center justify-center"
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
        onChangeText={(v) => { const c = cleanDecimal(v, MAX_WEIGHT); if (c !== null) onUpdate({ weightLbs: c }); }}
        keyboardType="decimal-pad"
        selectTextOnFocus
        onFocus={() => setFocused("weight")}
        onBlur={handleBlur}
        style={[set.isGhostFilled ? { opacity: 0.45 } : undefined, focused === "weight" ? focusBorder : undefined]}
      />

      {/* Reps */}
      <TextInput
        className={`${inputBase} w-12 mr-1.5`}
        placeholder="reps"
        placeholderTextColor="#94A3B8"
        value={set.reps}
        onChangeText={(v) => { const c = cleanInt(v, MAX_REPS); if (c !== null) onUpdate({ reps: c }); }}
        keyboardType="number-pad"
        selectTextOnFocus
        onFocus={() => setFocused("reps")}
        onBlur={handleBlur}
        style={[set.isGhostFilled ? { opacity: 0.45 } : undefined, focused === "reps" ? focusBorder : undefined]}
      />

      {/* Complete */}
      <TouchableOpacity
        onPress={() => { haptics.tap(); onToggleComplete(); }}
        className="w-12 h-12 items-center justify-center"
        activeOpacity={0.7}
      >
        <View
          className={`w-9 h-9 items-center justify-center rounded-full ${
            completed ? "bg-crimson dark:bg-blue-500" : "bg-surface-2 dark:bg-zinc-800"
          }`}
        >
          <Check size={18} color={completed ? "#FFFFFF" : "#94A3B8"} strokeWidth={2.5} />
        </View>
      </TouchableOpacity>
    </View>

    {/* PR badges + RPE (RPE chips live in the toolbar while editing) */}
    {((set.prBadges && set.prBadges.length > 0) || (set.rpe !== "" && focused === null)) && (
      <View className="flex-row items-center gap-1 px-3 pb-2">
        {set.rpe !== "" && focused === null && (
          <Text className="font-mono-medium text-text-secondary dark:text-zinc-400 text-xs mr-1">RPE {set.rpe}</Text>
        )}
        {(set.prBadges ?? []).map((badge) => (
          <PRBadgeChip key={badge} badge={badge} />
        ))}
      </View>
    )}

    {/* Quick-entry toolbar: weight stepper + repeat previous set */}
    {focused !== null && (
      <View className="flex-row items-center px-3 pb-2">
        {focused === "weight" &&
          WEIGHT_STEPS.map((d) => (
            <TouchableOpacity key={d} onPress={() => stepWeight(d)} className={chip} activeOpacity={0.7}>
              <Text className={chipText}>{d > 0 ? `+${d}` : d}</Text>
            </TouchableOpacity>
          ))}
        {prevSet && prevSet.weightLbs !== "" && prevSet.reps !== "" && (
          <TouchableOpacity
            onPress={() => onUpdate({ weightLbs: prevSet.weightLbs, reps: prevSet.reps })}
            className={chip}
            activeOpacity={0.7}
          >
            <Text className={chipText}>Same as prev</Text>
          </TouchableOpacity>
        )}
      </View>
    )}

    {/* Per-set note: shown when set, editable via the Note chip or by tapping it */}
    {noteOpen ? (
      <TextInput
        className="mx-3 mb-2 px-3 h-10 bg-surface-2 dark:bg-zinc-800 rounded-lg font-mono text-text-primary dark:text-white text-xs"
        placeholder="Set note (e.g. slow negatives)"
        placeholderTextColor="#94A3B8"
        value={note}
        onChangeText={(v) => onUpdate({ notes: v })}
        autoFocus
        maxLength={200}
        onBlur={() => setNoteOpen(false)}
      />
    ) : note !== "" ? (
      <TouchableOpacity onPress={() => setNoteOpen(true)} className="px-3 pb-2" activeOpacity={0.7}>
        <Text className="font-mono text-text-secondary dark:text-zinc-400 text-xs italic" numberOfLines={2}>{note}</Text>
      </TouchableOpacity>
    ) : null}

    {focused !== null && (
      <View className="flex-row items-center px-3 pb-2">
        <Text className="font-mono-medium text-text-muted dark:text-zinc-500 text-xs mr-2">RPE</Text>
        {RPE_VALUES.map((v) => (
          <TouchableOpacity
            key={v}
            onPress={() => onUpdate({ rpe: set.rpe === v ? "" : v })}
            className={set.rpe === v ? chip.replace("bg-surface-2 dark:bg-zinc-800", "bg-blue-500") : chip}
            activeOpacity={0.7}
          >
            <Text className={set.rpe === v ? "font-mono-medium text-white text-xs" : chipText}>{v}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity onPress={() => setNoteOpen(true)} className={`${chip} ml-auto mr-0`} activeOpacity={0.7}>
          <Text className={chipText}>{note ? "Edit note" : "Note"}</Text>
        </TouchableOpacity>
      </View>
    )}
    </View>
  );
}
