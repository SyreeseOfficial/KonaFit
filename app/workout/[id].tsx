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
  getWorkoutType,
  type WorkoutType,
  type WorkoutDetail,
  type SetRecord,
  updateWorkoutName,
  updateLoggedSetValues,
  deleteLoggedSetFromHistory,
  updateWorkoutDateTime,
  addExerciseToHistory,
} from "../../src/db/historyQueries";
import { deleteWorkout } from "../../src/db/workoutQueries";
import { createProgramFromWorkout } from "../../src/db/programQueries";
import {
  formatDate,
  formatShortDate,
  formatDuration,
  formatVolume,
  shareWorkoutMarkdown,
} from "../../src/utils/exportUtils";
import { BoxingDetail } from "../../src/components/boxing/BoxingDetail";
import { WorkoutShareCard } from "../../src/components/export/WorkoutShareCard";
import { AddExerciseSheet } from "../../src/components/workout/AddExerciseSheet";
import { cleanDecimal, cleanInt, MAX_WEIGHT, MAX_REPS } from "../../src/utils/numberInput";
import type { Exercise } from "../../src/types/workout";
import { columnsFor, FIELD_META, fmtClock, clockToSec, type SetField } from "../../src/utils/setFields";
import { initDateEdits, dateEditsToTimestamp, type InfoEdits } from "../../src/utils/dateEdit";

const initInfoEdits = (workout: WorkoutDetail): InfoEdits => initDateEdits(workout.started_at, workout.duration_seconds);
const infoEditsToTimestamp = dateEditsToTimestamp;

const inputBase = "bg-surface-3 dark:bg-zinc-700 text-text-primary dark:text-white font-mono text-base text-center py-3 rounded-xl";

/** First column takes the spare width; the rest are fixed. */
const colWidth = (f: SetField, i: number) => (i === 0 ? "flex-1" : f === "rpe" ? "w-14" : "w-16");

function cell(s: SetRecord, f: SetField): string {
  const v = {
    weightLbs: s.weight_lbs, reps: s.reps, rpe: s.rpe, distance: s.distance_mi, calories: s.calories,
    duration: s.duration_sec != null ? fmtClock(s.duration_sec) : null,
  }[f];
  return v != null ? String(v) : "—";
}

