import { useState } from "react";
import {
  Modal, View, Text, TextInput, TouchableOpacity, Pressable,
  KeyboardAvoidingView, Platform,
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

  const inputClass = "flex-1 h-12 bg-surface-2 dark:bg-zinc-800 px-3 font-mono text-text-primary dark:text-white text-base text-center rounded-xl";

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <Pressable className="flex-1 bg-black/70 justify-center px-6" onPress={onClose}>
          <Pressable>
            <View className="bg-surface dark:bg-zinc-900 rounded-2xl overflow-hidden">
              <View className="flex-row items-center justify-between px-5 py-4 border-b border-surface-2 dark:border-zinc-800">
                <View className="flex-1">
                  <Text className="font-montserrat-bold text-text-primary dark:text-white text-base">
                    {exercise.exerciseName}
                  </Text>
                  <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs mt-0.5">{exercise.muscleGroup}</Text>
                </View>
                <TouchableOpacity onPress={onClose} hitSlop={8}>
                  <X size={18} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              <View className="p-5 gap-4">
                <View>
                  <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs uppercase tracking-widest mb-3">
                    Targets
                  </Text>
                  <View className="flex-row gap-2">
                    <View className="flex-1 items-center gap-1.5">
                      <TextInput className={inputClass} placeholder="—" placeholderTextColor="#94A3B8" value={sets} onChangeText={setSets} keyboardType="number-pad" selectTextOnFocus />
                      <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs">Sets</Text>
                    </View>
                    <View className="flex-1 items-center gap-1.5">
                      <TextInput className={inputClass} placeholder="—" placeholderTextColor="#94A3B8" value={reps} onChangeText={setReps} autoCorrect={false} selectTextOnFocus />
                      <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs">Reps</Text>
                    </View>
                    <View className="flex-1 items-center gap-1.5">
                      <TextInput className={inputClass} placeholder="—" placeholderTextColor="#94A3B8" value={rpe} onChangeText={setRpe} keyboardType="decimal-pad" selectTextOnFocus />
                      <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs">RPE</Text>
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
                  className="bg-crimson dark:bg-blue-500 py-4 items-center rounded-2xl"
                  activeOpacity={0.85}
                >
                  <Text className="font-montserrat-bold text-white text-base">Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
