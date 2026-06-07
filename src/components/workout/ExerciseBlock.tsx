import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  Pressable,
} from "react-native";
import { MoreHorizontal, X, FileText, PlusCircle, ArrowLeftRight, Timer, ChevronDown, ChevronUp, History, ArrowUp, ArrowDown } from "lucide-react-native";
import { SetRow } from "./SetRow";
import { ExerciseHistoryModal } from "./ExerciseHistoryModal";
import type { ActiveExercise, ActiveSet } from "../../types/workout";

type Props = {
  index: number;
  exercise: ActiveExercise;
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
  onTimerPress: () => void;
};

export function ExerciseBlock({
  index,
  exercise,
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
  onTimerPress,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [notesText, setNotesText] = useState(exercise.notes);

  return (
    <View className="mb-4 bg-surface">
      {/* ── Exercise header (tap name to collapse) ───────────── */}
      <View className="flex-row items-center justify-between px-4 pt-4 pb-3">
        <TouchableOpacity
          onPress={() => !reorderMode && setCollapsed((c) => !c)}
          className="flex-1 flex-row items-center gap-2"
          activeOpacity={reorderMode ? 1 : 0.7}
        >
          <Text className="font-montserrat-bold text-text-muted text-base">{index}</Text>
          <Text className="font-montserrat-bold text-white text-base flex-shrink" numberOfLines={1}>
            {exercise.exerciseName}
          </Text>
          {!reorderMode && (
            collapsed
              ? <ChevronDown size={15} color="#606060" />
              : <ChevronUp size={15} color="#606060" />
          )}
        </TouchableOpacity>

        {reorderMode ? (
          <View className="flex-row gap-1 ml-2">
            <TouchableOpacity
              onPress={onMoveUp}
              disabled={!canMoveUp}
              className={`w-9 h-9 items-center justify-center bg-surface-2 ${!canMoveUp ? "opacity-30" : ""}`}
              style={{ borderRadius: 6 }}
              activeOpacity={0.7}
            >
              <ArrowUp size={16} color="#A0A0A0" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onMoveDown}
              disabled={!canMoveDown}
              className={`w-9 h-9 items-center justify-center bg-surface-2 ${!canMoveDown ? "opacity-30" : ""}`}
              style={{ borderRadius: 6 }}
              activeOpacity={0.7}
            >
              <ArrowDown size={16} color="#A0A0A0" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            onPress={onTimerPress}
            className="w-10 h-10 bg-surface-2 items-center justify-center ml-3"
            style={{ borderRadius: 8 }}
            activeOpacity={0.7}
          >
            <Timer size={18} color="#606060" />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Collapsed: show set count summary only ───────────── */}
      {collapsed && (
        <View className="flex-row items-center px-4 pb-3 gap-2">
          <Text className="font-mono text-text-muted text-xs">
            {exercise.sets.length} {exercise.sets.length === 1 ? "set" : "sets"}
          </Text>
          {exercise.sets.some((s) => s.isCompleted) && (
            <Text className="font-mono text-crimson text-xs">
              · {exercise.sets.filter((s) => s.isCompleted).length} done
            </Text>
          )}
        </View>
      )}

      {/* ── Expanded content ─────────────────────────────────── */}
      {!collapsed && (
        <>
          {/* Column headers */}
          <View className="flex-row items-center px-3 pb-2">
            <Text className="w-6 text-center font-mono text-text-muted text-xs">Set</Text>
            <Text className="flex-1 mx-2 text-center font-mono text-text-muted text-xs">Previous</Text>
            <Text className="w-14 mr-1.5 text-center font-mono text-text-muted text-xs">Lbs</Text>
            <Text className="w-12 mr-1.5 text-center font-mono text-text-muted text-xs">Reps</Text>
            <Text className="w-10 mr-1.5 text-center font-mono text-text-muted text-xs">RPE</Text>
            <View className="w-8 items-center">
              <Text className="font-mono text-text-muted text-xs">✓</Text>
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
              className="flex-row items-center gap-1.5 px-4 py-2 border-t border-surface-2"
              activeOpacity={0.7}
            >
              <FileText size={11} color="#606060" />
              <Text className="font-mono text-text-muted text-xs flex-1" numberOfLines={1}>
                {exercise.notes}
              </Text>
            </TouchableOpacity>
          )}

          {/* Footer */}
          <View className="flex-row items-center px-4 py-3 border-t border-surface-2 gap-4">
            <TouchableOpacity onPress={onAddSet} className="flex-row items-center gap-1.5" activeOpacity={0.7}>
              <PlusCircle size={16} color="#A0A0A0" />
              <Text className="font-montserrat-semibold text-text-secondary text-xs tracking-wider">Add Set</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={onSwap} className="flex-row items-center gap-1.5" activeOpacity={0.7}>
              <ArrowLeftRight size={15} color="#A0A0A0" />
              <Text className="font-montserrat-semibold text-text-secondary text-xs tracking-wider">Swap</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setHistoryOpen(true)} className="flex-row items-center gap-1.5" activeOpacity={0.7}>
              <History size={15} color="#A0A0A0" />
              <Text className="font-montserrat-semibold text-text-secondary text-xs tracking-wider">History</Text>
            </TouchableOpacity>

            <View className="flex-1" />

            <TouchableOpacity onPress={() => setMenuOpen(true)} hitSlop={8} activeOpacity={0.7}>
              <MoreHorizontal size={18} color="#606060" />
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* ── Exercise History / PRs ───────────────────────────── */}
      <ExerciseHistoryModal
        visible={historyOpen}
        exerciseId={exercise.exerciseId}
        exerciseName={exercise.exerciseName}
        onClose={() => setHistoryOpen(false)}
      />

      {/* ── Context menu ─────────────────────────────────────── */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable className="flex-1 bg-black/60 justify-end" onPress={() => setMenuOpen(false)}>
          <Pressable>
            <View className="bg-surface-2 pb-10">
              <View className="flex-row items-center justify-between px-4 py-4 border-b border-surface-3">
                <Text className="font-montserrat-bold text-white text-xs tracking-widest uppercase flex-1" numberOfLines={1}>
                  {exercise.exerciseName}
                </Text>
                <TouchableOpacity onPress={() => setMenuOpen(false)} hitSlop={8}>
                  <X size={18} color="#606060" />
                </TouchableOpacity>
              </View>
              <TouchableOpacity
                onPress={() => { setMenuOpen(false); setNotesText(exercise.notes); setNotesOpen(true); }}
                className="px-4 py-4 border-b border-surface-3"
                activeOpacity={0.7}
              >
                <Text className="font-montserrat-semibold text-white text-sm">Edit Notes</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { setMenuOpen(false); onRemoveExercise(); }}
                className="px-4 py-4"
                activeOpacity={0.7}
              >
                <Text className="font-montserrat-semibold text-crimson text-sm">Remove Exercise</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Notes modal ──────────────────────────────────────── */}
      <Modal visible={notesOpen} transparent animationType="slide" onRequestClose={() => setNotesOpen(false)}>
        <Pressable className="flex-1 bg-black/60 justify-end" onPress={() => setNotesOpen(false)}>
          <Pressable>
            <View className="bg-surface-2 pb-10 px-4 pt-4">
              <Text className="font-montserrat-bold text-white text-xs tracking-widest uppercase mb-3">
                Notes — {exercise.exerciseName}
              </Text>
              <TextInput
                className="bg-surface-3 text-white font-mono text-sm p-3 min-h-20"
                placeholder="Cues, form reminders, substitutions..."
                placeholderTextColor="#606060"
                value={notesText}
                onChangeText={setNotesText}
                multiline
                autoFocus
              />
              <TouchableOpacity
                onPress={() => { onUpdateNotes(notesText); setNotesOpen(false); }}
                className="mt-3 bg-crimson py-3 items-center"
                activeOpacity={0.8}
              >
                <Text className="font-montserrat-bold text-white text-xs tracking-widest uppercase">
                  Save
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
