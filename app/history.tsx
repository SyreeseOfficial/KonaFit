import { useState, useEffect, useCallback } from "react";
import { View, Text, TouchableOpacity, FlatList, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react-native";
import { getWorkoutHistory, type WorkoutSummary } from "../src/db/historyQueries";
import { formatDuration, formatShortDate, formatVolume } from "../src/utils/exportUtils";

export default function HistoryScreen() {
  const [workouts, setWorkouts] = useState<WorkoutSummary[]>([]);
  const [refreshing, setRefreshing] = useState(false);

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
    <SafeAreaView className="flex-1 bg-obsidian">
      <View className="flex-row items-center gap-3 px-4 pt-5 pb-5 border-b border-surface-2">
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} activeOpacity={0.7}>
          <ChevronLeft size={22} color="#A0A0A0" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="font-anton text-white text-2xl tracking-widest uppercase">
            History
          </Text>
          {workouts.length > 0 && (
            <Text className="font-mono text-text-muted text-xs mt-0.5">
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
            tintColor="#FF0000"
            colors={["#FF0000"]}
          />
        }
        contentContainerStyle={{ paddingBottom: 40 }}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center pt-20">
            <Text className="font-montserrat text-text-muted text-sm">
              No workouts yet
            </Text>
          </View>
        }
        renderItem={({ item: w, index }) => (
          <TouchableOpacity
            onPress={() => router.push(`/workout/${w.id}` as never)}
            className={`flex-row items-center px-4 py-5 bg-surface ${index > 0 ? "border-t border-surface-2" : ""}`}
            activeOpacity={0.7}
          >
            <View className="flex-1">
              <Text className="font-montserrat-semibold text-white text-xs tracking-wider uppercase mb-0.5">
                {formatShortDate(w.started_at)}
              </Text>
              <View className="flex-row gap-3 flex-wrap">
                <Text className="font-mono text-text-muted text-xs">
                  {formatDuration(w.duration_seconds)}
                </Text>
                <Text className="font-mono text-text-muted text-xs">
                  {w.exercise_count} exercises
                </Text>
                <Text className="font-mono text-text-muted text-xs">
                  {formatVolume(w.total_volume)}
                </Text>
              </View>
              {w.location && (
                <View className="flex-row items-center gap-1 mt-1">
                  <MapPin size={10} color="#606060" />
                  <Text className="font-mono text-text-muted text-xs">{w.location}</Text>
                </View>
              )}
            </View>
            <ChevronRight size={16} color="#606060" />
          </TouchableOpacity>
        )}
      />
    </SafeAreaView>
  );
}
