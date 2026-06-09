import { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import {
  ChevronLeft,
  Plus,
  Trash2,
  Settings2,
  Zap,
  MoreHorizontal,
  Copy,
} from "lucide-react-native";
import {
  getProgramWithDays,
  createProgramDay,
  deleteProgramDay,
  updateProgramDay,
  addProgramExercise,
  deleteProgramExercise,
  updateProgramExercise,
  updateProgram,
  deleteProgram,
  cloneProgram,
} from "../../../src/db/programQueries";
import { AddExerciseSheet } from "../../../src/components/workout/AddExerciseSheet";
import { ExerciseTargetModal } from "../../../src/components/programs/ExerciseTargetModal";
import type { Program, ProgramDay, ProgramExercise } from "../../../src/types/program";
import type { Exercise } from "../../../src/types/workout";

const DAY_NAMES = ["Day A", "Day B", "Day C", "Day D", "Day E", "Day F"];

export default function ProgramDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const programId = parseInt(id, 10);

  const [program, setProgram] = useState<Program | null>(null);
  const [addExerciseDayId, setAddExerciseDayId] = useState<number | null>(null);
  const [editExercise, setEditExercise] = useState<ProgramExercise | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");

  const load = useCallback(async () => {
    const data = await getProgramWithDays(programId);
    setProgram(data);
  }, [programId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!program) return null;

  const handleAddDay = async () => {
    const nextName = DAY_NAMES[program.days.length] ?? `Day ${program.days.length + 1}`;
    await createProgramDay(programId, nextName, program.days.length);
    load();
  };

  const handleDeleteDay = (day: ProgramDay) => {
    Alert.alert("Delete Day", `Remove "${day.name}" and all its exercises?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => { await deleteProgramDay(day.id); load(); },
      },
    ]);
  };

  const handleSelectExercise = async (exercise: Exercise) => {
    if (!addExerciseDayId) return;
    const day = program.days.find((d) => d.id === addExerciseDayId);
    if (!day) return;
    await addProgramExercise(
      addExerciseDayId,
      exercise.id,
      exercise.name,
      exercise.muscle_group,
      day.exercises.length
    );
    load();
  };

  const handleDeleteExercise = (ex: ProgramExercise) => {
    Alert.alert("Remove Exercise", `Remove "${ex.exerciseName}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => { await deleteProgramExercise(ex.id); load(); },
      },
    ]);
  };

  const handleSaveExerciseTarget = async (patch: {
    targetSets: number | null;
    targetReps: string | null;
    targetRpe: number | null;
  }) => {
    if (!editExercise) return;
    await updateProgramExercise(editExercise.id, patch);
    load();
  };

  const handleSaveName = async () => {
    if (!nameInput.trim()) return;
    await updateProgram(programId, { name: nameInput });
    setEditingName(false);
    load();
  };

  const handleDelete = () => {
    Alert.alert("Delete Program", `Delete "${program.name}"? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteProgram(programId);
          router.back();
        },
      },
    ]);
  };

  const handleClone = async () => {
    await cloneProgram(programId);
    router.back();
  };

  const handleLaunch = (day: ProgramDay) => {
    router.navigate({
      pathname: "/(tabs)/train",
      params: { programDayId: String(day.id) },
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-obsidian">
      {/* Header */}
      <View className="flex-row items-center gap-3 px-4 pt-4 pb-4 border-b border-surface-2">
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} activeOpacity={0.7}>
          <ChevronLeft size={22} color="#A0A0A0" />
        </TouchableOpacity>
        <View className="flex-1">
          {editingName ? (
            <TextInput
              className="font-anton text-white text-xl tracking-widest uppercase border-b border-crimson pb-0.5"
              value={nameInput}
              onChangeText={setNameInput}
              onSubmitEditing={handleSaveName}
              onBlur={handleSaveName}
              autoFocus
              returnKeyType="done"
            />
          ) : (
            <TouchableOpacity
              onPress={() => { setNameInput(program.name); setEditingName(true); }}
              activeOpacity={0.7}
            >
              <Text className="font-anton text-white text-xl tracking-widest uppercase">
                {program.name}
              </Text>
            </TouchableOpacity>
          )}
          {program.description ? (
            <Text className="font-montserrat text-text-muted text-xs mt-0.5" numberOfLines={1}>
              {program.description}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity onPress={() => setMenuOpen(true)} hitSlop={8}>
          <MoreHorizontal size={20} color="#A0A0A0" />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 56 }}>
        {/* Days */}
        {program.days.map((day) => (
          <View key={day.id} className="mt-5 mx-4 bg-surface">
            {/* Day header */}
            <View className="flex-row items-center justify-between px-4 py-4 border-b border-surface-2">
              <Text className="font-montserrat-bold text-white text-sm tracking-widest uppercase">
                {day.name}
              </Text>
              <View className="flex-row items-center gap-3">
                <TouchableOpacity
                  onPress={() => handleLaunch(day)}
                  className="bg-crimson flex-row items-center gap-1.5 px-3 py-1.5"
                  activeOpacity={0.8}
                >
                  <Zap size={12} color="#FFFFFF" />
                  <Text className="font-montserrat-bold text-white text-xs tracking-widest uppercase">
                    Launch
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDeleteDay(day)}
                  hitSlop={8}
                  activeOpacity={0.7}
                >
                  <Trash2 size={15} color="#606060" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Exercises */}
            {day.exercises.length === 0 ? (
              <View className="px-4 py-3">
                <Text className="font-montserrat text-text-muted text-xs">
                  No exercises — tap + to add
                </Text>
              </View>
            ) : (
              day.exercises.map((ex) => (
                <View
                  key={ex.id}
                  className="flex-row items-center px-4 py-4 border-b border-surface-2"
                >
                  <View className="flex-1">
                    <Text className="font-montserrat-semibold text-white text-xs tracking-wider">
                      {ex.exerciseName}
                    </Text>
                    <View className="flex-row gap-2 mt-0.5">
                      <Text className="font-mono text-text-muted text-xs">
                        {ex.muscleGroup}
                      </Text>
                      {ex.targetSets && (
                        <Text className="font-mono text-text-secondary text-xs">
                          {ex.targetSets} × {ex.targetReps ?? "—"}
                          {ex.targetRpe ? ` @ RPE ${ex.targetRpe}` : ""}
                        </Text>
                      )}
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => setEditExercise(ex)}
                    hitSlop={8}
                    activeOpacity={0.7}
                    className="mr-3"
                  >
                    <Settings2 size={15} color="#606060" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteExercise(ex)}
                    hitSlop={8}
                    activeOpacity={0.7}
                  >
                    <Trash2 size={15} color="#606060" />
                  </TouchableOpacity>
                </View>
              ))
            )}

            {/* Add exercise to day */}
            <TouchableOpacity
              onPress={() => setAddExerciseDayId(day.id)}
              className="flex-row items-center justify-center gap-2 py-4"
              activeOpacity={0.7}
            >
              <Plus size={14} color="#606060" />
              <Text className="font-montserrat-semibold text-text-muted text-xs tracking-widest uppercase">
                Add Exercise
              </Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* Add day */}
        <TouchableOpacity
          onPress={handleAddDay}
          className="mx-4 mt-5 py-5 border border-surface-3 flex-row items-center justify-center gap-2"
          activeOpacity={0.7}
        >
          <Plus size={15} color="#A0A0A0" />
          <Text className="font-montserrat-semibold text-text-secondary text-xs tracking-widest uppercase">
            Add Day
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Context menu */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable className="flex-1 bg-black/60 justify-end" onPress={() => setMenuOpen(false)}>
          <Pressable>
            <View className="bg-surface-2 pb-8">
              <View className="flex-row items-center justify-between px-4 py-4 border-b border-surface-3">
                <Text className="font-montserrat-bold text-white text-xs tracking-widest uppercase">
                  {program.name}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => { setMenuOpen(false); handleClone(); }}
                className="flex-row items-center gap-3 px-4 py-4 border-b border-surface-3"
                activeOpacity={0.7}
              >
                <Copy size={16} color="#A0A0A0" />
                <Text className="font-montserrat-semibold text-white text-sm">Clone Program</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { setMenuOpen(false); handleDelete(); }}
                className="flex-row items-center gap-3 px-4 py-4"
                activeOpacity={0.7}
              >
                <Trash2 size={16} color="#FF0000" />
                <Text className="font-montserrat-semibold text-crimson text-sm">Delete Program</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Add exercise sheet */}
      <AddExerciseSheet
        visible={addExerciseDayId !== null}
        onClose={() => setAddExerciseDayId(null)}
        onSelect={handleSelectExercise}
        multiSelect
      />

      {/* Edit exercise target modal */}
      <ExerciseTargetModal
        exercise={editExercise}
        onSave={handleSaveExerciseTarget}
        onClose={() => setEditExercise(null)}
      />
    </SafeAreaView>
  );
}
