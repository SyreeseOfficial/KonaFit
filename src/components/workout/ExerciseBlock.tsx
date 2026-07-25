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
} from "react-native";
import * as Haptics from "expo-haptics";
import { MoreHorizontal, X, FileText, PlusCircle, ArrowLeftRight, ChevronDown, ChevronUp, History, ArrowUp, ArrowDown, Link } from "lucide-react-native";
import { SetRow } from "./SetRow";
import { ExerciseHistoryModal } from "./ExerciseHistoryModal";
import type { ActiveExercise, ActiveSet } from "../../types/workout";

type Props = {
  index: number;
  exercise: ActiveExercise;
  supersetId?: string;
  reorderMode?: boolean;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onAddSet: () => void;
  onRemoveSet: (setLocalId: string) => void;
  onUpdateSet: (setLocalId: string, patch: Partial<Pick<ActiveSet, "weightLbs" | "reps" | "rpe">>) => void;
  onToggleComplete: (setLocalId: string) => void;
  onToggleWarmup: (setLocalId: string) => void;
  onUpdateNotes: (notes: string) => void;
  onRemoveExercise: () => void;
  onSwap: () => void;
  onAddSuperset?: () => void;
};

export function ExerciseBlock({
  index,
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
  onToggleComplete,
  onToggleWarmup,
  onUpdateNotes,
  onRemoveExercise,
  onSwap,
  onAddSuperset,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (reorderMode) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setCollapsed(true);
    }
  }, [reorderMode]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [notesText, setNotesText] = useState(exercise.notes);

  return (
    <View
      className="mb-3 mx-5 bg-surface dark:bg-zinc-900 rounded-2xl overflow-hidden"
      style={supersetId ? { borderLeftWidth: 3, borderLeftColor: "#FF0000" } : undefined}
    >
      {/* ── Exercise header ───────────── */}
      <View className="flex-row items-center justify-between px-4 pt-4 pb-3">
        <TouchableOpacity
          onPress={() => { if (!reorderMode) { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setCollapsed((c) => !c); } }}
          className="flex-1 flex-row items-center gap-2"
          activeOpacity={reorderMode ? 1 : 0.7}
        >
          <Text className="font-mono text-text-muted dark:text-zinc-500 text-base">{index}</Text>
          <Text className="font-montserrat-bold text-text-primary dark:text-white text-base flex-shrink" numberOfLines={1}>
            {exercise.exerciseName}
          </Text>
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
        ) : null}
      </View>

      {/* ── Collapsed: set count summary ───────────── */}
      {collapsed && (
        <View className="flex-row items-center px-4 pb-4 gap-2">
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
          {/* Column headers */}
          <View className="flex-row items-center px-3 pt-1 pb-2">
            <Text className="w-10 text-center font-mono text-text-muted dark:text-zinc-500 text-xs">Set</Text>
            <Text className="flex-1 mx-2 text-center font-mono text-text-muted dark:text-zinc-500 text-xs">Previous</Text>
            <Text className="w-14 mr-1.5 text-center font-mono text-text-muted dark:text-zinc-500 text-xs">Lbs</Text>
            <Text className="w-12 mr-1.5 text-center font-mono text-text-muted dark:text-zinc-500 text-xs">Reps</Text>
            <View className="w-8 items-center">
              <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs">✓</Text>
            </View>
          </View>

          {/* Sets */}
          {exercise.sets.map((set) => (
            <SetRow
              key={set.localId}
              set={set}
              ghost={exercise.ghostSets.find((g) => g.setNumber === set.setNumber)}
              onUpdate={(patch) => onUpdateSet(set.localId, patch)}
              onToggleComplete={() => onToggleComplete(set.localId)}
              onToggleWarmup={() => onToggleWarmup(set.localId)}
              onRemove={() => onRemoveSet(set.localId)}
            />
          ))}

          {/* Notes preview */}
          {exercise.notes !== "" && (
            <TouchableOpacity
              onPress={() => { setNotesText(exercise.notes); setNotesOpen(true); }}
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
          <View className="flex-row items-center px-4 py-4 border-t border-surface-2 dark:border-zinc-800 gap-4">
            <TouchableOpacity onPress={onAddSet} className="flex-row items-center gap-1.5" activeOpacity={0.7}>
              <PlusCircle size={16} color="#64748B" />
              <Text className="font-montserrat-semibold text-text-secondary dark:text-zinc-400 text-sm">Add Set</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={onSwap} className="flex-row items-center gap-1.5" activeOpacity={0.7}>
              <ArrowLeftRight size={15} color="#64748B" />
              <Text className="font-montserrat-semibold text-text-secondary dark:text-zinc-400 text-sm">Swap</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setHistoryOpen(true)} className="flex-row items-center gap-1.5" activeOpacity={0.7}>
              <History size={15} color="#64748B" />
              <Text className="font-montserrat-semibold text-text-secondary dark:text-zinc-400 text-sm">History</Text>
            </TouchableOpacity>

            <View className="flex-1" />

            <TouchableOpacity onPress={() => setMenuOpen(true)} className="w-10 h-10 items-center justify-center" activeOpacity={0.7}>
              <MoreHorizontal size={18} color="#94A3B8" />
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
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
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
                onPress={() => { setMenuOpen(false); setNotesText(exercise.notes); setNotesOpen(true); }}
                className="px-5 py-4 border-b border-surface-2 dark:border-zinc-800"
                activeOpacity={0.7}
              >
                <Text className="font-montserrat-semibold text-text-primary dark:text-white text-base">Edit Notes</Text>
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
                onPress={() => { setMenuOpen(false); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); onRemoveExercise(); }}
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
                <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-xs mb-3">
                  Saved to this exercise for all future workouts
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
                <TouchableOpacity
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onUpdateNotes(notesText); setNotesOpen(false); }}
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
