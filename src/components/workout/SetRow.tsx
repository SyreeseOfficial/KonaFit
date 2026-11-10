import { memo, useState, useEffect, useRef } from "react";
import { View, Text, TextInput, TouchableOpacity, Modal, Pressable, useColorScheme } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { Check, Trash2 } from "lucide-react-native";
import { haptics } from "../../utils/haptics";
import { columnsFor, isFilled, copyFields, ghostText, FIELD_META, type SetField } from "../../utils/setFields";
import type { ActiveSet, GhostSet, PRBadge, SetPatch, SetType } from "../../types/workout";

// Hoisted so rows don't allocate fresh style objects every render.
const BADGE_TEXT = { fontSize: 11, lineHeight: 14 } as const;
const FOCUS_LIGHT = { borderWidth: 1, borderColor: "#2563EB" } as const;
const FOCUS_DARK = { borderWidth: 1, borderColor: "#3B82F6" } as const;
const RPE_INPUT = { fontSize: 14 } as const;
const GHOST_INPUT = { opacity: 0.65 } as const;

const PR_LABELS: Record<PRBadge, string> = { W: "PR WT", R: "PR REP", V: "PR VOL", F: "FIRST TIME" };

const TYPE_LABELS: Record<SetType, string> = { drop: "DROP", failure: "FAILURE", amrap: "AMRAP", backoff: "BACKOFF", myo: "MYO-REPS" };

type Kind = "normal" | "warmup" | SetType;
const KINDS: { key: Kind; label: string; desc: string }[] = [
  { key: "normal", label: "Normal", desc: "A standard working set at your planned weight and reps." },
  { key: "warmup", label: "Warm-up", desc: "A lighter set to prep your muscles and joints; excluded from volume and PRs." },
  { key: "drop", label: "Drop", desc: "Right after a hard set, cut the weight ~20-30% and keep going with no rest." },
  { key: "failure", label: "Failure", desc: "Taken until you can't complete another rep with good form." },
  { key: "amrap", label: "AMRAP", desc: "\"As many reps as possible\" at a fixed weight; stop when form breaks." },
  { key: "backoff", label: "Backoff", desc: "After your heavy top set, drop the weight and do more reps for extra volume." },
  { key: "myo", label: "Myo-reps", desc: "One near-failure set, then short 3-5 breath rests and mini-sets of ~3-5 reps." },
];

function PRBadgeChip({ badge }: { badge: PRBadge }) {
  const scale = useSharedValue(0);
  useEffect(() => {
    scale.value = withSpring(1, { damping: 8, stiffness: 180 });
  }, []);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Animated.View style={style} className={`${badge === "F" ? "bg-zinc-500" : "bg-amber-700"} px-1.5 py-0.5 rounded`}>
      <Text className="font-mono-medium text-white" style={BADGE_TEXT}>
        {PR_LABELS[badge]}
      </Text>
    </Animated.View>
  );
}

type Props = {
  set: ActiveSet;
  bodyweight?: boolean; // weight is added load: may be negative (assisted)
  targetType?: string; // picks the inputs: lbs/reps/rpe, time, distance + time, calories
  ghost?: GhostSet;
  prevSet?: ActiveSet;
  isNext?: boolean; // the set to do now
  // Callbacks take the set's id so the parent can pass the same functions to every row (keeps memo() effective).
  onUpdate: (setLocalId: string, patch: SetPatch) => void;
  onCommitEdit: (setLocalId: string) => void;
  onToggleComplete: (setLocalId: string) => void;
  onToggleWarmup: (setLocalId: string) => void;
  onRemove: (setLocalId: string) => void;
  firstRef?: (setLocalId: string, input: TextInput | null) => void; // lets the parent focus this row's first field
  nextRowId?: string; // "Next" on the last field jumps to this row
  onFocusRow?: (setLocalId: string) => void;
};

