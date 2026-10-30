import { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  LayoutAnimation,
  Switch,
} from "react-native";
import { haptics } from "../../utils/haptics";
import { MoreHorizontal, X, FileText, PlusCircle, ArrowLeftRight, ChevronDown, ChevronUp, Check, History, ArrowUp, ArrowDown, Link } from "lucide-react-native";
import { SetRow } from "./SetRow";
import { ExerciseHistoryModal } from "./ExerciseHistoryModal";
import { ExerciseHint } from "./ExerciseHint";
import type { ActiveExercise, ActiveSet } from "../../types/workout";

type Props = {
  isCurrent?: boolean;
  exercise: ActiveExercise;
  supersetId?: string;
  reorderMode?: boolean;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onAddSet: () => void;
  onRemoveSet: (setLocalId: string) => void;
  onUpdateSet: (setLocalId: string, patch: Partial<Pick<ActiveSet, "weightLbs" | "reps" | "rpe" | "notes" | "setType">>) => void;
  onCopyLastToAll: () => void;
  onApplySuggestion: (weight: number, reps: number) => void;
  onAddWarmups: (count: number) => void;
  onTogglePerHand: () => void;
  onToggleDone: () => void;
  onCommitSetEdit: (setLocalId: string) => void;
  onToggleComplete: (setLocalId: string) => void;
  onToggleWarmup: (setLocalId: string) => void;
  onUpdateNotes: (notes: string, saveAsDefault: boolean) => void;
  onRemoveExercise: () => void;
  onSwap: () => void;
  onAddSuperset?: () => void;
};