function LiftWorkoutDetail() {
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
  const [setEdits, setSetEdits] = useState<Record<number, Partial<Record<SetField, string>>>>({});

  const reload = useCallback(async () => {
    const data = await getWorkoutDetail(parseInt(id, 10));
    setWorkout(data);
    if (data) setNameText(data.name);
  }, [id]);

  useEffect(() => { reload().finally(() => setLoading(false)); }, [reload]);

  const enterEdit = useCallback(() => {
    if (!workout) return;
    const buffers: Record<number, Partial<Record<SetField, string>>> = {};
    for (const ex of workout.exercises)
      for (const s of ex.sets)
        buffers[s.id] = {
          weightLbs: s.weight_lbs != null ? String(s.weight_lbs) : "",
          reps: s.reps != null ? String(s.reps) : "",
          rpe: s.rpe != null ? String(s.rpe) : "",
          duration: s.duration_sec != null ? fmtClock(s.duration_sec) : "",
          distance: s.distance_mi != null ? String(s.distance_mi) : "",
          calories: s.calories != null ? String(s.calories) : "",
        };
    setSetEdits(buffers);
    setInfoEdits(initInfoEdits(workout));
    setEditMode(true);
  }, [workout]);

  const saveEdits = useCallback(async () => {
    if (!workout) return;
    for (const [idStr, vals] of Object.entries(setEdits)) {
      const setId = parseInt(idStr, 10);
      await updateLoggedSetValues(
        setId,
        Number.isFinite(parseFloat(vals.weightLbs ?? "")) ? parseFloat(vals.weightLbs!) : null,
        vals.reps ? parseInt(vals.reps, 10) : null,
        vals.rpe ? parseFloat(vals.rpe) : null,
        clockToSec(vals.duration),
        Number.isFinite(parseFloat(vals.distance ?? "")) ? parseFloat(vals.distance!) : null,
        vals.calories ? parseInt(vals.calories, 10) : null,
      );
    }
    if (infoEdits) {
      const parsed = infoEditsToTimestamp(infoEdits);
      if (parsed) await updateWorkoutDateTime(workout.id, parsed.startedAt, parsed.durationSeconds);
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
        text: "Delete", style: "destructive",
        onPress: async () => {
          await deleteLoggedSetFromHistory(setId);
          setSetEdits((prev) => { const next = { ...prev }; delete next[setId]; return next; });
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

  const handleDelete = useCallback(() => {
    if (!workout) return;
    Alert.alert("Delete Workout", "Permanently delete this workout? This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          await deleteWorkout(workout.id);
          router.back();
        },
      },
    ]);
  }, [workout]);

  const handleShareMarkdown = useCallback(async () => {
    if (!workout) return;
    setSharing(true);
    try { await shareWorkoutMarkdown(workout); }
    catch (e) { Alert.alert("Share failed", String(e)); }
    finally { setSharing(false); }
  }, [workout]);

  const handleSaveAsProgram = useCallback(async () => {
    if (!workout) return;
    try {
      const programId = await createProgramFromWorkout(workout.id, `${workout.name} · ${formatShortDate(workout.started_at)}`);
      router.push(`/programs/${programId}` as never);
    } catch (e) {
      Alert.alert("Couldn't save program", String(e));
    }
  }, [workout]);

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-obsidian dark:bg-zinc-950 items-center justify-center">
        <ActivityIndicator color="#2563EB" />
      </SafeAreaView>
    );
  }

  if (!workout) {
    return (
      <SafeAreaView className="flex-1 bg-obsidian dark:bg-zinc-950 items-center justify-center">
        <Text className="font-montserrat text-text-muted dark:text-zinc-500">Workout not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-obsidian dark:bg-zinc-950">
      {/* Header */}
      <View className="flex-row items-center gap-3 px-5 pt-5 pb-5 border-b border-surface-2 dark:border-zinc-800">
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} activeOpacity={0.7}>
          <ChevronLeft size={22} color="#94A3B8" />
        </TouchableOpacity>
        <View className="flex-1">
          {editingName ? (
            <View className="flex-row items-center gap-2">
              <TextInput
                className="font-montserrat-bold text-text-primary dark:text-white text-xl flex-1"
                value={nameText}
                onChangeText={setNameText}
                autoFocus
                onSubmitEditing={saveNameEdit}
                style={{ padding: 0 }}
              />
              <TouchableOpacity onPress={saveNameEdit} hitSlop={8}>
                <Check size={18} color="#2563EB" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => editMode && setEditingName(true)}
              activeOpacity={editMode ? 0.7 : 1}
            >
              <Text className="font-montserrat-bold text-text-primary dark:text-white text-xl">
                {workout.name !== "Workout" ? workout.name : formatDate(workout.started_at)}
              </Text>
              <TouchableOpacity
                onPress={() => editMode && setInfoModalOpen(true)}
                activeOpacity={editMode ? 0.7 : 1}
              >
                <View className="flex-row items-center gap-1.5">
                  <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs mt-0.5">
                    {formatDate(workout.started_at)} · {formatDuration(workout.duration_seconds)} · {formatVolume(workout.totalVolume)}
                  </Text>
                  {editMode && <Calendar size={10} color="#94A3B8" style={{ marginTop: 2 }} />}
                </View>
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        </View>
        {editMode ? (
          <View className="flex-row gap-3">
            <TouchableOpacity onPress={() => { setEditMode(false); reload(); }} hitSlop={8} activeOpacity={0.7}>
              <X size={20} color="#94A3B8" />
            </TouchableOpacity>
            <TouchableOpacity onPress={saveEdits} hitSlop={8} activeOpacity={0.7}>
              <Check size={20} color="#2563EB" />
            </TouchableOpacity>
          </View>
        ) : (
          <View className="flex-row gap-3">
            <TouchableOpacity onPress={enterEdit} hitSlop={8} activeOpacity={0.7}>
              <Pencil size={18} color="#94A3B8" />
            </TouchableOpacity>
            {sharing ? (
              <ActivityIndicator color="#2563EB" size="small" />
            ) : (
              <>
                <TouchableOpacity onPress={handleShareMarkdown} hitSlop={8} activeOpacity={0.7}>
                  <FileText size={20} color="#94A3B8" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setCardVisible(true)} hitSlop={8} activeOpacity={0.7}>
                  <Camera size={20} color="#94A3B8" />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleDelete} hitSlop={8} activeOpacity={0.7}>
                  <Trash2 size={18} color="#EF4444" />
                </TouchableOpacity>
              </>
            )}
          </View>
        )}
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 56, paddingTop: 16 }}>
        {/* Exercise list */}
        {workout.exercises.map((ex) => (
          <View key={ex.id} className="mx-5 mb-3 bg-surface dark:bg-zinc-900 rounded-2xl overflow-hidden">
            <View className="px-5 py-4 border-b border-surface-2 dark:border-zinc-800">
              <TouchableOpacity
                disabled={ex.exercise_id == null}
                onPress={() => router.push({ pathname: "/exercise/[id]", params: { id: String(ex.exercise_id), name: ex.exercise_name } } as never)}
                activeOpacity={0.7}
                accessibilityRole="link"
              >
                <Text className="font-montserrat-bold text-text-primary dark:text-white text-base">
                  {ex.exercise_name}
                </Text>
              </TouchableOpacity>
              {ex.muscle_group ? (
                <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs mt-0.5">{ex.muscle_group}</Text>
              ) : null}
              {ex.notes ? (
                <Text className="font-mono text-text-secondary dark:text-zinc-400 text-xs mt-1.5 italic">{ex.notes}</Text>
              ) : null}
            </View>

            {/* Column headers */}
            <View className="flex-row px-5 py-2.5">
              <Text className="w-8 font-mono text-text-muted dark:text-zinc-500 text-xs">Set</Text>
              {columnsFor(ex.target_type).map((f, i) => (
                <Text key={f} className={`${colWidth(f, i)} font-mono text-text-muted dark:text-zinc-500 text-xs text-right`}>{FIELD_META[f].label}</Text>
              ))}
              {editMode && <View className="w-8" />}
            </View>

            {ex.sets.map((s) => {
              const buf = setEdits[s.id];
              return (
                <View
                  key={s.id}
                  className={`border-t border-surface-2 dark:border-zinc-800 ${
                    !s.is_completed && !editMode ? "opacity-40" : ""
                  }`}
                >
                <View className="flex-row items-center px-5 py-3">
                  <Text className={`w-8 font-mono text-sm ${s.is_warmup ? "text-amber-500" : "text-text-secondary dark:text-zinc-400"}`}>
                    {s.is_warmup ? "W" : s.set_number}
                  </Text>
                  {editMode && buf ? (
                    <>
                      {columnsFor(ex.target_type).map((f, i) => (
                        <TextInput
                          key={f}
                          className={`${colWidth(f, i)} ${i > 0 ? "ml-1.5" : ""} font-mono text-text-primary dark:text-white text-sm text-right bg-surface-2 dark:bg-zinc-800 h-9 px-2 rounded-lg`}
                          value={buf[f] ?? ""}
                          onChangeText={(v) => setSetEdits((prev) => ({ ...prev, [s.id]: { ...prev[s.id], [f]: FIELD_META[f].clean(v, ex.is_bodyweight) ?? prev[s.id][f] } }))}
                          keyboardType={f === "weightLbs" && ex.is_bodyweight ? "numbers-and-punctuation" : FIELD_META[f].keyboard}
                          placeholder="—"
                          placeholderTextColor="#94A3B8"
                        />
                      ))}
                      <TouchableOpacity
                        onPress={() => handleDeleteSet(s.id)}
                        className="w-8 items-center justify-center ml-1"
                        hitSlop={6}
                      >
                        <Trash2 size={14} color="#EF4444" />
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      {columnsFor(ex.target_type).map((f, i) => (
                        <Text key={f} className={`${colWidth(f, i)} font-mono text-sm text-right ${f === "rpe" ? "text-text-muted dark:text-zinc-500 text-xs" : "text-text-primary dark:text-white"}`}>
                          {cell(s, f)}
                        </Text>
                      ))}
                    </>
                  )}
                </View>
                {s.notes ? (
                  <Text className="font-mono text-text-secondary dark:text-zinc-400 text-xs italic px-5 pb-3">{s.notes}</Text>
                ) : null}
                </View>
              );
            })}
          </View>
        ))}

        {/* Add exercise (edit mode) */}
        {editMode && (
          <TouchableOpacity
            onPress={() => setExerciseSheetOpen(true)}
            className="mx-5 mb-3 py-4 border-2 border-dashed border-surface-3 dark:border-zinc-700 flex-row items-center justify-center gap-2 rounded-2xl"
            activeOpacity={0.7}
          >
            <Plus size={16} color="#94A3B8" />
            <Text className="font-montserrat-semibold text-text-secondary dark:text-zinc-400 text-sm">
              Add Exercise
            </Text>
          </TouchableOpacity>
        )}

        {/* Stats summary */}
        <View className="mx-5 mt-1 mb-3 bg-surface dark:bg-zinc-900 flex-row rounded-2xl overflow-hidden">
          {[
            { label: "Volume", value: formatVolume(workout.totalVolume) },
            { label: "Sets", value: String(workout.exercises.flatMap((e) => e.sets.filter((s) => s.is_completed && !s.is_warmup)).length) },
            { label: "Exercises", value: String(workout.exercises.length) },
          ].map((item, i) => (
            <View key={item.label} className={`flex-1 p-4 ${i > 0 ? "border-l border-surface-2 dark:border-zinc-800" : ""}`}>
              <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs uppercase tracking-widest mb-1">{item.label}</Text>
              <Text className="font-mono-medium text-text-primary dark:text-white text-base">{item.value}</Text>
            </View>
          ))}
        </View>

        {/* Share actions (read mode) */}
        {!editMode && (
          <View className="mx-5 mt-1 gap-2">
            <TouchableOpacity
              onPress={handleShareMarkdown}
              className="bg-surface dark:bg-zinc-900 flex-row items-center gap-3 px-5 py-4 rounded-2xl"
              activeOpacity={0.7}
            >
              <FileText size={18} color="#94A3B8" />
              <View>
                <Text className="font-montserrat-semibold text-text-primary dark:text-white text-base">Share as Text</Text>
                <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs">Markdown format</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSaveAsProgram}
              className="bg-surface dark:bg-zinc-900 flex-row items-center gap-3 px-5 py-4 rounded-2xl"
              activeOpacity={0.7}
            >
              <Plus size={18} color="#94A3B8" />
              <View>
                <Text className="font-montserrat-semibold text-text-primary dark:text-white text-base">Save as Program</Text>
                <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs">Use this workout as a template</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setCardVisible(true)}
              className="bg-surface dark:bg-zinc-900 flex-row items-center gap-3 px-5 py-4 rounded-2xl"
              activeOpacity={0.7}
            >
              <Camera size={18} color="#94A3B8" />
              <View>
                <Text className="font-montserrat-semibold text-text-primary dark:text-white text-base">Share Card</Text>
                <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs">Screenshot to share as image</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {editMode && (
          <View className="mx-5 mt-3 gap-2">
            <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs text-center">
              Tap title to rename · Tap date to edit · Trash to delete a set
            </Text>
            <TouchableOpacity
              onPress={saveEdits}
              className="bg-crimson dark:bg-blue-500 py-4 items-center rounded-2xl"
              activeOpacity={0.85}
            >
              <Text className="font-montserrat-bold text-white text-base">
                Save Changes
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Share card modal */}
      <Modal visible={cardVisible} transparent animationType="fade" onRequestClose={() => setCardVisible(false)}>
        <Pressable className="flex-1 bg-black/80 items-center justify-center px-4" onPress={() => setCardVisible(false)}>
          <Pressable>
            <WorkoutShareCard workout={workout} />
            <Text className="font-mono text-zinc-400 text-xs text-center mt-4">Screenshot to share</Text>
            <TouchableOpacity onPress={() => setCardVisible(false)} className="mt-3 items-center" activeOpacity={0.7}>
              <X size={22} color="#94A3B8" />
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Date / Duration edit modal */}
      {infoEdits && (
        <Modal visible={infoModalOpen} transparent animationType="slide" onRequestClose={() => setInfoModalOpen(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
            <Pressable className="flex-1 bg-black/70 justify-end" onPress={() => setInfoModalOpen(false)}>
              <Pressable>
                <View className="bg-surface dark:bg-zinc-900 px-5 pt-5 pb-10 rounded-t-3xl">
                  <View className="flex-row items-center justify-between mb-5">
                    <Text className="font-montserrat-bold text-text-primary dark:text-white text-lg">
                      Edit Workout Info
                    </Text>
                    <TouchableOpacity onPress={() => setInfoModalOpen(false)} hitSlop={8}>
                      <X size={18} color="#94A3B8" />
                    </TouchableOpacity>
                  </View>

                  {/* Date */}
                  <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs uppercase tracking-widest mb-2">Date</Text>
                  <View className="flex-row items-center gap-2 mb-5">
                    <View className="items-center">
                      <TextInput className={`${inputBase} w-14`} value={infoEdits.month} onChangeText={(v) => setInfoEdits((p) => p ? { ...p, month: v } : p)} keyboardType="number-pad" maxLength={2} placeholder="MM" placeholderTextColor="#94A3B8" />
                      <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs mt-1">Month</Text>
                    </View>
                    <Text className="font-mono text-text-muted dark:text-zinc-500 text-xl">/</Text>
                    <View className="items-center">
                      <TextInput className={`${inputBase} w-14`} value={infoEdits.day} onChangeText={(v) => setInfoEdits((p) => p ? { ...p, day: v } : p)} keyboardType="number-pad" maxLength={2} placeholder="DD" placeholderTextColor="#94A3B8" />
                      <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs mt-1">Day</Text>
                    </View>
                    <Text className="font-mono text-text-muted dark:text-zinc-500 text-xl">/</Text>
                    <View className="items-center">
                      <TextInput className={`${inputBase} w-20`} value={infoEdits.year} onChangeText={(v) => setInfoEdits((p) => p ? { ...p, year: v } : p)} keyboardType="number-pad" maxLength={4} placeholder="YYYY" placeholderTextColor="#94A3B8" />
                      <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs mt-1">Year</Text>
                    </View>
                  </View>

                  {/* Time */}
                  <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs uppercase tracking-widest mb-2">Time</Text>
                  <View className="flex-row items-center gap-2 mb-5">
                    <View className="items-center">
                      <TextInput className={`${inputBase} w-14`} value={infoEdits.hour} onChangeText={(v) => setInfoEdits((p) => p ? { ...p, hour: v } : p)} keyboardType="number-pad" maxLength={2} placeholder="H" placeholderTextColor="#94A3B8" />
                      <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs mt-1">Hour</Text>
                    </View>
                    <Text className="font-mono text-text-muted dark:text-zinc-500 text-xl">:</Text>
                    <View className="items-center">
                      <TextInput className={`${inputBase} w-14`} value={infoEdits.minute} onChangeText={(v) => setInfoEdits((p) => p ? { ...p, minute: v } : p)} keyboardType="number-pad" maxLength={2} placeholder="MM" placeholderTextColor="#94A3B8" />
                      <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs mt-1">Min</Text>
                    </View>
                    <View className="flex-row gap-1.5 ml-1">
                      {(["AM", "PM"] as const).map((v) => (
                        <TouchableOpacity
                          key={v}
                          onPress={() => setInfoEdits((p) => p ? { ...p, ampm: v } : p)}
                          className={`px-4 py-3 rounded-xl ${infoEdits.ampm === v ? "bg-crimson dark:bg-blue-500" : "bg-surface-2 dark:bg-zinc-800"}`}
                          activeOpacity={0.7}
                        >
                          <Text className={`font-mono text-sm ${infoEdits.ampm === v ? "text-white" : "text-text-muted dark:text-zinc-500"}`}>
                            {v}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Duration */}
                  <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs uppercase tracking-widest mb-2">Duration</Text>
                  <View className="flex-row items-center gap-2 mb-6">
                    <View className="items-center">
                      <TextInput className={`${inputBase} w-14`} value={infoEdits.durHours} onChangeText={(v) => setInfoEdits((p) => p ? { ...p, durHours: v } : p)} keyboardType="number-pad" maxLength={2} placeholder="0" placeholderTextColor="#94A3B8" />
                      <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs mt-1">Hours</Text>
                    </View>
                    <View className="items-center">
                      <TextInput className={`${inputBase} w-14`} value={infoEdits.durMins} onChangeText={(v) => setInfoEdits((p) => p ? { ...p, durMins: v } : p)} keyboardType="number-pad" maxLength={2} placeholder="0" placeholderTextColor="#94A3B8" />
                      <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs mt-1">Minutes</Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={() => {
                      if (!infoEdits) return;
                      const parsed = infoEditsToTimestamp(infoEdits);
                      if (!parsed) { Alert.alert("Invalid date", "Please check your date and time values."); return; }
                      setInfoModalOpen(false);
                    }}
                    className="bg-crimson dark:bg-blue-500 py-4 items-center rounded-2xl"
                    activeOpacity={0.85}
                  >
                    <Text className="font-montserrat-bold text-white text-base">Done</Text>
                  </TouchableOpacity>
                </View>
              </Pressable>
            </Pressable>
          </KeyboardAvoidingView>
        </Modal>
      )}

      <AddExerciseSheet
        visible={exerciseSheetOpen}
        onClose={() => setExerciseSheetOpen(false)}
        onSelect={handleAddExercise}
      />
    </SafeAreaView>
  );
}

/** Lifts and boxing sessions share this route; the workout's type decides which screen shows. */
export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const workoutId = parseInt(id, 10);
  const [type, setType] = useState<WorkoutType | null>(null);
  useEffect(() => { getWorkoutType(workoutId).then((t) => setType(t ?? "lift")).catch(() => setType("lift")); }, [workoutId]);
  if (!type) return <SafeAreaView className="flex-1 bg-obsidian dark:bg-zinc-950" />;
  return type === "boxing" ? <BoxingDetail id={workoutId} /> : <LiftWorkoutDetail />;
}
