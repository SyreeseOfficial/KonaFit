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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { ChevronLeft, FileText, Camera, X } from "lucide-react-native";
import { getWorkoutDetail, type WorkoutDetail } from "../../src/db/historyQueries";
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

  useEffect(() => {
    getWorkoutDetail(parseInt(id, 10))
      .then(setWorkout)
      .finally(() => setLoading(false));
  }, [id]);

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
      <View className="flex-row items-center gap-3 px-4 pt-4 pb-4 border-b border-surface-2">
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} activeOpacity={0.7}>
          <ChevronLeft size={22} color="#A0A0A0" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="font-anton text-white text-xl tracking-widest uppercase">
            {formatDate(workout.started_at)}
          </Text>
          <Text className="font-mono text-text-muted text-xs mt-0.5">
            {formatDuration(workout.duration_seconds)} · {formatVolume(workout.totalVolume)}
          </Text>
        </View>
        {sharing ? (
          <ActivityIndicator color="#FF0000" size="small" />
        ) : (
          <View className="flex-row gap-3">
            <TouchableOpacity onPress={handleShareMarkdown} hitSlop={8} activeOpacity={0.7}>
              <FileText size={20} color="#606060" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setCardVisible(true)} hitSlop={8} activeOpacity={0.7}>
              <Camera size={20} color="#606060" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Exercise list */}
        {workout.exercises.map((ex) => (
          <View key={ex.id} className="mx-4 mt-4 bg-surface">
            <View className="px-4 py-3 border-b border-surface-2">
              <Text className="font-montserrat-bold text-white text-sm tracking-widest uppercase">
                {ex.exercise_name}
              </Text>
              {ex.muscle_group ? (
                <Text className="font-mono text-text-muted text-xs">{ex.muscle_group}</Text>
              ) : null}
            </View>

            <View className="flex-row px-4 py-1.5">
              <Text className="w-8 font-mono text-text-muted text-xs tracking-widest">SET</Text>
              <Text className="flex-1 font-mono text-text-muted text-xs tracking-widest text-right">LBS</Text>
              <Text className="w-16 font-mono text-text-muted text-xs tracking-widest text-right">REPS</Text>
              <Text className="w-14 font-mono text-text-muted text-xs tracking-widest text-right">RPE</Text>
            </View>

            {ex.sets.map((s) => (
              <View
                key={s.id}
                className={`flex-row items-center px-4 py-2 border-t border-surface-2 ${
                  !s.is_completed ? "opacity-40" : ""
                }`}
              >
                <Text className={`w-8 font-mono text-xs ${s.is_warmup ? "text-text-muted" : "text-text-secondary"}`}>
                  {s.is_warmup ? "W" : s.set_number}
                </Text>
                <Text className="flex-1 font-mono-medium text-white text-sm text-right">
                  {s.weight_lbs != null ? s.weight_lbs : "—"}
                </Text>
                <Text className="w-16 font-mono text-white text-sm text-right">
                  {s.reps != null ? s.reps : "—"}
                </Text>
                <Text className="w-14 font-mono text-text-muted text-xs text-right">
                  {s.rpe != null ? s.rpe : "—"}
                </Text>
              </View>
            ))}
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

        {/* Share actions */}
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
      </ScrollView>

      {/* Share card preview modal — screenshot to save */}
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
