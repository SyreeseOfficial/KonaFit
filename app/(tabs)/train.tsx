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
import { SafeAreaView } from "react-native-safe-area-context";
import { Plus, Calculator } from "lucide-react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useWorkoutSession, loadCachedSession } from "../../src/hooks/useWorkoutSession";
import { useRestTimer } from "../../src/hooks/useRestTimer";
import { WorkspaceHeader } from "../../src/components/workout/WorkspaceHeader";
import { ExerciseBlock } from "../../src/components/workout/ExerciseBlock";
import { AddExerciseSheet } from "../../src/components/workout/AddExerciseSheet";
import { RestTimerBar } from "../../src/components/workout/RestTimerBar";
import type { Exercise } from "../../src/types/workout";

export default function TrainScreen() {
  const {
    session,
    startWorkout,
    resumeSession,
    finishWorkout,
    discardWorkout,
    addExercise,
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
  const [swappingExerciseLocalId, setSwappingExerciseLocalId] = useState<string | null>(null);
  const [reorderMode, setReorderMode] = useState(false);
  const [recoveryVisible, setRecoveryVisible] = useState(false);
  const [cachedSession, setCachedSession] = useState<Awaited<ReturnType<typeof loadCachedSession>>>(null);

  // Check for a cached session on mount
  useEffect(() => {
    loadCachedSession().then((cached) => {
      if (cached) {
        setCachedSession(cached);
        setRecoveryVisible(true);
      }
    });
  }, []);

  // Handle launch from Programs tab
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

  const handleSetComplete = useCallback(
    (exerciseLocalId: string, setLocalId: string) => {
      toggleSetComplete(exerciseLocalId, setLocalId);
    },
    [toggleSetComplete]
  );

  const handleFinish = useCallback(() => {
    Alert.alert(
      "Finish Workout",
      "Save this workout to your history?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: discardWorkout,
        },
        {
          text: "Save",
          onPress: finishWorkout,
        },
      ]
    );
  }, [finishWorkout, discardWorkout]);

  // ─── Recovery prompt ───────────────────────────────────────────────
  if (recoveryVisible && cachedSession) {
    const exerciseCount = cachedSession.exercises.length;
    const started = new Date(cachedSession.startedAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    return (
      <SafeAreaView className="flex-1 bg-obsidian">
        <Modal visible transparent animationType="fade">
          <View className="flex-1 bg-black/80 items-center justify-center px-6">
            <View className="bg-surface-2 w-full p-6">
              <Text className="font-anton text-white text-2xl tracking-widest uppercase mb-1">
                Resume Workout?
              </Text>
              <Text className="font-montserrat text-text-secondary text-sm mb-1">
                Started at {started}
              </Text>
              <Text className="font-montserrat text-text-muted text-xs mb-6">
                {exerciseCount} exercise{exerciseCount !== 1 ? "s" : ""} logged
              </Text>
              <TouchableOpacity
                onPress={() => {
                  resumeSession(cachedSession);
                  setRecoveryVisible(false);
                }}
                className="bg-crimson py-3 items-center mb-3"
                activeOpacity={0.8}
              >
                <Text className="font-montserrat-bold text-white tracking-widest uppercase text-sm">
                  Resume
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  discardWorkout();
                  setCachedSession(null);
                  setRecoveryVisible(false);
                }}
                className="bg-surface-3 py-3 items-center"
                activeOpacity={0.8}
              >
                <Text className="font-montserrat-semibold text-text-secondary tracking-widest uppercase text-sm">
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
      <SafeAreaView className="flex-1 bg-obsidian">
        <View className="flex-row items-start justify-between px-4 pt-4">
          <View>
            <Text className="font-anton text-white text-3xl tracking-widest uppercase mb-8">
              Train
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/tools")}
            hitSlop={8}
            activeOpacity={0.7}
            className="mt-1"
          >
            <Calculator size={20} color="#606060" />
          </TouchableOpacity>
        </View>
        <View className="flex-1 items-center justify-center gap-6">
          <View className="items-center">
            <Text className="font-montserrat-bold text-white text-base tracking-wider uppercase mb-1">
              Ready to train?
            </Text>
            <Text className="font-montserrat text-text-muted text-sm text-center">
              Start an empty workout and add exercises as you go.
            </Text>
          </View>
          <TouchableOpacity
            onPress={startWorkout}
            className="bg-crimson px-10 py-4"
            activeOpacity={0.8}
          >
            <Text className="font-montserrat-bold text-white tracking-widest uppercase text-sm">
              Start Workout
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Active workspace ──────────────────────────────────────────────
  return (
    <SafeAreaView className="flex-1 bg-obsidian" edges={["top"]}>
      <WorkspaceHeader startedAt={session.startedAt} onFinish={handleFinish} onTools={() => router.push("/tools")} />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        {session.exercises.length === 0 && (
          <View className="items-center mt-16 px-6">
            <Text className="font-montserrat text-text-muted text-sm text-center">
              No exercises yet.{"\n"}Tap + to add your first exercise.
            </Text>
          </View>
        )}

        {session.exercises.map((exercise, i) => (
          <ExerciseBlock
            key={exercise.localId}
            index={i + 1}
            exercise={exercise}
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
            onTimerPress={() => restTimer.start()}
          />
        ))}

        {/* Add Exercise */}
        <TouchableOpacity
          onPress={() => setExerciseSheetOpen(true)}
          className="mx-4 mt-2 py-3.5 border border-surface-3 flex-row items-center justify-center gap-2"
          activeOpacity={0.7}
        >
          <Plus size={16} color="#A0A0A0" />
          <Text className="font-montserrat-semibold text-text-secondary text-xs tracking-widest uppercase">
            Add Exercise
          </Text>
        </TouchableOpacity>

        {/* Reorder toggle */}
        <TouchableOpacity
          onPress={() => setReorderMode((r) => !r)}
          className={`mx-4 mt-2 py-3.5 border flex-row items-center justify-center gap-2 ${
            reorderMode ? "border-crimson bg-surface-2" : "border-surface-3"
          }`}
          activeOpacity={0.7}
        >
          <Text className={`font-montserrat-semibold text-xs tracking-widest uppercase ${reorderMode ? "text-crimson" : "text-text-secondary"}`}>
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
          className="mx-4 mt-2 mb-2 py-3.5 border border-surface-3 flex-row items-center justify-center"
          activeOpacity={0.7}
        >
          <Text className="font-montserrat-semibold text-crimson text-xs tracking-widest uppercase">
            ✕  Cancel Workout
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <RestTimerBar timer={restTimer} />

      {/* Add exercise */}
      <AddExerciseSheet
        visible={exerciseSheetOpen}
        onClose={() => setExerciseSheetOpen(false)}
        onSelect={handleSelectExercise}
      />

      {/* Swap exercise */}
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
    </SafeAreaView>
  );
}
