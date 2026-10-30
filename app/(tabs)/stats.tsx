import { useState, useCallback } from "react";
import { ScrollView, View, Text, RefreshControl, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Download, Settings } from "lucide-react-native";
import {
  getStatsTotals,
  getTotalPRCount,
  getWorkoutDatesForStreak,
  calculateStreak,
  getLatestBodyweight,
} from "../../src/db/statsQueries";
import { getRestDays } from "../../src/utils/settings";
import { getAllWorkoutDataForExport } from "../../src/db/historyQueries";
import { exportCsvAndShare } from "../../src/utils/exportUtils";
import { WeeklyGoal } from "../../src/components/train/WeeklyGoal";
import { StatsGrid } from "../../src/components/stats/StatsGrid";
import { SectionHeader } from "../../src/components/stats/SectionHeader";
import { FeelChart } from "../../src/components/stats/FeelChart";
import { BodyweightLogger } from "../../src/components/stats/BodyweightLogger";
import { ProgressPhotoGallery } from "../../src/components/stats/ProgressPhotoGallery";

type StatsData = {
  totalLiftedLbs: number;
  workoutCount: number;
  streak: number;
  bodyweightLbs: number | null;
  totalSeconds: number;
  prCount: number;
};

async function loadStats(): Promise<StatsData> {
  const [totals, prs, dates, bw, restDays] = await Promise.all([
    getStatsTotals(),
    getTotalPRCount(),
    getWorkoutDatesForStreak(),
    getLatestBodyweight(),
    getRestDays(),
  ]);
  return {
    totalLiftedLbs: totals.totalLifted,
    workoutCount: totals.workoutCount,
    streak: calculateStreak(dates, restDays),
    bodyweightLbs: bw,
    totalSeconds: totals.seconds,
    prCount: prs,
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

  // Tabs stay mounted, so refetch on focus (e.g. after Settings > Wipe All Data).
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

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
              onPress={() => router.push("/settings")}
              hitSlop={8}
              activeOpacity={0.7}
            >
              <Settings size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        </View>

        <WeeklyGoal />

        {/* Stats Grid */}
        {stats && (
          <StatsGrid
            totalLiftedLbs={stats.totalLiftedLbs}
            workoutCount={stats.workoutCount}
            streak={stats.streak}
            bodyweightLbs={stats.bodyweightLbs}
            totalSeconds={stats.totalSeconds}
            prCount={stats.prCount}
          />
        )}

        <View style={{ paddingHorizontal: 20, paddingTop: 56 }}>
          <SectionHeader title="Lifestyle" subtitle="Daily tracking" />
          <BodyweightLogger onSaved={() => refresh()} refreshKey={refreshKey} />
        </View>

        <View style={{ paddingHorizontal: 20, paddingTop: 56 }}>
          <SectionHeader title="How it felt" subtitle="Rating, energy, sleep" />
          <FeelChart refreshKey={refreshKey} />
        </View>

        <View style={{ paddingHorizontal: 20, paddingTop: 56 }}>
          <ProgressPhotoGallery refreshKey={refreshKey} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
