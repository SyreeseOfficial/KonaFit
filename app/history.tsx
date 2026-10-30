import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { View, Text, TouchableOpacity, FlatList, RefreshControl, Alert, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronLeft, ChevronRight, MapPin, Search } from "lucide-react-native";
import { getWorkoutHistory, type WorkoutSummary } from "../src/db/historyQueries";
import { deleteWorkout } from "../src/db/workoutQueries";
import { formatDuration, formatShortDate, formatVolume } from "../src/utils/exportUtils";

const PAGE_SIZE = 50;

type Row = { kind: "month"; key: string; label: string } | { kind: "workout"; key: string; w: WorkoutSummary };

/** Interleaves month headers ("October 2026") into a newest-first workout list. */
function withMonthHeaders(workouts: WorkoutSummary[]): Row[] {
  const rows: Row[] = [];
  let last = "";
  for (const w of workouts) {
    const label = new Date(w.started_at * 1000).toLocaleDateString(undefined, { month: "long", year: "numeric" });
    if (label !== last) {
      rows.push({ kind: "month", key: `m-${label}`, label });
      last = label;
    }
    rows.push({ kind: "workout", key: String(w.id), w });
  }
  return rows;
}

export default function HistoryScreen() {
  const [workouts, setWorkouts] = useState<WorkoutSummary[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState(""); // debounced query
  const requestRef = useRef(0); // a newer reload makes older in-flight pages stale
  const loadingMoreRef = useRef(false);
  const rows = useMemo(() => withMonthHeaders(workouts), [workouts]);

  useEffect(() => {
    const t = setTimeout(() => setFilter(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

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
    const req = ++requestRef.current;
    if (spinner) setRefreshing(true);
    try {
      const page = await getWorkoutHistory(PAGE_SIZE, 0, filter);
      if (req !== requestRef.current) return;
      setWorkouts(page);
      setHasMore(page.length === PAGE_SIZE);
    } finally {
      if (req === requestRef.current) {
        setRefreshing(false);
        setLoading(false);
      }
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    const req = requestRef.current;
    try {
      const page = await getWorkoutHistory(PAGE_SIZE, workouts.length, filter);
      if (req !== requestRef.current) return;
      setWorkouts((prev) => [...prev, ...page]);
      setHasMore(page.length === PAGE_SIZE);
    } finally {
      loadingMoreRef.current = false;
    }
  }, [hasMore, workouts.length, filter]);

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
              {workouts.length}{hasMore ? "+" : ""} workouts · long-press to delete
            </Text>
          )}
        </View>
      </View>

      <View className="flex-row items-center mx-5 mt-3 px-3 h-11 bg-surface dark:bg-zinc-900 rounded-xl">
        <Search size={16} color="#94A3B8" />
        <TextInput
          className="flex-1 ml-2 font-montserrat text-text-primary dark:text-white text-base"
          placeholder="Filter by exercise"
          placeholderTextColor="#94A3B8"
          value={query}
          onChangeText={setQuery}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      <FlatList
        data={rows}
        keyExtractor={(r) => r.key}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        keyboardShouldPersistTaps="handled"
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
          loading ? null : (
            <View className="flex-1 items-center justify-center pt-20">
              <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-base">
                {filter ? "No workouts with that exercise" : "No workouts yet"}
              </Text>
            </View>
          )
        }
        renderItem={({ item: row }) => {
          if (row.kind === "month") {
            return (
              <Text className="font-montserrat-semibold text-text-muted dark:text-zinc-500 text-xs tracking-widest uppercase pt-4 pb-1">
                {row.label}
              </Text>
            );
          }
          const w = row.w;
          return (
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
                {w.rating != null && (
                  <Text className="font-mono text-amber-500 text-sm">★ {w.rating}/5</Text>
                )}
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
          );
        }}
      />
    </SafeAreaView>
  );
}
