import { useState, useEffect, useCallback } from "react";
import { View, Text, TouchableOpacity, FlatList, RefreshControl, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react-native";
import { getWorkoutHistory, type WorkoutSummary } from "../src/db/historyQueries";
import { deleteWorkout } from "../src/db/workoutQueries";
import { formatDuration, formatShortDate, formatVolume } from "../src/utils/exportUtils";

export default function HistoryScreen() {
  const [workouts, setWorkouts] = useState<WorkoutSummary[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const handleDelete = useCallback((w: WorkoutSummary) => {
    Alert.alert(
      "Delete Workout",
      `Delete ${formatShortDate(w.started_at)}? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteWorkout(w.id);
            setWorkouts((prev) => prev.filter((x) => x.id !== w.id));
          },
        },
      ]
    );
  }, []);

  const load = useCallback(async (spinner = false) => {
    if (spinner) setRefreshing(true);
    try {
      setWorkouts(await getWorkoutHistory(500));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView className="flex-1 bg-obsidian dark:bg-zinc-950">
      <View className="flex-row items-center gap-3 px-5 pt-5 pb-5 border-b border-surface-2 dark:border-zinc-800">
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} activeOpacity={0.7}>
          <ChevronLeft size={22} color="#94A3B8" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="font-montserrat-bold text-text-primary dark:text-white text-2xl">
            History
          </Text>
          {workouts.length > 0 && (
            <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-sm mt-0.5">
              {workouts.length} workouts
            </Text>
          )}
        </View>
      </View>

      <FlatList
        data={workouts}
        keyExtractor={(w) => String(w.id)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor="#2563EB"
            colors={["#2563EB"]}
          />
        }
        contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 20, paddingTop: 12, gap: 8 }}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center pt-20">
            <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-base">
              No workouts yet
            </Text>
          </View>
        }
        renderItem={({ item: w }) => (
          <TouchableOpacity
            onPress={() => router.push(`/workout/${w.id}` as never)}
            onLongPress={() => handleDelete(w)}
            className="flex-row items-center px-5 py-5 bg-surface dark:bg-zinc-900 rounded-2xl"
            activeOpacity={0.7}
          >
            <View className="flex-1">
              <Text className="font-montserrat-bold text-text-primary dark:text-white text-base mb-1">
                {formatShortDate(w.started_at)}
              </Text>
              <View className="flex-row gap-3 flex-wrap">
                <Text className="font-mono text-text-muted dark:text-zinc-500 text-sm">
                  {formatDuration(w.duration_seconds)}
                </Text>
                <Text className="font-mono text-text-muted dark:text-zinc-500 text-sm">
                  {w.exercise_count} exercises
                </Text>
                <Text className="font-mono text-text-muted dark:text-zinc-500 text-sm">
                  {formatVolume(w.total_volume)}
                </Text>
              </View>
              {w.location && (
                <View className="flex-row items-center gap-1 mt-1.5">
                  <MapPin size={11} color="#94A3B8" />
                  <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-sm">{w.location}</Text>
                </View>
              )}
            </View>
            <ChevronRight size={16} color="#94A3B8" />
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}
