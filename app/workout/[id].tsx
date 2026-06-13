import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { ChevronLeft, FileText, Camera, X, Pencil, Check, Trash2, Plus, Calendar } from "lucide-react-native";
import {
  getWorkoutDetail,
  type WorkoutDetail,
  type SetRecord,
  updateWorkoutName,
  updateLoggedSetValues,
  deleteLoggedSetFromHistory,
  updateWorkoutDateTime,
  addExerciseToHistory,
} from "../../src/db/historyQueries";
import {
  formatDate,
  formatDuration,
  formatVolume,
  shareWorkoutMarkdown,
} from "../../src/utils/exportUtils";
import { WorkoutShareCard } from "../../src/components/export/WorkoutShareCard";
import { AddExerciseSheet } from "../../src/components/workout/AddExerciseSheet";
import type { Exercise } from "../../src/types/workout";

// ─── Date/Duration editing helpers ───────────────────────────────────────────

type InfoEdits = {
  month: string;
  day: string;
  year: string;
  hour: string;
  minute: string;
  ampm: "AM" | "PM";
  durHours: string;
  durMins: string;
};

function initInfoEdits(workout: WorkoutDetail): InfoEdits {
  const d = new Date(workout.started_at * 1000);
  let h = d.getHours();
  const ampm: "AM" | "PM" = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  const totalDurMin = Math.round(workout.duration_seconds / 60);
  return {
    month: String(d.getMonth() + 1),
    day: String(d.getDate()),
    year: String(d.getFullYear()),
    hour: String(h),
    minute: String(d.getMinutes()).padStart(2, "0"),
    ampm,
    durHours: String(Math.floor(totalDurMin / 60)),
    durMins: String(totalDurMin % 60),
  };
}

