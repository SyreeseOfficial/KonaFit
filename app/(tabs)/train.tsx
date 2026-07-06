import { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
  Pressable,
} from "react-native";
import { GoalsSection } from "../../src/components/train/GoalsSection";
import { SafeAreaView } from "react-native-safe-area-context";
import { Plus, Calculator, Settings, ChevronRight, MoreHorizontal, Copy, Archive, Trash2 } from "lucide-react-native";
import { useLocalSearchParams, router, useFocusEffect } from "expo-router";
import * as FileSystem from "expo-file-system/legacy";
import { saveProgressPhoto } from "../../src/db/photoQueries";
import { useWorkoutSession, loadCachedSession } from "../../src/hooks/useWorkoutSession";
import { useRestTimer } from "../../src/hooks/useRestTimer";
import { WorkspaceHeader } from "../../src/components/workout/WorkspaceHeader";
import { ExerciseBlock } from "../../src/components/workout/ExerciseBlock";
import { AddExerciseSheet } from "../../src/components/workout/AddExerciseSheet";
import { RestTimerBar } from "../../src/components/workout/RestTimerBar";
import { LocationSheet } from "../../src/components/workout/LocationSheet";
import { saveWorkoutLocation } from "../../src/db/locationQueries";
import { formatVolume, formatShortDate, formatDuration } from "../../src/utils/exportUtils";
import { getPrograms, deleteProgram, cloneProgram, archiveProgram } from "../../src/db/programQueries";
import { getWorkoutHistory, type WorkoutSummary } from "../../src/db/historyQueries";
import { kvStore } from "../../src/utils/kvStore";
import type { Exercise } from "../../src/types/workout";
import type { ProgramSummary } from "../../src/types/program";

const LAST_PRS_KEY = "@konafit_last_prs";