export const SetRow = memo(function SetRow({ set, bodyweight, targetType, ghost, prevSet, isNext, onUpdate: update, onCommitEdit: commitEdit, onToggleComplete: toggleComplete, onToggleWarmup: toggleWarmup, onRemove: remove, firstRef, nextRowId, onFocusRow }: Props) {
  const id = set.localId;
  const onUpdate = (patch: SetPatch) => update(id, patch);
  const onCommitEdit = () => commitEdit(id);
  const onToggleComplete = () => toggleComplete(id);
  const onToggleWarmup = () => toggleWarmup(id);
  const onRemove = () => remove(id);
  const onNextRow = nextRowId && onFocusRow ? () => onFocusRow(nextRowId) : undefined;
  const completed = set.isCompleted;
  const [focused, setFocused] = useState<SetField | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const columns = columnsFor(targetType);
  const inputRefs = useRef<Partial<Record<SetField, TextInput | null>>>({});
  const kind: Kind = set.isWarmup ? "warmup" : set.setType ?? "normal";

  const pickKind = (k: Kind) => {
    setSheetOpen(false);
    if ((k === "warmup") !== set.isWarmup) onToggleWarmup();
    const type = k === "warmup" || k === "normal" ? undefined : k;
    if (type !== set.setType) onUpdate({ setType: type });
  };
  const note = set.notes ?? "";

  const previousText = set.isGhostFilled ? "—" : ghostText(ghost, targetType);

  const inputBase = "h-12 bg-surface-2 dark:bg-zinc-800 text-center font-mono-medium text-text-primary dark:text-white text-base rounded-lg";
  const focusBorder = useColorScheme() === "dark" ? FOCUS_DARK : FOCUS_LIGHT;

  // Completed sets stay editable; re-run the PR check once the user leaves the field.
  const handleBlur = () => {
    setFocused(null);
    if (completed) onCommitEdit();
  };

  const chip = "h-9 px-3 mr-2 rounded-full bg-surface-2 dark:bg-zinc-800 items-center justify-center";
  const chipText = "font-mono-medium text-text-primary dark:text-white text-xs";

  return (
    <View className="border-b border-surface-2 dark:border-zinc-800">
    <View
      className={`flex-row items-center px-3 py-1 ${completed ? "opacity-50" : ""}`}
    >
      {/* Set number: tap for set type, warm-up and delete */}
      <TouchableOpacity
        onPress={() => setSheetOpen(true)}
        className="w-10 h-12 items-center justify-center"
      >
        <Text
          className={`font-mono-medium text-base ${
            set.isWarmup ? "text-amber-500" : "text-text-secondary dark:text-zinc-400"
          }`}
        >
          {set.isWarmup ? "W" : set.setNumber}
        </Text>
      </TouchableOpacity>

      {/* Previous (ghost) */}
      <View className="flex-1 mx-1 items-center">
        <Text className="font-mono text-text-secondary dark:text-zinc-500 text-xs" numberOfLines={1}>
          {previousText}
        </Text>
      </View>

      {/* Inputs for this exercise type */}
      {columns.map((f, i) => {
        const meta = FIELD_META[f];
        const next = columns[i + 1];
        const weight = f === "weightLbs";
        return (
          <TextInput
            key={f}
            testID={`set-${f}`}
            ref={(r) => { inputRefs.current[f] = r; if (i === 0) firstRef?.(id, r); }}
            className={`${inputBase} ${meta.width} mr-1.5`}
            value={set[f] ?? ""}
            onChangeText={(v) => { const c = meta.clean(v, bodyweight); if (c !== null) onUpdate({ [f]: c }); }}
            keyboardType={weight && bodyweight ? "numbers-and-punctuation" : meta.keyboard}
            selectTextOnFocus
            returnKeyType={next || onNextRow ? "next" : "done"}
            blurOnSubmit={!next && !onNextRow}
            onSubmitEditing={next ? () => inputRefs.current[next]?.focus() : onNextRow}
            onFocus={() => setFocused(f)}
            onBlur={handleBlur}
            style={[
              f === "rpe" ? RPE_INPUT : set.isGhostFilled ? GHOST_INPUT : undefined,
              focused === f ? focusBorder : undefined,
            ]}
          />
        );
      })}

      {/* Complete */}
      <TouchableOpacity
        testID="set-complete"
        onPress={() => { if (completed) haptics.tap(); else haptics.setDone(); onToggleComplete(); }}
        className="w-12 h-12 items-center justify-center"
        activeOpacity={0.7}
      >
        <View
          className={`w-9 h-9 items-center justify-center rounded-full ${
            completed ? "bg-emerald-500" : "bg-surface-2 dark:bg-zinc-800"
          }`}
        >
          <Check size={18} color={completed ? "#FFFFFF" : "#94A3B8"} strokeWidth={2.5} />
        </View>
      </TouchableOpacity>
    </View>

    {/* Set type + PR badges */}
    {((set.prBadges && set.prBadges.length > 0) || set.setType) && (
      <View className="flex-row items-center gap-1 px-3 pb-2">
        {set.setType && (
          <View className="bg-surface-3 dark:bg-zinc-700 px-1.5 py-0.5 rounded">
            <Text className="font-mono-medium text-text-primary dark:text-white" style={BADGE_TEXT}>
              {TYPE_LABELS[set.setType]}
            </Text>
          </View>
        )}
        {(set.prBadges ?? []).map((badge) => (
          <PRBadgeChip key={badge} badge={badge} />
        ))}
      </View>
    )}

    {/* Quick-entry toolbar: repeat previous set + note (ml-auto keeps Note right when alone) */}
    {focused !== null && (
      <View className="flex-row items-center px-3 pb-2">
        {prevSet && isFilled(prevSet, targetType, bodyweight) && (
          <TouchableOpacity
            onPress={() => onUpdate(copyFields(prevSet, targetType, false))}
            className={chip}
            activeOpacity={0.7}
          >
            <Text className={chipText}>Same as prev</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => setNoteOpen(true)} className={`${chip} ml-auto mr-0`} activeOpacity={0.7}>
          <Text className={chipText}>{note ? "Edit note" : "Note"}</Text>
        </TouchableOpacity>
      </View>
    )}

    {/* Reps in reserve for the typed RPE */}
    {focused === "rpe" && set.rpe !== "" && !isNaN(parseFloat(set.rpe)) && (
      <Text className="px-3 pb-2 font-mono text-text-muted dark:text-zinc-500 text-xs">
        ≈ {Math.max(0, 10 - parseFloat(set.rpe))} reps in reserve
      </Text>
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

    {/* Set type / delete */}
    {sheetOpen && <Modal visible transparent animationType="fade" onRequestClose={() => setSheetOpen(false)}>
      <Pressable className="flex-1 bg-black/50 justify-end" onPress={() => setSheetOpen(false)}>
        <Pressable>
          <View className="bg-surface dark:bg-zinc-900 rounded-t-3xl pb-10">
            <Text className="font-montserrat-bold text-text-primary dark:text-white text-base px-5 py-5 border-b border-surface-2 dark:border-zinc-800">
              Set {set.setNumber}
            </Text>
            <View className="py-2">
              {KINDS.map((k) => (
                <TouchableOpacity
                  key={k.key}
                  onPress={() => pickKind(k.key)}
                  className={`mx-3 px-3 py-3 rounded-xl ${kind === k.key ? "bg-crimson dark:bg-blue-500" : ""}`}
                  activeOpacity={0.7}
                >
                  <Text className={`font-montserrat-semibold text-sm ${kind === k.key ? "text-white" : "text-text-primary dark:text-white"}`}>{k.label}</Text>
                  <Text className={`font-mono text-xs mt-0.5 ${kind === k.key ? "text-white/90" : "text-text-secondary dark:text-zinc-400"}`}>{k.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              onPress={() => { setSheetOpen(false); haptics.warn(); onRemove(); }}
              className="flex-row items-center gap-3 px-5 py-4 border-t border-surface-2 dark:border-zinc-800"
              activeOpacity={0.5}
            >
              <Trash2 size={16} color="#F43F5E" />
              <Text className="font-montserrat-semibold text-rose-500 text-base">Delete set</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>}

    </View>
  );
});