export function ExerciseBlock({
  isCurrent = false,
  exercise,
  supersetId,
  reorderMode = false,
  canMoveUp = false,
  canMoveDown = false,
  onMoveUp,
  onMoveDown,
  onAddSet,
  onRemoveSet,
  onUpdateSet,
  onCopyLastToAll,
  onApplySuggestion,
  onAddWarmups,
  onTogglePerHand,
  onToggleDone,
  onCommitSetEdit,
  onToggleComplete,
  onToggleWarmup,
  onUpdateNotes,
  onRemoveExercise,
  onSwap,
  onAddSuperset,
}: Props) {
  // Only the exercise in play starts open; finished and upcoming ones fold to a single row.
  const [collapsed, setCollapsed] = useState(!isCurrent);

  useEffect(() => {
    if (reorderMode) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setCollapsed(true);
    }
  }, [reorderMode]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [warmupPickOpen, setWarmupPickOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [notesText, setNotesText] = useState(exercise.notes);
  const [saveAsDefault, setSaveAsDefault] = useState(false);

  const doneCount = exercise.sets.filter((s) => s.isCompleted).length;
  const setsDone = exercise.sets.length > 0 && doneCount === exercise.sets.length;
  const allDone = setsDone || !!exercise.isDone;

  // Focus follows the lifter: open when it becomes the current exercise.
  useEffect(() => {
    if (reorderMode) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (isCurrent) setCollapsed(false);
  }, [isCurrent]);

  return (
    <View
      className="mb-3 mx-5 rounded-2xl overflow-hidden bg-surface dark:bg-zinc-900"
    >
      {/* ── Exercise header ───────────── */}
      <View className="flex-row items-center justify-between px-4 pt-3 pb-2">
        <TouchableOpacity
          onPress={() => { if (!reorderMode) { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setCollapsed((c) => !c); } }}
          className="flex-1 flex-row items-center gap-2 min-h-11"
          activeOpacity={reorderMode ? 1 : 0.7}
        >
          {supersetId && <Link size={14} color="#2563EB" />}
          <Text
            className={`font-montserrat-bold text-lg flex-shrink ${allDone ? "text-text-muted dark:text-zinc-500" : "text-text-primary dark:text-white"}`}
            numberOfLines={1}
          >
            {exercise.exerciseName}
          </Text>
          {!allDone && doneCount > 0 && (
            <Text className="font-mono text-crimson dark:text-blue-400 text-sm">{doneCount}/{exercise.sets.length}</Text>
          )}
          {!reorderMode && (
            collapsed
              ? <ChevronDown size={15} color="#94A3B8" />
              : <ChevronUp size={15} color="#94A3B8" />
          )}
        </TouchableOpacity>

        {reorderMode ? (
          <View className="flex-row gap-1 ml-2">
            <TouchableOpacity
              onPress={onMoveUp}
              disabled={!canMoveUp}
              className={`w-9 h-9 items-center justify-center bg-surface-2 dark:bg-zinc-800 rounded-xl ${!canMoveUp ? "opacity-30" : ""}`}
              activeOpacity={0.7}
            >
              <ArrowUp size={16} color="#64748B" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onMoveDown}
              disabled={!canMoveDown}
              className={`w-9 h-9 items-center justify-center bg-surface-2 dark:bg-zinc-800 rounded-xl ${!canMoveDown ? "opacity-30" : ""}`}
              activeOpacity={0.7}
            >
              <ArrowDown size={16} color="#64748B" />
            </TouchableOpacity>
          </View>
        ) : (
          // Manual done toggle; locked on while every set is checked (uncheck a set to undo)
          <TouchableOpacity
            onPress={() => {
              haptics.tap();
              if (!exercise.isDone) { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setCollapsed(true); }
              onToggleDone();
            }}
            disabled={setsDone}
            hitSlop={8}
            className={`w-11 h-11 ml-1 rounded-full items-center justify-center ${allDone ? "bg-emerald-500" : "bg-surface-2 dark:bg-zinc-800"}`}
            activeOpacity={0.7}
          >
            <Check size={18} color={allDone ? "#FFFFFF" : "#94A3B8"} strokeWidth={3} />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Collapsed: set count summary ───────────── */}
      {collapsed && (
        <View className="flex-row items-center px-4 pb-3 gap-2">
          <Text className="font-mono text-text-muted dark:text-zinc-500 text-sm">
            {exercise.sets.length} {exercise.sets.length === 1 ? "set" : "sets"}
          </Text>
          {exercise.sets.some((s) => s.isCompleted) && (
            <Text className="font-mono text-crimson dark:text-blue-400 text-sm">
              · {exercise.sets.filter((s) => s.isCompleted).length} done
            </Text>
          )}
        </View>
      )}

      {/* ── Expanded content ─────────────────────────────────── */}
      {!collapsed && (
        <>
          <ExerciseHint exercise={exercise} onApply={onApplySuggestion} />

          {/* Column headers */}
          <View className="flex-row items-center px-3 pt-1 pb-2">
            <Text className="w-10 text-center font-mono text-text-muted dark:text-zinc-500 text-xs">Set</Text>
            <Text className="flex-1 mx-1 text-center font-mono text-text-muted dark:text-zinc-500 text-xs">Previous</Text>
            <Text className="w-16 mr-1.5 text-center font-mono text-text-muted dark:text-zinc-500 text-xs">{exercise.perHand ? "Lbs/hd" : "Lbs"}</Text>
            <Text className="w-12 mr-1.5 text-center font-mono text-text-muted dark:text-zinc-500 text-xs">Reps</Text>
            <Text className="w-10 mr-1.5 text-center font-mono text-text-muted dark:text-zinc-500 text-xs">RPE</Text>
            <View className="w-12" />
          </View>

          {/* Sets */}
          {exercise.sets.map((set, i) => (
            <SetRow
              key={set.localId}
              set={set}
              bodyweight={exercise.isBodyweight}
              prevSet={exercise.sets[i - 1]}
              isNext={isCurrent && i === exercise.sets.findIndex((x) => !x.isCompleted)}
              ghost={exercise.ghostSets.find((g) => g.setNumber === set.setNumber)}
              onUpdate={(patch) => onUpdateSet(set.localId, patch)}
              onCommitEdit={() => onCommitSetEdit(set.localId)}
              onToggleComplete={() => onToggleComplete(set.localId)}
              onToggleWarmup={() => onToggleWarmup(set.localId)}
              onRemove={() => onRemoveSet(set.localId)}
            />
          ))}

          {/* Notes preview */}
          {exercise.notes !== "" && (
            <TouchableOpacity
              onPress={() => { setNotesText(exercise.notes); setSaveAsDefault(false); setNotesOpen(true); }}
              className="flex-row items-center gap-1.5 px-4 py-3 border-t border-surface-2 dark:border-zinc-800"
              activeOpacity={0.7}
            >
              <FileText size={12} color="#94A3B8" />
              <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-sm flex-1" numberOfLines={1}>
                {exercise.notes}
              </Text>
            </TouchableOpacity>
          )}

          {/* Footer */}
          <View className="flex-row items-center px-3 py-3 border-t border-surface-2 dark:border-zinc-800 gap-2">
            <TouchableOpacity onPress={onAddSet} className="flex-1 flex-row items-center justify-center gap-1.5 h-11 rounded-xl bg-surface-2 dark:bg-zinc-800" activeOpacity={0.7}>
              <PlusCircle size={16} color="#64748B" />
              <Text className="font-montserrat-semibold text-text-secondary dark:text-zinc-400 text-sm">Add set</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setHistoryOpen(true)} accessibilityLabel="Exercise history" className="w-11 h-11 items-center justify-center" activeOpacity={0.7}>
              <History size={18} color="#64748B" />
            </TouchableOpacity>

            <TouchableOpacity onPress={onSwap} accessibilityLabel="Swap exercise" className="w-11 h-11 items-center justify-center" activeOpacity={0.7}>
              <ArrowLeftRight size={18} color="#64748B" />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setMenuOpen(true)} accessibilityLabel="More actions" className="w-11 h-11 items-center justify-center" activeOpacity={0.7}>
              <MoreHorizontal size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* ── Exercise History / PRs ───────────────────── */}
      <ExerciseHistoryModal
        visible={historyOpen}
        exerciseId={exercise.exerciseId}
        exerciseName={exercise.exerciseName}
        onClose={() => setHistoryOpen(false)}
      />

      {/* ── Context menu ─────────────────────────────────────── */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)} onShow={() => setWarmupPickOpen(false)}>
        <Pressable className="flex-1 bg-black/50 justify-end" onPress={() => setMenuOpen(false)}>
          <Pressable>
            <View className="bg-surface dark:bg-zinc-900 rounded-t-3xl pb-10">
              <View className="flex-row items-center justify-between px-5 py-5 border-b border-surface-2 dark:border-zinc-800">
                <Text className="font-montserrat-bold text-text-primary dark:text-white text-base flex-1" numberOfLines={1}>
                  {exercise.exerciseName}
                </Text>
                <TouchableOpacity onPress={() => setMenuOpen(false)} hitSlop={8}>
                  <X size={20} color="#94A3B8" />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                onPress={() => { setMenuOpen(false); setNotesText(exercise.notes); setSaveAsDefault(false); setNotesOpen(true); }}
                className="px-5 py-4 border-b border-surface-2 dark:border-zinc-800"
                activeOpacity={0.7}
              >
                <Text className="font-montserrat-semibold text-text-primary dark:text-white text-base">Edit Notes</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setWarmupPickOpen((o) => !o)}
                className="px-5 py-4 border-b border-surface-2 dark:border-zinc-800"
                activeOpacity={0.7}
              >
                <Text className="font-montserrat-semibold text-text-primary dark:text-white text-base">Add warm-up sets</Text>
              </TouchableOpacity>
              {warmupPickOpen && (
                <View className="flex-row items-center gap-2 px-5 py-3 border-b border-surface-2 dark:border-zinc-800">
                  <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs mr-1">How many?</Text>
                  {[1, 2, 3, 4].map((n) => (
                    <TouchableOpacity
                      key={n}
                      onPress={() => { setMenuOpen(false); setWarmupPickOpen(false); onAddWarmups(n); }}
                      className="w-11 h-11 items-center justify-center rounded-full bg-surface-2 dark:bg-zinc-800"
                      activeOpacity={0.7}
                    >
                      <Text className="font-mono-medium text-text-primary dark:text-white text-base">{n}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              <TouchableOpacity
                onPress={() => { setMenuOpen(false); onTogglePerHand(); }}
                className="px-5 py-4 border-b border-surface-2 dark:border-zinc-800"
                activeOpacity={0.7}
              >
                <Text className="font-montserrat-semibold text-text-primary dark:text-white text-base">
                  {exercise.perHand ? "Weight is per hand: on" : "Weight is per hand: off"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { setMenuOpen(false); onCopyLastToAll(); }}
                className="px-5 py-4 border-b border-surface-2 dark:border-zinc-800"
                activeOpacity={0.7}
              >
                <Text className="font-montserrat-semibold text-text-primary dark:text-white text-base">Copy last set to all</Text>
              </TouchableOpacity>
              {onAddSuperset && (
                <TouchableOpacity
                  onPress={() => { setMenuOpen(false); onAddSuperset(); }}
                  className="px-5 py-4 border-b border-surface-2 dark:border-zinc-800 flex-row items-center gap-3"
                  activeOpacity={0.7}
                >
                  <Link size={16} color="#94A3B8" />
                  <Text className="font-montserrat-semibold text-text-primary dark:text-white text-base">Superset with…</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => { setMenuOpen(false); haptics.warn(); onRemoveExercise(); }}
                className="px-5 py-4"
                activeOpacity={0.5}
              >
                <Text className="font-montserrat-semibold text-rose-500 text-base">Remove Exercise</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Notes modal ──────────────────────────────────────── */}
      <Modal visible={notesOpen} transparent animationType="slide" onRequestClose={() => setNotesOpen(false)}>
        <Pressable className="flex-1 bg-black/50" onPress={() => setNotesOpen(false)}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1, justifyContent: "flex-end" }}
          >
            <Pressable>
              <View className="bg-surface dark:bg-zinc-900 rounded-t-3xl pb-10 px-5 pt-5">
                <Text className="font-montserrat-bold text-text-primary dark:text-white text-base mb-3">
                  Notes — {exercise.exerciseName}
                </Text>

                <TextInput
                  className="bg-surface-2 dark:bg-zinc-800 text-text-primary dark:text-white font-montserrat text-base p-4 min-h-24 rounded-xl"
                  placeholder="Cues, form reminders, substitutions…"
                  placeholderTextColor="#94A3B8"
                  value={notesText}
                  onChangeText={setNotesText}
                  multiline
                  autoFocus
                />
                <View className="flex-row items-center justify-between mt-3">
                  <Text className="font-montserrat text-text-secondary dark:text-zinc-400 text-sm flex-1 mr-3">
                    Also prefill this note in future workouts
                  </Text>
                  <Switch value={saveAsDefault} onValueChange={setSaveAsDefault} />
                </View>
                <TouchableOpacity
                  onPress={() => { haptics.tap(); onUpdateNotes(notesText, saveAsDefault); setNotesOpen(false); }}
                  className="mt-3 bg-crimson dark:bg-blue-500 py-4 items-center rounded-2xl"
                  activeOpacity={0.85}
                >
                  <Text className="font-montserrat-bold text-white text-base">
                    Save
                  </Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </View>
  );
}