export default function TrainScreen() {
  const {
    session,
    startWorkout,
    resumeSession,
    finishWorkout,
    discardWorkout,
    addExercise,
    addExerciseAsSuperset,
    addSet,
    removeSet,
    updateSet,
    toggleSetComplete,
    toggleSetWarmup,
    updateExerciseNotes,
    removeExercise,
    launchFromProgramDay,
    swapExercise,
    moveExercise,
  } = useWorkoutSession();

  const { programDayId } = useLocalSearchParams<{ programDayId?: string }>();
  const launchedDayRef = useRef<string | null>(null);

  const restTimer = useRestTimer();
  const [exerciseSheetOpen, setExerciseSheetOpen] = useState(false);
  const [locationSheetOpen, setLocationSheetOpen] = useState(false);

  const handleCameraPress = useCallback(async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ImagePicker = require("expo-image-picker") as typeof import("expo-image-picker");
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Enable photo access in Settings to save progress photos.");
      return;
    }
    Alert.alert("Progress Photo", "Choose how to add your photo", [
      {
        text: "Camera",
        onPress: async () => {
          const camStatus = await ImagePicker.requestCameraPermissionsAsync();
          if (camStatus.status !== "granted") return;
          const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
          if (!result.canceled && result.assets[0]) {
            await persistPhoto(result.assets[0].uri, session?.workoutId);
          }
        },
      },
      {
        text: "Photo Library",
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
          if (!result.canceled && result.assets[0]) {
            await persistPhoto(result.assets[0].uri, session?.workoutId);
          }
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [session?.workoutId]);
  const [swappingExerciseLocalId, setSwappingExerciseLocalId] = useState<string | null>(null);
  const [supersetTargetLocalId, setSupersetTargetLocalId] = useState<string | null>(null);
  const [reorderMode, setReorderMode] = useState(false);
  const [recoveryVisible, setRecoveryVisible] = useState(false);
  const [cachedSession, setCachedSession] = useState<Awaited<ReturnType<typeof loadCachedSession>>>(null);
  const [programs, setPrograms] = useState<ProgramSummary[]>([]);
  const [recentWorkouts, setRecentWorkouts] = useState<WorkoutSummary[]>([]);
  const [menuProgram, setMenuProgram] = useState<ProgramSummary | null>(null);

  const loadPrograms = useCallback(async () => {
    setPrograms(await getPrograms());
  }, []);

  const loadRecentWorkouts = useCallback(async () => {
    setRecentWorkouts(await getWorkoutHistory(5));
  }, []);

  useFocusEffect(useCallback(() => {
    loadPrograms();
    loadRecentWorkouts();
  }, [loadPrograms, loadRecentWorkouts]));

  const handleProgramDelete = (p: ProgramSummary) => {
    setMenuProgram(null);
    Alert.alert(
      "Delete Program",
      `Permanently delete "${p.name}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => { await deleteProgram(p.id); loadPrograms(); },
        },
      ]
    );
  };

  const handleProgramArchive = async (p: ProgramSummary) => {
    setMenuProgram(null);
    await archiveProgram(p.id);
    loadPrograms();
  };

  const handleProgramClone = async (p: ProgramSummary) => {
    setMenuProgram(null);
    await cloneProgram(p.id);
    loadPrograms();
  };

  useEffect(() => {
    loadCachedSession().then((cached) => {
      if (cached) {
        setCachedSession(cached);
        setRecoveryVisible(true);
      }
    });
  }, []);

  useEffect(() => {
    if (!programDayId || launchedDayRef.current === programDayId) return;
    launchedDayRef.current = programDayId;
    router.setParams({ programDayId: "" });

    const doLaunch = async () => {
      if (session) {
        Alert.alert(
          "Active Workout",
          "You have a workout in progress. Starting a new one will discard it.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Discard & Launch",
              style: "destructive",
              onPress: async () => {
                await discardWorkout();
                await launchFromProgramDay(parseInt(programDayId, 10));
              },
            },
          ]
        );
      } else {
        await launchFromProgramDay(parseInt(programDayId, 10));
      }
    };
    doLaunch();
  }, [programDayId]);

  const handleSelectExercise = useCallback(
    async (exercise: Exercise) => {
      await addExercise(exercise.id, exercise.name, exercise.muscle_group);
    },
    [addExercise]
  );

  async function persistPhoto(uri: string, workoutId?: number) {
    try {
      const dir = `${FileSystem.documentDirectory}konafit/photos/`;
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      const filename = `photo_${Date.now()}.jpg`;
      const dest = `${dir}${filename}`;
      await FileSystem.copyAsync({ from: uri, to: dest });
      await saveProgressPhoto(dest, workoutId);
    } catch (e) {
      Alert.alert("Error", "Failed to save photo.");
    }
  }

  const handleSetComplete = useCallback(
    (exerciseLocalId: string, setLocalId: string) => {
      toggleSetComplete(exerciseLocalId, setLocalId);
    },
    [toggleSetComplete]
  );

  const handleFinish = useCallback(() => {
    if (!session) return;
    setLocationSheetOpen(true);
  }, [session]);

  const handleSaveWorkout = useCallback(
    async (location: string | null) => {
      if (!session) return;
      setLocationSheetOpen(false);

      const workoutId = session.workoutId;

      try {
        if (location) await saveWorkoutLocation(workoutId, location);
      } catch (e) {
        console.error("Failed to save location:", e);
      }

      // Capture PRs before session is cleared
      const prs = session.exercises
        .filter((e) => e.sets.some((s) => s.prBadges && s.prBadges.length > 0))
        .map((e) => e.exerciseName);
      try {
        await kvStore.setItem(LAST_PRS_KEY, JSON.stringify(prs));
      } catch {}

      await finishWorkout();

      router.push({
        pathname: "/workout-complete",
        params: { id: String(workoutId) },
      } as never);
    },
    [session, finishWorkout]
  );

  const handleDiscardWorkout = useCallback(async () => {
    setLocationSheetOpen(false);
    await discardWorkout();
  }, [discardWorkout]);

  // ─── Recovery prompt ───────────────────────────────────────────────
  if (recoveryVisible && cachedSession) {
    const exerciseCount = cachedSession.exercises.length;
    const started = new Date(cachedSession.startedAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    return (
      <SafeAreaView className="flex-1 bg-obsidian dark:bg-zinc-950">
        <Modal visible transparent animationType="fade">
          <View className="flex-1 bg-black/60 items-center justify-center px-6">
            <View className="bg-surface dark:bg-zinc-900 w-full p-6 rounded-2xl shadow-lg">
              <Text className="font-montserrat-bold text-text-primary dark:text-white text-2xl mb-1">
                Resume Workout?
              </Text>
              <Text className="font-montserrat text-text-secondary dark:text-zinc-400 text-sm mb-1">
                Started at {started}
              </Text>
              <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-xs mb-6">
                {exerciseCount} exercise{exerciseCount !== 1 ? "s" : ""} logged
              </Text>
              <TouchableOpacity
                onPress={() => {
                  resumeSession(cachedSession);
                  setRecoveryVisible(false);
                }}
                className="bg-crimson dark:bg-blue-500 py-4 items-center mb-3 rounded-xl"
                activeOpacity={0.8}
              >
                <Text className="font-montserrat-bold text-white text-sm">
                  Resume
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  discardWorkout();
                  setCachedSession(null);
                  setRecoveryVisible(false);
                }}
                className="bg-surface-2 dark:bg-zinc-800 py-4 items-center rounded-xl"
                activeOpacity={0.8}
              >
                <Text className="font-montserrat-semibold text-text-secondary dark:text-zinc-400 text-sm">
                  Discard
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  // ─── Idle screen ───────────────────────────────────────────────────
  if (!session) {
    return (
      <SafeAreaView className="flex-1 bg-obsidian dark:bg-zinc-950">
        <View className="flex-row items-center justify-between px-5 pt-6 pb-3">
          <Text className="font-montserrat-bold text-text-primary dark:text-white text-3xl">
            Train
          </Text>
          <View className="flex-row items-center gap-4">
            <TouchableOpacity onPress={() => router.push("/tools")} hitSlop={8} activeOpacity={0.7}>
              <Calculator size={20} color="#94A3B8" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push("/settings")} hitSlop={8} activeOpacity={0.7}>
              <Settings size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 64 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Quick start */}
          <View className="px-5" style={{ paddingTop: 32, paddingBottom: 32 }}>
            <TouchableOpacity
              onPress={startWorkout}
              className="bg-crimson dark:bg-blue-500 py-4 rounded-2xl items-center"
              activeOpacity={0.85}
            >
              <Text className="font-montserrat-bold text-white text-base">Start Empty Workout</Text>
            </TouchableOpacity>
          </View>

          {/* Programs */}
          <View style={{ paddingHorizontal: 20, paddingBottom: 32 }}>
            <View className="flex-row items-center justify-between mb-3">
              <Text className="font-montserrat-bold text-text-primary dark:text-white text-xl">
                Programs
              </Text>
              <TouchableOpacity
                onPress={() => router.push("/programs/new" as never)}
                className="bg-crimson dark:bg-blue-500 w-8 h-8 items-center justify-center rounded-full"
                activeOpacity={0.85}
              >
                <Plus size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {programs.length === 0 ? (
              <View className="bg-surface dark:bg-zinc-900 px-5 py-6 rounded-2xl items-center">
                <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-sm text-center">
                  No programs yet.{"\n"}Tap + to build a reusable template.
                </Text>
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                {programs.map((item) => (
                  <View key={item.id} className="bg-surface dark:bg-zinc-900 rounded-2xl overflow-hidden">
                    <TouchableOpacity
                      onPress={() => router.push(`/programs/${item.id}` as never)}
                      activeOpacity={0.8}
                      className="flex-row items-center px-5 py-4"
                    >
                      <View className="flex-1">
                        <Text className="font-montserrat-bold text-text-primary dark:text-white text-base mb-0.5">
                          {item.name}
                        </Text>
                        <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs">
                          {item.dayCount} {item.dayCount === 1 ? "day" : "days"} · {item.exerciseCount} exercises
                          {item.difficulty ? ` · ${item.difficulty}` : ""}
                        </Text>
                      </View>
                      <View className="flex-row items-center gap-3">
                        <TouchableOpacity onPress={() => setMenuProgram(item)} hitSlop={8} activeOpacity={0.7}>
                          <MoreHorizontal size={18} color="#94A3B8" />
                        </TouchableOpacity>
                        <ChevronRight size={16} color="#94A3B8" />
                      </View>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Recent Workouts */}
          <View style={{ paddingHorizontal: 20, paddingBottom: 32 }}>
            <Text className="font-montserrat-bold text-text-primary dark:text-white text-xl mb-3">
              Recent
            </Text>
            {recentWorkouts.length === 0 ? (
              <View className="bg-surface dark:bg-zinc-900 px-5 py-6 rounded-2xl items-center">
                <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-sm text-center">
                  No workouts yet.{"\n"}Start your first session above.
                </Text>
              </View>
            ) : (
              <View style={{ gap: 8 }}>
                {recentWorkouts.map((w) => (
                  <TouchableOpacity
                    key={w.id}
                    onPress={() => router.push(`/workout/${w.id}` as never)}
                    className="bg-surface dark:bg-zinc-900 rounded-2xl px-5 py-4 flex-row items-center"
                    activeOpacity={0.8}
                  >
                    <View className="flex-1">
                      <Text className="font-montserrat-bold text-text-primary dark:text-white text-base mb-0.5">
                        {w.name}
                      </Text>
                      <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs">
                        {formatShortDate(w.started_at)} · {w.exercise_count} exercises
                      </Text>
                    </View>
                    <View className="items-end mr-3">
                      <Text className="font-mono-medium text-text-primary dark:text-white text-sm">
                        {formatVolume(w.total_volume)}
                      </Text>
                      <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs">
                        {formatDuration(w.duration_seconds)}
                      </Text>
                    </View>
                    <ChevronRight size={16} color="#94A3B8" />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Divider */}
          <View style={{ height: 1, backgroundColor: "#E2E8F0", marginHorizontal: 20 }} />

          {/* Goals zone */}
          <View style={{ paddingTop: 32 }}>
            <GoalsSection />
          </View>
        </ScrollView>

        {/* Programs context menu */}
        <Modal
          visible={menuProgram !== null}
          transparent
          animationType="slide"
          onRequestClose={() => setMenuProgram(null)}
        >
          <Pressable className="flex-1 bg-black/50 justify-end" onPress={() => setMenuProgram(null)}>
            <Pressable>
              <View className="bg-surface dark:bg-zinc-900 rounded-t-3xl pb-10">
                <View className="px-5 py-5 border-b border-surface-2 dark:border-zinc-800">
                  <Text className="font-montserrat-bold text-text-primary dark:text-white text-base" numberOfLines={1}>
                    {menuProgram?.name}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => menuProgram && handleProgramClone(menuProgram)}
                  className="flex-row items-center gap-3 px-5 py-4 border-b border-surface-2 dark:border-zinc-800"
                  activeOpacity={0.7}
                >
                  <Copy size={18} color="#64748B" />
                  <Text className="font-montserrat-semibold text-text-primary dark:text-white text-base">Duplicate</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => menuProgram && handleProgramArchive(menuProgram)}
                  className="flex-row items-center gap-3 px-5 py-4 border-b border-surface-2 dark:border-zinc-800"
                  activeOpacity={0.7}
                >
                  <Archive size={18} color="#64748B" />
                  <View className="flex-1">
                    <Text className="font-montserrat-semibold text-text-primary dark:text-white text-base">Archive</Text>
                    <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-sm mt-0.5">
                      Hidden from list, restore in Settings
                    </Text>
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => menuProgram && handleProgramDelete(menuProgram)}
                  className="flex-row items-center gap-3 px-5 py-4"
                  activeOpacity={0.7}
                >
                  <Trash2 size={18} color="#EF4444" />
                  <Text className="font-montserrat-semibold text-rose-500 text-base">Delete Permanently</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      </SafeAreaView>
    );
  }

  // ─── Active workspace ──────────────────────────────────────────────
  return (
    <SafeAreaView className="flex-1 bg-obsidian dark:bg-zinc-950" edges={["top"]}>
      <WorkspaceHeader
        startedAt={session.startedAt}
        onFinish={handleFinish}
        onTools={() => router.push("/tools")}
        onCamera={handleCameraPress}
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
      >
        {session.exercises.length === 0 && (
          <View className="items-center mt-16 px-6">
            <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-base text-center">
              No exercises yet.{"\n"}Tap + to add your first exercise.
            </Text>
          </View>
        )}

        {session.exercises.map((exercise, i) => (
          <ExerciseBlock
            key={exercise.localId}
            index={i + 1}
            exercise={exercise}
            supersetId={exercise.supersetId}
            reorderMode={reorderMode}
            canMoveUp={i > 0}
            canMoveDown={i < session.exercises.length - 1}
            onMoveUp={() => moveExercise(exercise.localId, "up")}
            onMoveDown={() => moveExercise(exercise.localId, "down")}
            onAddSet={() => addSet(exercise.localId)}
            onRemoveSet={(setLocalId) => removeSet(exercise.localId, setLocalId)}
            onUpdateSet={(setLocalId, patch) => updateSet(exercise.localId, setLocalId, patch)}
            onToggleComplete={(setLocalId) => handleSetComplete(exercise.localId, setLocalId)}
            onToggleWarmup={(setLocalId) => toggleSetWarmup(exercise.localId, setLocalId)}
            onUpdateNotes={(notes) => updateExerciseNotes(exercise.localId, notes)}
            onRemoveExercise={() => removeExercise(exercise.localId)}
            onSwap={() => setSwappingExerciseLocalId(exercise.localId)}
            onAddSuperset={() => setSupersetTargetLocalId(exercise.localId)}
          />
        ))}

        {/* Add Exercise */}
        <TouchableOpacity
          onPress={() => setExerciseSheetOpen(true)}
          className="mx-5 mt-2 py-4 border border-surface-3 dark:border-zinc-700 rounded-2xl flex-row items-center justify-center gap-2 bg-surface dark:bg-zinc-900"
          activeOpacity={0.7}
        >
          <Plus size={16} color="#64748B" />
          <Text className="font-montserrat-semibold text-text-secondary dark:text-zinc-400 text-sm">
            Add Exercise
          </Text>
        </TouchableOpacity>

        {/* Reorder toggle */}
        <TouchableOpacity
          onPress={() => setReorderMode((r) => !r)}
          className={`mx-5 mt-2 py-4 border rounded-2xl flex-row items-center justify-center gap-2 ${
            reorderMode
              ? "border-crimson dark:border-blue-500 bg-blue-50 dark:bg-blue-950"
              : "border-surface-3 dark:border-zinc-700 bg-surface dark:bg-zinc-900"
          }`}
          activeOpacity={0.7}
        >
          <Text className={`font-montserrat-semibold text-sm ${reorderMode ? "text-crimson dark:text-blue-400" : "text-text-secondary dark:text-zinc-400"}`}>
            {reorderMode ? "Done Reordering" : "↕  Reorder Exercises"}
          </Text>
        </TouchableOpacity>

        {/* Cancel workout */}
        <TouchableOpacity
          onPress={() =>
            Alert.alert("Cancel Workout", "Delete this workout and discard all sets?", [
              { text: "Keep Going", style: "cancel" },
              { text: "Cancel Workout", style: "destructive", onPress: discardWorkout },
            ])
          }
          className="mx-5 mt-2 mb-2 py-4 border border-surface-3 dark:border-zinc-700 rounded-2xl flex-row items-center justify-center bg-surface dark:bg-zinc-900"
          activeOpacity={0.7}
        >
          <Text className="font-montserrat-semibold text-rose-500 text-sm">
            Cancel Workout
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <RestTimerBar timer={restTimer} />

      <AddExerciseSheet
        visible={exerciseSheetOpen}
        onClose={() => setExerciseSheetOpen(false)}
        onSelect={handleSelectExercise}
        multiSelect
      />

      <AddExerciseSheet
        visible={swappingExerciseLocalId !== null}
        onClose={() => setSwappingExerciseLocalId(null)}
        onSelect={(ex) => {
          if (swappingExerciseLocalId) {
            swapExercise(swappingExerciseLocalId, ex.id, ex.name, ex.muscle_group);
            setSwappingExerciseLocalId(null);
          }
        }}
      />

      <AddExerciseSheet
        visible={supersetTargetLocalId !== null}
        onClose={() => setSupersetTargetLocalId(null)}
        onSelect={(ex) => {
          if (supersetTargetLocalId) {
            addExerciseAsSuperset(supersetTargetLocalId, ex.id, ex.name, ex.muscle_group);
            setSupersetTargetLocalId(null);
          }
        }}
      />

      <LocationSheet
        visible={locationSheetOpen}
        onSave={handleSaveWorkout}
        onDiscard={handleDiscardWorkout}
        onCancel={() => setLocationSheetOpen(false)}
      />
    </SafeAreaView>
  );
}