function infoEditsToTimestamp(edits: InfoEdits): { startedAt: number; durationSeconds: number } | null {
  const month = parseInt(edits.month, 10);
  const day = parseInt(edits.day, 10);
  const year = parseInt(edits.year, 10);
  let hour = parseInt(edits.hour, 10) % 12;
  if (edits.ampm === "PM") hour += 12;
  const minute = parseInt(edits.minute, 10);
  if (
    isNaN(month) || isNaN(day) || isNaN(year) ||
    isNaN(hour) || isNaN(minute) ||
    month < 1 || month > 12 || day < 1 || day > 31 || year < 2000 ||
    minute < 0 || minute > 59
  ) return null;
  const d = new Date(year, month - 1, day, hour, minute, 0);
  const startedAt = Math.floor(d.getTime() / 1000);
  const dH = parseInt(edits.durHours, 10) || 0;
  const dM = parseInt(edits.durMins, 10) || 0;
  const durationSeconds = Math.max(0, dH * 3600 + dM * 60);
  return { startedAt, durationSeconds };
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [workout, setWorkout] = useState<WorkoutDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [cardVisible, setCardVisible] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameText, setNameText] = useState("");
  const [infoEdits, setInfoEdits] = useState<InfoEdits | null>(null);
  const [infoModalOpen, setInfoModalOpen] = useState(false);
  const [exerciseSheetOpen, setExerciseSheetOpen] = useState(false);

  // Per-set edit buffers: setId → { weight, reps, rpe }
  const [setEdits, setSetEdits] = useState<Record<number, { weight: string; reps: string; rpe: string }>>({});

  const reload = useCallback(async () => {
    const data = await getWorkoutDetail(parseInt(id, 10));
    setWorkout(data);
    if (data) setNameText(data.name);
  }, [id]);

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, [reload]);

  const enterEdit = useCallback(() => {
    if (!workout) return;
    const buffers: Record<number, { weight: string; reps: string; rpe: string }> = {};
    for (const ex of workout.exercises) {
      for (const s of ex.sets) {
        buffers[s.id] = {
          weight: s.weight_lbs != null ? String(s.weight_lbs) : "",
          reps: s.reps != null ? String(s.reps) : "",
          rpe: s.rpe != null ? String(s.rpe) : "",
        };
      }
    }
    setSetEdits(buffers);
    setInfoEdits(initInfoEdits(workout));
    setEditMode(true);
  }, [workout]);

  const saveEdits = useCallback(async () => {
    if (!workout) return;
    for (const [idStr, vals] of Object.entries(setEdits)) {
      const setId = parseInt(idStr, 10);
      const weight = vals.weight === "" ? null : parseFloat(vals.weight);
      const reps = vals.reps === "" ? null : parseInt(vals.reps, 10);
      const rpe = vals.rpe === "" ? null : parseFloat(vals.rpe);
      await updateLoggedSetValues(setId, weight, reps, rpe);
    }
    if (infoEdits) {
      const parsed = infoEditsToTimestamp(infoEdits);
      if (parsed) {
        await updateWorkoutDateTime(workout.id, parsed.startedAt, parsed.durationSeconds);
      }
    }
    setEditMode(false);
    reload();
  }, [workout, setEdits, infoEdits, reload]);

  const saveNameEdit = useCallback(async () => {
    if (!workout || !nameText.trim()) return;
    await updateWorkoutName(workout.id, nameText.trim());
    setEditingName(false);
    reload();
  }, [workout, nameText, reload]);

  const handleDeleteSet = useCallback(async (setId: number) => {
    Alert.alert("Delete Set", "Remove this set permanently?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          await deleteLoggedSetFromHistory(setId);
          setSetEdits((prev) => {
            const next = { ...prev };
            delete next[setId];
            return next;
          });
          reload();
        },
      },
    ]);
  }, [reload]);

  const handleAddExercise = useCallback(async (exercise: Exercise) => {
    if (!workout) return;
    await addExerciseToHistory(workout.id, exercise.id, exercise.name);
    setExerciseSheetOpen(false);
    reload();
  }, [workout, reload]);

  const handleShareMarkdown = useCallback(async () => {
    if (!workout) return;
    setSharing(true);
    try {
      await shareWorkoutMarkdown(workout);
    } catch (e) {
      Alert.alert("Share failed", String(e));
    } finally {
      setSharing(false);
    }
  }, [workout]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-obsidian items-center justify-center">
        <ActivityIndicator color="#FF0000" />
      </SafeAreaView>
    );
  }

  if (!workout) {
    return (
      <SafeAreaView className="flex-1 bg-obsidian items-center justify-center">
        <Text className="font-montserrat text-text-muted">Workout not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-obsidian">
      {/* Header */}
      <View className="flex-row items-center gap-3 px-4 pt-5 pb-5 border-b border-surface-2">
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} activeOpacity={0.7}>
          <ChevronLeft size={22} color="#A0A0A0" />
        </TouchableOpacity>
        <View className="flex-1">
          {editingName ? (
            <View className="flex-row items-center gap-2">
              <TextInput
                className="font-anton text-white text-xl tracking-widest flex-1"
                value={nameText}
                onChangeText={setNameText}
                autoFocus
                onSubmitEditing={saveNameEdit}
                style={{ padding: 0 }}
              />
              <TouchableOpacity onPress={saveNameEdit} hitSlop={8}>
                <Check size={18} color="#FF0000" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => editMode && setEditingName(true)}
              activeOpacity={editMode ? 0.7 : 1}
            >
              <Text className="font-anton text-white text-xl tracking-widest uppercase">
                {workout.name !== "Workout" ? workout.name : formatDate(workout.started_at)}
              </Text>
              {/* Subtitle: tappable in edit mode to edit date/duration */}
              <TouchableOpacity
                onPress={() => editMode && setInfoModalOpen(true)}
                activeOpacity={editMode ? 0.7 : 1}
              >
                <View className="flex-row items-center gap-1">
                  <Text className="font-mono text-text-muted text-xs mt-0.5">
                    {formatDate(workout.started_at)} · {formatDuration(workout.duration_seconds)} · {formatVolume(workout.totalVolume)}
                  </Text>
                  {editMode && <Calendar size={10} color="#606060" style={{ marginTop: 2 }} />}
                </View>
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        </View>
        {editMode ? (
          <View className="flex-row gap-3">
            <TouchableOpacity onPress={() => { setEditMode(false); reload(); }} hitSlop={8} activeOpacity={0.7}>
              <X size={20} color="#606060" />
            </TouchableOpacity>
            <TouchableOpacity onPress={saveEdits} hitSlop={8} activeOpacity={0.7}>
              <Check size={20} color="#FF0000" />
            </TouchableOpacity>
          </View>
        ) : (
          <View className="flex-row gap-3">
            <TouchableOpacity onPress={enterEdit} hitSlop={8} activeOpacity={0.7}>
              <Pencil size={18} color="#606060" />
            </TouchableOpacity>
            {sharing ? (
              <ActivityIndicator color="#FF0000" size="small" />
            ) : (
              <>
                <TouchableOpacity onPress={handleShareMarkdown} hitSlop={8} activeOpacity={0.7}>
                  <FileText size={20} color="#606060" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setCardVisible(true)} hitSlop={8} activeOpacity={0.7}>
                  <Camera size={20} color="#606060" />
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 56 }}>
        {/* Exercise list */}
        {workout.exercises.map((ex) => (
          <View key={ex.id} className="mx-4 mt-5 bg-surface">
            <View className="px-4 py-4 border-b border-surface-2">
              <Text className="font-montserrat-bold text-white text-sm tracking-widest uppercase">
                {ex.exercise_name}
              </Text>
              {ex.muscle_group ? (
                <Text className="font-mono text-text-muted text-xs">{ex.muscle_group}</Text>
              ) : null}
            </View>

            <View className="flex-row px-4 py-2.5">
              <Text className="w-8 font-mono text-text-muted text-xs tracking-widest">SET</Text>
              <Text className="flex-1 font-mono text-text-muted text-xs tracking-widest text-right">LBS</Text>
              <Text className="w-16 font-mono text-text-muted text-xs tracking-widest text-right">REPS</Text>
              <Text className="w-14 font-mono text-text-muted text-xs tracking-widest text-right">RPE</Text>
              {editMode && <View className="w-8" />}
            </View>

            {ex.sets.map((s) => {
              const buf = setEdits[s.id];
              return (
                <View
                  key={s.id}
                  className={`flex-row items-center px-4 py-3 border-t border-surface-2 ${
                    !s.is_completed && !editMode ? "opacity-40" : ""
                  }`}
                >
                  <Text className={`w-8 font-mono text-xs ${s.is_warmup ? "text-text-muted" : "text-text-secondary"}`}>
                    {s.is_warmup ? "W" : s.set_number}
                  </Text>
                  {editMode && buf ? (
                    <>
                      <TextInput
                        className="flex-1 font-mono-medium text-white text-sm text-right bg-surface-2 h-8 px-2"
                        value={buf.weight}
                        onChangeText={(v) => setSetEdits((prev) => ({ ...prev, [s.id]: { ...prev[s.id], weight: v } }))}
                        keyboardType="decimal-pad"
                        placeholder="—"
                        placeholderTextColor="#606060"
                      />
                      <TextInput
                        className="w-16 font-mono text-white text-sm text-right bg-surface-2 h-8 px-2 ml-1"
                        value={buf.reps}
                        onChangeText={(v) => setSetEdits((prev) => ({ ...prev, [s.id]: { ...prev[s.id], reps: v } }))}
                        keyboardType="number-pad"
                        placeholder="—"
                        placeholderTextColor="#606060"
                      />
                      <TextInput
                        className="w-14 font-mono text-text-muted text-xs text-right bg-surface-2 h-8 px-2 ml-1"
                        value={buf.rpe}
                        onChangeText={(v) => setSetEdits((prev) => ({ ...prev, [s.id]: { ...prev[s.id], rpe: v } }))}
                        keyboardType="decimal-pad"
                        placeholder="—"
                        placeholderTextColor="#606060"
                      />
                      <TouchableOpacity
                        onPress={() => handleDeleteSet(s.id)}
                        className="w-8 items-center justify-center ml-1"
                        hitSlop={6}
                      >
                        <Trash2 size={14} color="#FF0000" />
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <Text className="flex-1 font-mono-medium text-white text-sm text-right">
                        {s.weight_lbs != null ? s.weight_lbs : "—"}
                      </Text>
                      <Text className="w-16 font-mono text-white text-sm text-right">
                        {s.reps != null ? s.reps : "—"}
                      </Text>
                      <Text className="w-14 font-mono text-text-muted text-xs text-right">
                        {s.rpe != null ? s.rpe : "—"}
                      </Text>
                    </>
                  )}
                </View>
              );
            })}
          </View>
        ))}

        {/* Add Exercise button (edit mode only) */}
        {editMode && (
          <TouchableOpacity
            onPress={() => setExerciseSheetOpen(true)}
            className="mx-4 mt-3 py-3.5 border border-surface-3 flex-row items-center justify-center gap-2"
            activeOpacity={0.7}
          >
            <Plus size={16} color="#A0A0A0" />
            <Text className="font-montserrat-semibold text-text-secondary text-xs tracking-widest uppercase">
              Add Exercise
            </Text>
          </TouchableOpacity>
        )}

        {/* Stats summary */}
        <View className="mx-4 mt-4 bg-surface flex-row">
          {[
            { label: "Volume", value: formatVolume(workout.totalVolume) },
            { label: "Sets", value: String(workout.exercises.flatMap((e) => e.sets.filter((s) => s.is_completed && !s.is_warmup)).length) },
            { label: "Exercises", value: String(workout.exercises.length) },
          ].map((item, i) => (
            <View key={item.label} className={`flex-1 p-4 ${i > 0 ? "border-l border-surface-2" : ""}`}>
              <Text className="font-mono text-text-muted text-xs tracking-widest uppercase mb-1">{item.label}</Text>
              <Text className="font-mono-medium text-white text-base">{item.value}</Text>
            </View>
          ))}
        </View>

        {/* Share actions (read mode only) */}
        {!editMode && (
          <View className="mx-4 mt-4 gap-2">
            <TouchableOpacity
              onPress={handleShareMarkdown}
              className="bg-surface flex-row items-center gap-3 px-4 py-3.5"
              activeOpacity={0.8}
            >
              <FileText size={18} color="#A0A0A0" />
              <View>
                <Text className="font-montserrat-semibold text-white text-sm">Share as Text</Text>
                <Text className="font-mono text-text-muted text-xs">Markdown format</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setCardVisible(true)}
              className="bg-surface flex-row items-center gap-3 px-4 py-3.5"
              activeOpacity={0.8}
            >
              <Camera size={18} color="#A0A0A0" />
              <View>
                <Text className="font-montserrat-semibold text-white text-sm">Share Card</Text>
                <Text className="font-mono text-text-muted text-xs">Screenshot to share as image</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {editMode && (
          <View className="mx-4 mt-4 gap-2">
            <Text className="font-mono text-text-muted text-xs text-center">
              Tap title to rename · Tap date to edit date/duration · Trash to delete a set
            </Text>
            <TouchableOpacity
              onPress={saveEdits}
              className="bg-crimson py-4 items-center"
              activeOpacity={0.8}
            >
              <Text className="font-montserrat-bold text-white text-xs tracking-widest uppercase">
                Save Changes
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Share card preview modal */}
      <Modal visible={cardVisible} transparent animationType="fade" onRequestClose={() => setCardVisible(false)}>
        <Pressable
          className="flex-1 bg-black/80 items-center justify-center px-4"
          onPress={() => setCardVisible(false)}
        >
          <Pressable>
            <WorkoutShareCard workout={workout} />
            <View className="flex-row items-center justify-center gap-2 mt-4">
              <Text className="font-mono text-text-muted text-xs">
                Screenshot this card to share
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setCardVisible(false)}
              className="mt-3 items-center"
              activeOpacity={0.7}
            >
              <X size={22} color="#606060" />
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Date / Duration edit modal */}
      {infoEdits && (
        <Modal
          visible={infoModalOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setInfoModalOpen(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1 }}
          >
            <Pressable
              className="flex-1 bg-black/70 justify-end"
              onPress={() => setInfoModalOpen(false)}
            >
              <Pressable>
                <View className="bg-surface-2 px-4 pt-5 pb-10">
                  <View className="flex-row items-center justify-between mb-5">
                    <Text className="font-anton text-white text-base tracking-widest uppercase">
                      Edit Workout Info
                    </Text>
                    <TouchableOpacity onPress={() => setInfoModalOpen(false)} hitSlop={8}>
                      <X size={18} color="#606060" />
                    </TouchableOpacity>
                  </View>

                  {/* Date row */}
                  <Text className="font-mono text-text-muted text-xs tracking-widest uppercase mb-2">Date</Text>
                  <View className="flex-row items-center gap-2 mb-5">
                    <View className="items-center">
                      <TextInput
                        className="bg-surface-3 text-white font-mono text-base text-center w-14 py-3"
                        value={infoEdits.month}
                        onChangeText={(v) => setInfoEdits((p) => p ? { ...p, month: v } : p)}
                        keyboardType="number-pad"
                        maxLength={2}
                        placeholder="MM"
                        placeholderTextColor="#606060"
                      />
                      <Text className="font-mono text-text-muted text-xs mt-1">Month</Text>
                    </View>
                    <Text className="font-mono text-text-muted text-xl">/</Text>
                    <View className="items-center">
                      <TextInput
                        className="bg-surface-3 text-white font-mono text-base text-center w-14 py-3"
                        value={infoEdits.day}
                        onChangeText={(v) => setInfoEdits((p) => p ? { ...p, day: v } : p)}
                        keyboardType="number-pad"
                        maxLength={2}
                        placeholder="DD"
                        placeholderTextColor="#606060"
                      />
                      <Text className="font-mono text-text-muted text-xs mt-1">Day</Text>
                    </View>
                    <Text className="font-mono text-text-muted text-xl">/</Text>
                    <View className="items-center">
                      <TextInput
                        className="bg-surface-3 text-white font-mono text-base text-center w-20 py-3"
                        value={infoEdits.year}
                        onChangeText={(v) => setInfoEdits((p) => p ? { ...p, year: v } : p)}
                        keyboardType="number-pad"
                        maxLength={4}
                        placeholder="YYYY"
                        placeholderTextColor="#606060"
                      />
                      <Text className="font-mono text-text-muted text-xs mt-1">Year</Text>
                    </View>
                  </View>

                  {/* Time row */}
                  <Text className="font-mono text-text-muted text-xs tracking-widest uppercase mb-2">Time</Text>
                  <View className="flex-row items-center gap-2 mb-5">
                    <View className="items-center">
                      <TextInput
                        className="bg-surface-3 text-white font-mono text-base text-center w-14 py-3"
                        value={infoEdits.hour}
                        onChangeText={(v) => setInfoEdits((p) => p ? { ...p, hour: v } : p)}
                        keyboardType="number-pad"
                        maxLength={2}
                        placeholder="H"
                        placeholderTextColor="#606060"
                      />
                      <Text className="font-mono text-text-muted text-xs mt-1">Hour</Text>
                    </View>
                    <Text className="font-mono text-text-muted text-xl">:</Text>
                    <View className="items-center">
                      <TextInput
                        className="bg-surface-3 text-white font-mono text-base text-center w-14 py-3"
                        value={infoEdits.minute}
                        onChangeText={(v) => setInfoEdits((p) => p ? { ...p, minute: v } : p)}
                        keyboardType="number-pad"
                        maxLength={2}
                        placeholder="MM"
                        placeholderTextColor="#606060"
                      />
                      <Text className="font-mono text-text-muted text-xs mt-1">Min</Text>
                    </View>
                    <View className="flex-row gap-1 ml-1">
                      {(["AM", "PM"] as const).map((v) => (
                        <TouchableOpacity
                          key={v}
                          onPress={() => setInfoEdits((p) => p ? { ...p, ampm: v } : p)}
                          className={`px-4 py-3 ${infoEdits.ampm === v ? "bg-crimson" : "bg-surface-3"}`}
                          activeOpacity={0.7}
                        >
                          <Text className={`font-mono text-sm ${infoEdits.ampm === v ? "text-white" : "text-text-muted"}`}>
                            {v}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Duration row */}
                  <Text className="font-mono text-text-muted text-xs tracking-widest uppercase mb-2">Duration</Text>
                  <View className="flex-row items-center gap-2 mb-6">
                    <View className="items-center">
                      <TextInput
                        className="bg-surface-3 text-white font-mono text-base text-center w-14 py-3"
                        value={infoEdits.durHours}
                        onChangeText={(v) => setInfoEdits((p) => p ? { ...p, durHours: v } : p)}
                        keyboardType="number-pad"
                        maxLength={2}
                        placeholder="0"
                        placeholderTextColor="#606060"
                      />
                      <Text className="font-mono text-text-muted text-xs mt-1">Hours</Text>
                    </View>
                    <View className="items-center">
                      <TextInput
                        className="bg-surface-3 text-white font-mono text-base text-center w-14 py-3"
                        value={infoEdits.durMins}
                        onChangeText={(v) => setInfoEdits((p) => p ? { ...p, durMins: v } : p)}
                        keyboardType="number-pad"
                        maxLength={2}
                        placeholder="0"
                        placeholderTextColor="#606060"
                      />
                      <Text className="font-mono text-text-muted text-xs mt-1">Minutes</Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() => {
                      if (!infoEdits) return;
                      const parsed = infoEditsToTimestamp(infoEdits);
                      if (!parsed) {
                        Alert.alert("Invalid date", "Please check your date and time values.");
                        return;
                      }
                      setInfoModalOpen(false);
                    }}
                    className="bg-crimson py-3 items-center"
                    activeOpacity={0.8}
                  >
                    <Text className="font-montserrat-bold text-white text-xs tracking-widest uppercase">
                      Done
                    </Text>
                  </TouchableOpacity>
                </View>
              </Pressable>
            </Pressable>
          </KeyboardAvoidingView>
        </Modal>
      )}

      {/* Add exercise sheet (edit mode) */}
      <AddExerciseSheet
        visible={exerciseSheetOpen}
        onClose={() => setExerciseSheetOpen(false)}
        onSelect={handleAddExercise}
      />
    </SafeAreaView>
  );
}
