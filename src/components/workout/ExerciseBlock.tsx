import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  Pressable,
} from "react-native";
import { MoreHorizontal, X, FileText } from "lucide-react-native";
import { SetRow } from "./SetRow";
import type { ActiveExercise, ActiveSet } from "../../types/workout";

type Props = {
  exercise: ActiveExercise;
  onAddSet: () => void;
  onRemoveSet: (setLocalId: string) => void;
  onUpdateSet: (setLocalId: string, patch: Partial<Pick<ActiveSet, "weightLbs" | "reps" | "rpe">>) => void;
  onToggleComplete: (setLocalId: string) => void;
  onToggleWarmup: (setLocalId: string) => void;
  onUpdateNotes: (notes: string) => void;
  onRemoveExercise: () => void;
};

export function ExerciseBlock({
  exercise,
  onAddSet,
  onRemoveSet,
  onUpdateSet,
  onToggleComplete,
  onToggleWarmup,
  onUpdateNotes,
  onRemoveExercise,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesText, setNotesText] = useState(exercise.notes);

  return (
    <View className="mb-4 bg-surface">
      {/* Exercise header */}
      <View className="flex-row items-center justify-between px-3 py-2.5 border-b border-surface-2">
        <View className="flex-1">
          <Text className="font-montserrat-bold text-white text-sm tracking-widest uppercase">
            {exercise.exerciseName}
          </Text>
          <Text className="font-mono text-text-muted text-xs tracking-wider">
            {exercise.muscleGroup}
          </Text>
        </View>
        <TouchableOpacity onPress={() => setMenuOpen(true)} hitSlop={8}>
          <MoreHorizontal size={18} color="#606060" />
        </TouchableOpacity>
      </View>

      {/* Column headers */}
      <View className="flex-row items-center gap-2 px-3 pt-2 pb-1">
        <View className="w-7" />
        <Text className="flex-1 text-center font-mono text-text-muted text-xs tracking-widest uppercase">
          Lbs
        </Text>
        <Text className="flex-1 text-center font-mono text-text-muted text-xs tracking-widest uppercase">
          Reps
        </Text>
        <Text className="w-12 text-center font-mono text-text-muted text-xs tracking-widest uppercase">
          RPE
        </Text>
        <View className="w-9" />
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
        <View className="px-3 py-1.5 flex-row items-center gap-1.5">
          <FileText size={11} color="#606060" />
          <Text className="font-mono text-text-muted text-xs flex-1" numberOfLines={1}>
            {exercise.notes}
          </Text>
        </View>
      )}

      {/* Add set */}
      <TouchableOpacity
        onPress={onAddSet}
        className="mx-3 mt-1 mb-3 py-2 border border-surface-3 items-center"
        activeOpacity={0.7}
      >
        <Text className="font-montserrat-semibold text-text-secondary text-xs tracking-widest uppercase">
          + Add Set
        </Text>
      </TouchableOpacity>

      {/* Context menu modal */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable className="flex-1 bg-black/60 justify-end" onPress={() => setMenuOpen(false)}>
          <Pressable>
            <View className="bg-surface-2 pb-8">
              <View className="flex-row items-center justify-between px-4 py-4 border-b border-surface-3">
                <Text className="font-montserrat-bold text-white text-sm tracking-widest uppercase">
                  {exercise.exerciseName}
                </Text>
                <TouchableOpacity onPress={() => setMenuOpen(false)}>
                  <X size={18} color="#606060" />
                </TouchableOpacity>
              </View>
              {[
                {
                  label: "Edit Notes",
                  action: () => {
                    setMenuOpen(false);
                    setNotesText(exercise.notes);
                    setNotesOpen(true);
                  },
                },
                {
                  label: "Remove Exercise",
                  danger: true,
                  action: () => {
                    setMenuOpen(false);
                    onRemoveExercise();
                  },
                },
              ].map((item) => (
                <TouchableOpacity
                  key={item.label}
                  onPress={item.action}
                  className="px-4 py-4 border-b border-surface-3"
                  activeOpacity={0.7}
                >
                  <Text
                    className={`font-montserrat-semibold text-sm tracking-wider ${
                      item.danger ? "text-crimson" : "text-white"
                    }`}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Notes modal */}
      <Modal visible={notesOpen} transparent animationType="slide" onRequestClose={() => setNotesOpen(false)}>
        <Pressable className="flex-1 bg-black/60 justify-end" onPress={() => setNotesOpen(false)}>
          <Pressable>
            <View className="bg-surface-2 pb-8 px-4 pt-4">
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
                onPress={() => {
                  onUpdateNotes(notesText);
                  setNotesOpen(false);
                }}
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
