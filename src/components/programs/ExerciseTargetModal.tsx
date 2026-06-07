import { useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
} from "react-native";
import { X } from "lucide-react-native";
import type { ProgramExercise } from "../../types/program";

type Props = {
  exercise: ProgramExercise | null;
  onSave: (patch: { targetSets: number | null; targetReps: string | null; targetRpe: number | null }) => void;
  onClose: () => void;
};

export function ExerciseTargetModal({ exercise, onSave, onClose }: Props) {
  const [sets, setSets] = useState(String(exercise?.targetSets ?? ""));
  const [reps, setReps] = useState(exercise?.targetReps ?? "");
  const [rpe, setRpe] = useState(String(exercise?.targetRpe ?? ""));

  if (!exercise) return null;

  const inputClass = "flex-1 h-10 bg-surface-3 px-3 font-mono text-white text-sm text-center";

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/70 justify-center px-6" onPress={onClose}>
        <Pressable>
          <View className="bg-surface-2">
            <View className="flex-row items-center justify-between px-4 py-4 border-b border-surface-3">
              <View className="flex-1">
                <Text className="font-montserrat-bold text-white text-xs tracking-widest uppercase">
                  {exercise.exerciseName}
                </Text>
                <Text className="font-mono text-text-muted text-xs">{exercise.muscleGroup}</Text>
              </View>
              <TouchableOpacity onPress={onClose} hitSlop={8}>
                <X size={18} color="#606060" />
              </TouchableOpacity>
            </View>

            <View className="p-4 gap-4">
              <View>
                <Text className="font-mono text-text-muted text-xs tracking-widest uppercase mb-2">
                  Targets
                </Text>
                <View className="flex-row gap-2">
                  <View className="flex-1 items-center gap-1">
                    <TextInput
                      className={inputClass}
                      placeholder="—"
                      placeholderTextColor="#606060"
                      value={sets}
                      onChangeText={setSets}
                      keyboardType="number-pad"
                      selectTextOnFocus
                    />
                    <Text className="font-mono text-text-muted text-xs">Sets</Text>
                  </View>
                  <View className="flex-1 items-center gap-1">
                    <TextInput
                      className={inputClass}
                      placeholder="—"
                      placeholderTextColor="#606060"
                      value={reps}
                      onChangeText={setReps}
                      autoCorrect={false}
                      selectTextOnFocus
                    />
                    <Text className="font-mono text-text-muted text-xs">Reps</Text>
                  </View>
                  <View className="flex-1 items-center gap-1">
                    <TextInput
                      className={inputClass}
                      placeholder="—"
                      placeholderTextColor="#606060"
                      value={rpe}
                      onChangeText={setRpe}
                      keyboardType="decimal-pad"
                      selectTextOnFocus
                    />
                    <Text className="font-mono text-text-muted text-xs">RPE</Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => {
                  const parsedSets = sets !== "" ? parseInt(sets, 10) : null;
                  const parsedRpe = rpe !== "" ? parseFloat(rpe) : null;
                  onSave({
                    targetSets: parsedSets && !isNaN(parsedSets) ? parsedSets : null,
                    targetReps: reps.trim() || null,
                    targetRpe: parsedRpe && !isNaN(parsedRpe) ? parsedRpe : null,
                  });
                  onClose();
                }}
                className="bg-crimson py-3 items-center"
                activeOpacity={0.8}
              >
                <Text className="font-montserrat-bold text-white text-xs tracking-widest uppercase">
                  Save
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
