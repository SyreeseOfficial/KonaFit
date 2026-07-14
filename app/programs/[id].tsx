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
  addProgramExercise,
  deleteProgramExercise,
  updateProgramExercise,
  updateProgram,
  deleteProgram,
  cloneProgram,
  getLastUsedDatesByDay,
} from "../../src/db/programQueries";
import { AddExerciseSheet } from "../../src/components/workout/AddExerciseSheet";
import { ExerciseTargetModal } from "../../src/components/programs/ExerciseTargetModal";
import type { Program, ProgramDay, ProgramExercise } from "../../src/types/program";
import type { Exercise } from "../../src/types/workout";

const DAY_NAMES = ["Day A", "Day B", "Day C", "Day D", "Day E", "Day F"];

function lastDoneLabel(ts: number): string {
  const days = Math.floor((Date.now() / 1000 - ts) / 86400);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export default function ProgramDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const programId = parseInt(id, 10);

  const [program, setProgram] = useState<Program | null>(null);
  const [lastUsedDates, setLastUsedDates] = useState<Record<number, number>>({});
  const [addExerciseDayId, setAddExerciseDayId] = useState<number | null>(null);
  const [editExercise, setEditExercise] = useState<ProgramExercise | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");

  const load = useCallback(async () => {
    const [data, dates] = await Promise.all([
      getProgramWithDays(programId),
      getLastUsedDatesByDay(programId),
    ]);
    setProgram(data);
    setLastUsedDates(dates);
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
    <SafeAreaView className="flex-1 bg-obsidian dark:bg-zinc-950">
      {/* Header */}
      <View className="flex-row items-center gap-3 px-5 pt-5 pb-5 border-b border-surface-2 dark:border-zinc-800">
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} activeOpacity={0.7}>
          <ChevronLeft size={22} color="#94A3B8" />
        </TouchableOpacity>
        <View className="flex-1">
          {editingName ? (
            <TextInput
              className="font-montserrat-bold text-text-primary dark:text-white text-xl border-b border-crimson dark:border-blue-500 pb-0.5"
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
              <Text className="font-montserrat-bold text-text-primary dark:text-white text-xl">
                {program.name}
              </Text>
            </TouchableOpacity>
          )}
          {program.description ? (
            <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-sm mt-0.5" numberOfLines={1}>
              {program.description}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity onPress={() => setMenuOpen(true)} hitSlop={8}>
          <MoreHorizontal size={20} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 56, paddingHorizontal: 20, paddingTop: 16, gap: 12 }}>
        {/* Days */}
        {program.days.map((day) => (
          <View key={day.id} className="bg-surface dark:bg-zinc-900 rounded-2xl overflow-hidden">
            {/* Day header */}
            <View className="flex-row items-center justify-between px-5 py-4 border-b border-surface-2 dark:border-zinc-800">
              <View>
                <Text className="font-montserrat-bold text-text-primary dark:text-white text-base">
                  {day.name}
                </Text>
                {lastUsedDates[day.id] != null && (
                  <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs mt-0.5">
                    {lastDoneLabel(lastUsedDates[day.id])}
                  </Text>
                )}
              </View>
              <View className="flex-row items-center gap-3">
                <TouchableOpacity
                  onPress={() => handleLaunch(day)}
                  className="bg-crimson dark:bg-blue-500 flex-row items-center gap-1.5 px-4 py-2 rounded-xl"
                  activeOpacity={0.85}
                >
                  <Zap size={12} color="#FFFFFF" />
                  <Text className="font-montserrat-bold text-white text-sm">
                    Launch
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDeleteDay(day)}
                  hitSlop={8}
                  activeOpacity={0.7}
                >
                  <Trash2 size={16} color="#94A3B8" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Exercises */}
            {day.exercises.length === 0 ? (
              <View className="px-5 py-4">
                <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-sm">
                  No exercises — tap + to add
                </Text>
              </View>
            ) : (
              day.exercises.map((ex) => (
                <View
                  key={ex.id}
                  className="flex-row items-center px-5 py-4 border-b border-surface-2 dark:border-zinc-800"
                >
                  <View className="flex-1">
                    <Text className="font-montserrat-semibold text-text-primary dark:text-white text-base">
                      {ex.exerciseName}
                    </Text>
                    <View className="flex-row gap-2 mt-0.5">
                      <Text className="font-mono text-text-muted dark:text-zinc-500 text-sm">
                        {ex.muscleGroup}
                      </Text>
                      {ex.targetSets && (
                        <Text className="font-mono text-text-secondary dark:text-zinc-400 text-sm">
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
                    <Settings2 size={16} color="#94A3B8" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteExercise(ex)}
                    hitSlop={8}
                    activeOpacity={0.7}
                  >
                    <Trash2 size={16} color="#94A3B8" />
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
              <Plus size={14} color="#94A3B8" />
              <Text className="font-montserrat-semibold text-text-muted dark:text-zinc-500 text-sm">
                Add Exercise
              </Text>
            </TouchableOpacity>
          </View>
        ))}

        {/* Add day */}
        <TouchableOpacity
          onPress={handleAddDay}
          className="py-5 border-2 border-dashed border-surface-3 dark:border-zinc-700 rounded-2xl flex-row items-center justify-center gap-2"
          activeOpacity={0.7}
        >
          <Plus size={16} color="#94A3B8" />
          <Text className="font-montserrat-semibold text-text-secondary dark:text-zinc-400 text-base">
            Add Day
          </Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Context menu */}
      <Modal visible={menuOpen} transparent animationType="slide" onRequestClose={() => setMenuOpen(false)}>
        <Pressable className="flex-1 bg-black/50 justify-end" onPress={() => setMenuOpen(false)}>
          <Pressable>
            <View className="bg-surface dark:bg-zinc-900 rounded-t-3xl pb-10">
              <View className="px-5 py-5 border-b border-surface-2 dark:border-zinc-800">
                <Text className="font-montserrat-bold text-text-primary dark:text-white text-base">
                  {program.name}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => { setMenuOpen(false); handleClone(); }}
                className="flex-row items-center gap-3 px-5 py-4 border-b border-surface-2 dark:border-zinc-800"
                activeOpacity={0.7}
              >
                <Copy size={18} color="#64748B" />
                <Text className="font-montserrat-semibold text-text-primary dark:text-white text-base">Clone Program</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { setMenuOpen(false); handleDelete(); }}
                className="flex-row items-center gap-3 px-5 py-4"
                activeOpacity={0.7}
              >
                <Trash2 size={18} color="#EF4444" />
                <Text className="font-montserrat-semibold text-rose-500 text-base">Delete Program</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <AddExerciseSheet
        visible={addExerciseDayId !== null}
        onClose={() => setAddExerciseDayId(null)}
        onSelect={handleSelectExercise}
        multiSelect
      />

      <ExerciseTargetModal
        exercise={editExercise}
        onSave={handleSaveExerciseTarget}
        onClose={() => setEditExercise(null)}
      />
    </SafeAreaView>
  );
}
