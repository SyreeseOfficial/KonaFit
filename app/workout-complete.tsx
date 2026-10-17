import { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { CheckCircle, MapPin, Clock, Dumbbell, Zap, TrendingUp } from "lucide-react-native";
import { getWorkoutDetail, type WorkoutDetail } from "../src/db/historyQueries";
import { createProgramFromWorkout } from "../src/db/programQueries";
import { formatDuration, formatShortDate, formatVolume } from "../src/utils/exportUtils";
import { kvStore } from "../src/utils/kvStore";

const LAST_PRS_KEY = "@konafit_last_prs";


export default function WorkoutCompleteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const workoutId = parseInt(id ?? "0", 10);

  const [workout, setWorkout] = useState<WorkoutDetail | null>(null);
  const [prs, setPrs] = useState<string[]>([]);

  const load = useCallback(async () => {
    const [detail, rawPrs] = await Promise.all([
      getWorkoutDetail(workoutId),
      kvStore.getItem(LAST_PRS_KEY),
    ]);
    setWorkout(detail);
    if (rawPrs) {
      try { setPrs(JSON.parse(rawPrs)); } catch {}
      kvStore.removeItem(LAST_PRS_KEY).catch(() => {});
    }
  }, [workoutId]);

  useEffect(() => { load(); }, [load]);

  if (!workout) {
    return (
      <SafeAreaView className="flex-1 bg-obsidian dark:bg-zinc-950 items-center justify-center">
        <ActivityIndicator color="#2563EB" />
      </SafeAreaView>
    );
  }

  const totalSets = workout.exercises.reduce(
    (sum, e) => sum + e.sets.filter((s) => s.is_completed && !s.is_warmup).length,
    0
  );

  const handleDone = () => {
    router.dismissAll();
  };

  const handleViewHistory = () => {
    router.replace(`/workout/${workoutId}` as never);
  };

  const handleSaveAsProgram = async () => {
    const name = `Program · ${formatShortDate(workout.started_at)}`;
    const programId = await createProgramFromWorkout(workoutId, name);
    router.dismissAll();
    router.push(`/programs/${programId}` as never);
  };

  return (
    <SafeAreaView className="flex-1 bg-obsidian dark:bg-zinc-950">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View className="items-center px-6 pt-12 pb-8">
          <View className="w-20 h-20 bg-crimson dark:bg-blue-500 rounded-full items-center justify-center mb-6">
            <CheckCircle size={40} color="#FFFFFF" strokeWidth={2} />
          </View>
          <Text className="font-montserrat-bold text-text-primary dark:text-white text-3xl text-center mb-1">
            Workout Complete
          </Text>
          <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-base text-center">
            {formatShortDate(workout.started_at)}
          </Text>
          {workout.location ? (
            <View className="flex-row items-center gap-1.5 mt-2">
              <MapPin size={13} color="#94A3B8" />
              <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-sm">
                {workout.location}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Stats grid */}
        <View className="mx-5 bg-surface dark:bg-zinc-900 rounded-2xl overflow-hidden mb-4">
          <View className="flex-row">
            {[
              { icon: <TrendingUp size={16} color="#94A3B8" />, label: "Volume", value: formatVolume(workout.totalVolume) },
              { icon: <Dumbbell size={16} color="#94A3B8" />, label: "Sets", value: String(totalSets) },
              { icon: <Clock size={16} color="#94A3B8" />, label: "Duration", value: formatDuration(workout.duration_seconds) },
            ].map((item, i) => (
              <View
                key={item.label}
                className={`flex-1 items-center py-5 ${i > 0 ? "border-l border-surface-2 dark:border-zinc-800" : ""}`}
              >
                <View className="mb-2">{item.icon}</View>
                <Text className="font-mono-medium text-text-primary dark:text-white text-lg mb-0.5">
                  {item.value}
                </Text>
                <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs uppercase tracking-widest">
                  {item.label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* PRs */}
        {prs.length > 0 && (
          <View className="mx-5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 rounded-2xl px-5 py-4 mb-4">
            <View className="flex-row items-center gap-2 mb-3">
              <Zap size={16} color="#F59E0B" fill="#F59E0B" />
              <Text className="font-montserrat-bold text-amber-600 dark:text-amber-400 text-sm uppercase tracking-widest">
                New PRs
              </Text>
            </View>
            {prs.map((name) => (
              <Text
                key={name}
                className="font-montserrat-semibold text-text-primary dark:text-white text-base mb-0.5"
              >
                {name}
              </Text>
            ))}
          </View>
        )}

        {/* Exercises */}
        <View className="mx-5 bg-surface dark:bg-zinc-900 rounded-2xl overflow-hidden mb-5">
          <View className="px-5 py-4 border-b border-surface-2 dark:border-zinc-800">
            <Text className="font-montserrat-bold text-text-primary dark:text-white text-base">
              Exercises · {workout.exercises.length}
            </Text>
          </View>
          {workout.exercises.map((ex, i) => {
            const doneSets = ex.sets.filter((s) => s.is_completed && !s.is_warmup);
            const topSet = doneSets.reduce<{ weight_lbs: number | null; reps: number | null } | null>(
              (best, s) => {
                if (!best) return s;
                const bVol = (best.weight_lbs ?? 0) * (best.reps ?? 0);
                const sVol = (s.weight_lbs ?? 0) * (s.reps ?? 0);
                return sVol > bVol ? s : best;
              },
              null
            );
            return (
              <View
                key={ex.id}
                className={`flex-row items-center px-5 py-4 ${i < workout.exercises.length - 1 ? "border-b border-surface-2 dark:border-zinc-800" : ""}`}
              >
                <Text className="font-mono text-text-muted dark:text-zinc-500 text-sm w-6">
                  {i + 1}
                </Text>
                <View className="flex-1 ml-2">
                  <Text className="font-montserrat-semibold text-text-primary dark:text-white text-base" numberOfLines={1}>
                    {ex.exercise_name}
                  </Text>
                  <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs mt-0.5">
                    {ex.muscle_group}
                  </Text>
                </View>
                <View className="items-end">
                  <Text className="font-mono-medium text-text-primary dark:text-white text-sm">
                    {doneSets.length} {doneSets.length === 1 ? "set" : "sets"}
                  </Text>
                  {topSet?.weight_lbs != null && topSet?.reps != null ? (
                    <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs">
                      {topSet.weight_lbs} × {topSet.reps}
                    </Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Bottom actions */}
      <View className="px-5 pb-5 pt-3 border-t border-surface-2 dark:border-zinc-800 bg-obsidian dark:bg-zinc-950 gap-3">
        <TouchableOpacity
          onPress={handleDone}
          className="bg-crimson dark:bg-blue-500 py-4 items-center rounded-2xl"
          activeOpacity={0.85}
        >
          <Text className="font-montserrat-bold text-white text-base">Done</Text>
        </TouchableOpacity>
        <View className="flex-row gap-3">
          <TouchableOpacity
            onPress={handleViewHistory}
            className="flex-1 py-3 items-center"
            activeOpacity={0.7}
          >
            <Text className="font-montserrat-semibold text-text-secondary dark:text-zinc-400 text-sm">
              View History
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSaveAsProgram}
            className="flex-1 py-3 items-center"
            activeOpacity={0.7}
          >
            <Text className="font-montserrat-semibold text-crimson dark:text-blue-400 text-sm">
              Save as Program
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
