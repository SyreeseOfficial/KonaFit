import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { View, Text, TouchableOpacity, FlatList, RefreshControl, TextInput, Modal, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { ChevronLeft, ChevronRight, MapPin, Plus, Search, SlidersHorizontal } from "lucide-react-native";
import { getWorkoutHistory, type WorkoutSummary, type WorkoutType, type HistoryFilters } from "../src/db/historyQueries";
import { MUSCLE_GROUPS } from "../src/components/workout/AddExerciseSheet";
import { EmptyState } from "../src/components/EmptyState";
import { deleteWorkout } from "../src/db/workoutQueries";
import { formatDuration, formatShortDate, formatVolume } from "../src/utils/exportUtils";
import { confirm } from "../src/utils/confirm";

const PAGE_SIZE = 50;
const RANGES = [[0, "All time"], [30, "30 days"], [90, "90 days"], [365, "1 year"]] as const;

const Chip = ({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) => (
  <TouchableOpacity
    onPress={onPress}
    className={`px-4 h-11 items-center justify-center rounded-full ${on ? "bg-crimson dark:bg-blue-500" : "bg-surface-2 dark:bg-zinc-800"}`}
    activeOpacity={0.7}
  >
    <Text className={`font-montserrat-semibold text-sm ${on ? "text-white" : "text-text-primary dark:text-white"}`}>{label}</Text>
  </TouchableOpacity>
);

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
  const { exercise } = useLocalSearchParams<{ exercise?: string }>(); // from the Exercise page: "show every squat session"
  const [query, setQuery] = useState(exercise ?? "");
  const [filter, setFilter] = useState(exercise ?? ""); // debounced query
  const [muscle, setMuscle] = useState<string | undefined>();
  const [rangeDays, setRangeDays] = useState(0); // 0 = all time
  const [sort, setSort] = useState<"date" | "volume">("date");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [kind, setKind] = useState<WorkoutType | undefined>(undefined); // All / Lift / Boxing
  const requestRef = useRef(0); // a newer reload makes older in-flight pages stale
  const loadingMoreRef = useRef(false);
  const rows = useMemo(
    () => (sort === "date" ? withMonthHeaders(workouts) : workouts.map((w): Row => ({ kind: "workout", key: String(w.id), w }))),
    [workouts, sort]
  );
  const activeCount = (muscle ? 1 : 0) + (rangeDays ? 1 : 0) + (sort !== "date" ? 1 : 0);
  // Boxing sessions have no exercises, so the lift-only filters switch off with the Boxing tab.
  const extra = useCallback((): HistoryFilters => (kind === "boxing" ? {} : {
    muscle, sort, sinceSec: rangeDays ? Math.floor(Date.now() / 1000) - rangeDays * 86400 : undefined,
  }), [kind, muscle, sort, rangeDays]);

  useEffect(() => {
    const t = setTimeout(() => setFilter(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const handleDelete = useCallback(async (w: WorkoutSummary) => {
    if (!(await confirm({ title: "Delete Workout", message: `Delete ${formatShortDate(w.started_at)}? This cannot be undone.`, confirmText: "Delete", destructive: true }))) return;
    await deleteWorkout(w.id);
    setWorkouts((prev) => prev.filter((x) => x.id !== w.id));
  }, []);

  const load = useCallback(async (spinner = false) => {
    const req = ++requestRef.current;
    if (spinner) setRefreshing(true);
    try {
      const page = await getWorkoutHistory(PAGE_SIZE, 0, kind === "boxing" ? "" : filter, kind, extra());
      if (req !== requestRef.current) return;
      setWorkouts(page);
      setHasMore(page.length === PAGE_SIZE);
    } finally {
      if (req === requestRef.current) {
        setRefreshing(false);
        setLoading(false);
      }
    }
  }, [filter, kind, extra]);

  useEffect(() => { load(); }, [load]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    const req = requestRef.current;
    try {
      const page = await getWorkoutHistory(PAGE_SIZE, workouts.length, kind === "boxing" ? "" : filter, kind, extra());
      if (req !== requestRef.current) return;
      setWorkouts((prev) => [...prev, ...page]);
      setHasMore(page.length === PAGE_SIZE);
    } finally {
      loadingMoreRef.current = false;
    }
  }, [hasMore, workouts.length, filter, kind, extra]);

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
        <TouchableOpacity onPress={() => router.push("/boxing/quick-add" as never)} hitSlop={8} activeOpacity={0.7} accessibilityLabel="Log past boxing session">
          <Plus size={22} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      <View className="flex-row mx-5 mt-3" style={{ gap: 8 }}>
        {([[undefined, "All"], ["lift", "Lift"], ["boxing", "Boxing"]] as const).map(([k, label]) => {
          const on = kind === k;
          return (
            <TouchableOpacity
              key={label}
              onPress={() => setKind(k)}
              className={`px-4 py-2 rounded-full ${on ? "bg-crimson dark:bg-blue-500" : "bg-surface-2 dark:bg-zinc-800"}`}
              activeOpacity={0.7}
            >
              <Text className={`font-montserrat-semibold text-sm ${on ? "text-white" : "text-text-primary dark:text-white"}`}>{label}</Text>
            </TouchableOpacity>
          );
        })}
        {kind !== "boxing" && (
          <TouchableOpacity
            onPress={() => setSheetOpen(true)}
            className={`ml-auto flex-row items-center px-4 py-2 rounded-full ${activeCount ? "bg-crimson dark:bg-blue-500" : "bg-surface-2 dark:bg-zinc-800"}`}
            activeOpacity={0.7}
            accessibilityLabel="Filter and sort"
          >
            <SlidersHorizontal size={14} color={activeCount ? "#FFFFFF" : "#64748B"} />
            <Text className={`font-montserrat-semibold text-sm ml-1.5 ${activeCount ? "text-white" : "text-text-primary dark:text-white"}`}>
              {activeCount ? `Filters · ${activeCount}` : "Filters"}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {kind !== "boxing" && (
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
      )}

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
            filter || muscle || rangeDays
              ? <EmptyState message="No workouts match these filters." actionLabel="Clear filters" onAction={() => { setQuery(""); setFilter(""); setMuscle(undefined); setRangeDays(0); }} />
              : kind === "boxing"
                ? <EmptyState message="No boxing sessions yet." actionLabel="Log a past session" onAction={() => router.push("/boxing/quick-add" as never)} />
                : <EmptyState message="No workouts yet." actionLabel="Start a workout" onAction={() => router.replace("/(tabs)/train" as never)} />
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
                {w.type === "boxing" && <Text className="font-mono-medium text-crimson dark:text-blue-400 text-sm">Boxing</Text>}
                <Text className="font-mono text-text-muted dark:text-zinc-500 text-sm">
                  {formatDuration(w.duration_seconds)}
                </Text>
                {w.type === "boxing" ? (
                  <>
                    <Text className="font-mono text-text-muted dark:text-zinc-500 text-sm">{w.round_count} rounds</Text>
                    {w.avg_rpe != null && <Text className="font-mono text-text-muted dark:text-zinc-500 text-sm">RPE {w.avg_rpe.toFixed(1)}</Text>}
                  </>
                ) : (
                  <>
                    <Text className="font-mono text-text-muted dark:text-zinc-500 text-sm">{w.exercise_count} exercises</Text>
                    <Text className="font-mono text-text-muted dark:text-zinc-500 text-sm">{formatVolume(w.total_volume)}</Text>
                  </>
                )}
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
      <Modal visible={sheetOpen} transparent animationType="slide" onRequestClose={() => setSheetOpen(false)}>
        <Pressable className="flex-1 bg-black/50 justify-end" onPress={() => setSheetOpen(false)}>
          <Pressable>
            <View className="bg-surface dark:bg-zinc-900 rounded-t-3xl px-5 pt-5 pb-10" style={{ maxHeight: "85%" }}>
              <ScrollView>
                <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs uppercase tracking-widest mb-3">Sort</Text>
                <View className="flex-row" style={{ gap: 8 }}>
                  <Chip on={sort === "date"} label="Newest" onPress={() => setSort("date")} />
                  <Chip on={sort === "volume"} label="Most volume" onPress={() => setSort("volume")} />
                </View>
                <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs uppercase tracking-widest mt-6 mb-3">Date range</Text>
                <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                  {RANGES.map(([d, label]) => <Chip key={d} on={rangeDays === d} label={label} onPress={() => setRangeDays(d)} />)}
                </View>
                <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs uppercase tracking-widest mt-6 mb-3">Muscle group</Text>
                <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                  <Chip on={!muscle} label="Any" onPress={() => setMuscle(undefined)} />
                  {MUSCLE_GROUPS.map((m) => <Chip key={m} on={muscle === m} label={m} onPress={() => setMuscle(m)} />)}
                </View>
              </ScrollView>
              <TouchableOpacity
                onPress={() => setSheetOpen(false)}
                className="mt-5 h-12 items-center justify-center rounded-2xl bg-crimson dark:bg-blue-500"
                activeOpacity={0.85}
              >
                <Text className="font-montserrat-bold text-white text-base">Done</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
