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
import { OneRMChart } from "../../src/components/stats/OneRMChart";
import { MuscleTracker } from "../../src/components/stats/MuscleTracker";
import { LifestyleLogger } from "../../src/components/stats/LifestyleLogger";
import { SectionHeader } from "../../src/components/stats/SectionHeader";
import { WorkoutHistoryList } from "../../src/components/stats/WorkoutHistoryList";
import { ProgressPhotoGallery } from "../../src/components/stats/ProgressPhotoGallery";
import { StrengthScore } from "../../src/components/stats/StrengthScore";

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
    getWorkoutHistory(10),
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
    <SafeAreaView className="flex-1 bg-obsidian">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 48 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => refresh(true)}
            tintColor="#FF0000"
            colors={["#FF0000"]}
          />
        }
      >
        {/* Header */}
        <View className="flex-row items-start justify-between px-4 pt-4 pb-5">
          <View>
            <Text className="font-anton text-white text-3xl tracking-widest uppercase">
              Stats
            </Text>
          </View>
          <View className="flex-row items-center gap-4 mt-1">
            <TouchableOpacity onPress={handleExportCsv} hitSlop={8} activeOpacity={0.7}>
              <Download size={20} color="#606060" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push({ pathname: "/tools", params: { tab: "percent" } })}
              hitSlop={8}
              activeOpacity={0.7}
            >
              <Calculator size={20} color="#606060" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/settings")}
              hitSlop={8}
              activeOpacity={0.7}
            >
              <Settings size={20} color="#606060" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats Grid */}
        <View className="mb-6">
          <StatsGrid
            totalLiftedLbs={stats?.totalLiftedLbs ?? 0}
            workoutCount={stats?.workoutCount ?? 0}
            streak={stats?.streak ?? 0}
            bodyweightLbs={stats?.bodyweightLbs ?? null}
            totalHours={stats?.totalHours ?? 0}
            prCount={stats?.prCount ?? 0}
          />
        </View>

        {/* Strength Score */}
        <View className="px-4 mb-6">
          <SectionHeader title="Strength Score" subtitle="Relative strength rating" />
          <StrengthScore refreshKey={refreshKey} />
        </View>

        {/* 1RM Trajectory */}
        <View className="px-4 mb-6">
          <SectionHeader title="1RM Trajectory" subtitle="Epley formula" />
          <OneRMChart refreshKey={refreshKey} />
        </View>

        {/* Muscle Tracker */}
        <View className="px-4 mb-6">
          <SectionHeader title="Muscle Tracker" subtitle="Weighted sets by muscle" />
          <MuscleTracker refreshKey={refreshKey} />
        </View>

        {/* Habit Calendar */}
        <View className="px-4 mb-6">
          <SectionHeader title="Training Calendar" subtitle="Last 13 weeks" />
          <View className="bg-surface p-4">
            <HabitCalendar workoutDays={stats?.workoutDays ?? new Set()} />
          </View>
        </View>

        {/* Workout History */}
        <View className="px-4 mb-6">
          <SectionHeader title="History" subtitle="Recent workouts" />
          <WorkoutHistoryList workouts={stats?.recentWorkouts ?? []} />
        </View>

        {/* Progress Photos */}
        <View className="px-4 mb-6">
          <ProgressPhotoGallery refreshKey={refreshKey} />
        </View>

        {/* Lifestyle Logger */}
        <View className="px-4">
          <SectionHeader title="Lifestyle" subtitle="Daily tracking" />
          <LifestyleLogger onSaved={() => refresh()} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
