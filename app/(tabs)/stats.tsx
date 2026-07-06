import { useState, useEffect, useCallback } from "react";
import { ScrollView, View, Text, RefreshControl, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Calculator, Download, Settings } from "lucide-react-native";
import {
  getTotalLifted,
  getTotalHours,
  getTotalPRCount,
  getWorkoutCount,
  getWorkoutDatesForStreak,
  calculateStreak,
  getLatestBodyweight,
  getWorkoutDays,
} from "../../src/db/statsQueries";
import { getWorkoutHistory, getAllWorkoutDataForExport, type WorkoutSummary } from "../../src/db/historyQueries";
import { exportCsvAndShare } from "../../src/utils/exportUtils";
import { StatsGrid } from "../../src/components/stats/StatsGrid";
import { HabitCalendar } from "../../src/components/stats/HabitCalendar";
import { LifestyleLogger } from "../../src/components/stats/LifestyleLogger";
import { SectionHeader } from "../../src/components/stats/SectionHeader";
import { WorkoutHistoryList } from "../../src/components/stats/WorkoutHistoryList";
import { ProgressPhotoGallery } from "../../src/components/stats/ProgressPhotoGallery";

type StatsData = {
  totalLiftedLbs: number;
  workoutCount: number;
  streak: number;
  bodyweightLbs: number | null;
  totalHours: number;
  prCount: number;
  workoutDays: Set<string>;
  recentWorkouts: WorkoutSummary[];
};

async function loadStats(): Promise<StatsData> {
  const [total, hours, prs, count, dates, bw, days, recent] = await Promise.all([
    getTotalLifted(),
    getTotalHours(),
    getTotalPRCount(),
    getWorkoutCount(),
    getWorkoutDatesForStreak(),
    getLatestBodyweight(),
    getWorkoutDays(91),
    getWorkoutHistory(5),
  ]);
  return {
    totalLiftedLbs: total,
    workoutCount: count,
    streak: calculateStreak(dates),
    bodyweightLbs: bw,
    totalHours: hours,
    prCount: prs,
    workoutDays: days,
    recentWorkouts: recent,
  };
}

export default function StatsScreen() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      const data = await loadStats();
      setStats(data);
      setRefreshKey((k) => k + 1);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, []);

  const handleExportCsv = useCallback(async () => {
    try {
      const rows = await getAllWorkoutDataForExport();
      if (rows.length === 0) {
        Alert.alert("No Data", "Finish at least one workout before exporting.");
        return;
      }
      await exportCsvAndShare(rows);
    } catch (e) {
      Alert.alert("Export Failed", String(e));
    }
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-obsidian dark:bg-zinc-950">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 80 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => refresh(true)}
            tintColor="#2563EB"
            colors={["#2563EB"]}
          />
        }
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 pt-6 pb-4">
          <Text className="font-montserrat-bold text-text-primary dark:text-white text-3xl">
            Stats
          </Text>
          <View className="flex-row items-center gap-4">
            <TouchableOpacity onPress={handleExportCsv} hitSlop={8} activeOpacity={0.7}>
              <Download size={20} color="#94A3B8" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push({ pathname: "/tools", params: { tab: "percent" } })}
              hitSlop={8}
              activeOpacity={0.7}
            >
              <Calculator size={20} color="#94A3B8" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/settings")}
              hitSlop={8}
              activeOpacity={0.7}
            >
              <Settings size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Grid */}
        <StatsGrid
          totalLiftedLbs={stats?.totalLiftedLbs ?? 0}
          workoutCount={stats?.workoutCount ?? 0}
          streak={stats?.streak ?? 0}
          bodyweightLbs={stats?.bodyweightLbs ?? null}
          totalHours={stats?.totalHours ?? 0}
          prCount={stats?.prCount ?? 0}
        />

        <View style={{ paddingHorizontal: 20, paddingTop: 56 }}>
          <SectionHeader title="Lifestyle" subtitle="Daily tracking" />
          <LifestyleLogger onSaved={() => refresh()} />
        </View>

        <View style={{ paddingHorizontal: 20, paddingTop: 56 }}>
          <SectionHeader title="Training Calendar" subtitle="Last 13 weeks" />
          <View className="bg-surface dark:bg-zinc-900 p-4 rounded-2xl">
            <HabitCalendar workoutDays={stats?.workoutDays ?? new Set()} />
          </View>
        </View>

        <View style={{ paddingHorizontal: 20, paddingTop: 56 }}>
          <SectionHeader title="History" subtitle="Last 5 workouts" />
          <WorkoutHistoryList workouts={stats?.recentWorkouts ?? []} />
        </View>

        <View style={{ paddingHorizontal: 20, paddingTop: 56 }}>
          <ProgressPhotoGallery refreshKey={refreshKey} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
