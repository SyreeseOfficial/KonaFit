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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { ChevronLeft, FileText, Camera, X, Pencil, Check, Trash2 } from "lucide-react-native";
import { getWorkoutDetail, type WorkoutDetail, type SetRecord, updateWorkoutName, updateLoggedSetValues, deleteLoggedSetFromHistory } from "../../src/db/historyQueries";
import {
  formatDate,
  formatDuration,
  formatVolume,
  shareWorkoutMarkdown,
} from "../../src/utils/exportUtils";
import { WorkoutShareCard } from "../../src/components/export/WorkoutShareCard";

export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [workout, setWorkout] = useState<WorkoutDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [cardVisible, setCardVisible] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameText, setNameText] = useState("");

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
    // Pre-populate edit buffers
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
    setEditMode(false);
    reload();
  }, [workout, setEdits, reload]);

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
              <Text className="font-mono text-text-muted text-xs mt-0.5">
                {formatDate(workout.started_at)} · {formatDuration(workout.duration_seconds)} · {formatVolume(workout.totalVolume)}
              </Text>
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

        {/* Share actions (only in read mode) */}
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
              Tap the workout title to rename · Trash icon to delete a set
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
    </SafeAreaView>
  );
}
