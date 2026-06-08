import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react-native";
import { router } from "expo-router";
import { kvStore } from "../src/utils/kvStore";
import { getAllWorkoutDataForExport } from "../src/db/historyQueries";
import { exportCsvAndShare } from "../src/utils/exportUtils";
import { getDatabase } from "../src/db/database";

const REST_TIMER_KEY = "@konafit_default_rest_seconds";
export const DEFAULT_REST_SECONDS = 90;
const REST_STEP = 15;

export async function getDefaultRestSeconds(): Promise<number> {
  const raw = await kvStore.getItem(REST_TIMER_KEY);
  return raw ? parseInt(raw, 10) : DEFAULT_REST_SECONDS;
}

function Row({
  label,
  sublabel,
  onPress,
  danger,
  right,
}: {
  label: string;
  sublabel?: string;
  onPress?: () => void;
  danger?: boolean;
  right?: React.ReactNode;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="flex-row items-center justify-between px-4 py-4 border-b border-surface-2"
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View className="flex-1">
        <Text className={`font-montserrat-semibold text-sm ${danger ? "text-crimson" : "text-white"}`}>
          {label}
        </Text>
        {sublabel && (
          <Text className="font-mono text-text-muted text-xs mt-0.5">{sublabel}</Text>
        )}
      </View>
      {right ?? (onPress ? <ChevronRight size={16} color="#606060" /> : null)}
    </TouchableOpacity>
  );
}

function SectionLabel({ title }: { title: string }) {
  return (
    <Text className="font-mono text-text-muted text-xs tracking-widest uppercase px-4 pt-6 pb-2">
      {title}
    </Text>
  );
}

export default function SettingsScreen() {
  const [restSeconds, setRestSeconds] = useState(DEFAULT_REST_SECONDS);

  useEffect(() => {
    getDefaultRestSeconds().then(setRestSeconds);
  }, []);

  const adjustRest = useCallback(async (delta: number) => {
    const next = Math.max(REST_STEP, restSeconds + delta);
    setRestSeconds(next);
    await kvStore.setItem(REST_TIMER_KEY, String(next));
  }, [restSeconds]);

  const handleExport = useCallback(async () => {
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

  const handleWipeData = useCallback(() => {
    Alert.alert(
      "Wipe All Data",
      "This will permanently delete all workouts, exercises, and stats. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Everything",
          style: "destructive",
          onPress: async () => {
            try {
              const db = await getDatabase();
              await db.execAsync(`
                DELETE FROM logged_sets;
                DELETE FROM logged_exercises;
                DELETE FROM workouts;
                DELETE FROM bodyweight_logs;
                DELETE FROM lifestyle_logs;
                DELETE FROM progress_photos;
                DELETE FROM kv_store WHERE key != '${REST_TIMER_KEY}';
              `);
              Alert.alert("Done", "All data has been deleted.");
            } catch (e) {
              Alert.alert("Error", String(e));
            }
          },
        },
      ]
    );
  }, []);

  const formatRestTime = (secs: number) => {
    if (secs < 60) return `${secs}s`;
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return s === 0 ? `${m}m` : `${m}m ${s}s`;
  };

  return (
    <SafeAreaView className="flex-1 bg-obsidian">
      <View className="flex-row items-center gap-3 px-4 pt-4 pb-4 border-b border-surface-2">
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} activeOpacity={0.7}>
          <ChevronLeft size={22} color="#A0A0A0" />
        </TouchableOpacity>
        <Text className="font-anton text-white text-2xl tracking-widest uppercase">
          Settings
        </Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 48 }}>
        {/* Workout */}
        <SectionLabel title="Workout" />
        <View className="bg-surface">
          <Row
            label="Default Rest Timer"
            sublabel="Duration when rest timer auto-starts"
            right={
              <View className="flex-row items-center gap-3">
                <TouchableOpacity onPress={() => adjustRest(-REST_STEP)} hitSlop={8} activeOpacity={0.7}>
                  <Minus size={16} color="#A0A0A0" />
                </TouchableOpacity>
                <Text className="font-mono-medium text-white text-sm w-14 text-center">
                  {formatRestTime(restSeconds)}
                </Text>
                <TouchableOpacity onPress={() => adjustRest(REST_STEP)} hitSlop={8} activeOpacity={0.7}>
                  <Plus size={16} color="#A0A0A0" />
                </TouchableOpacity>
              </View>
            }
          />
        </View>

        {/* Data */}
        <SectionLabel title="Data" />
        <View className="bg-surface">
          <Row
            label="Export Workouts"
            sublabel="Download all data as CSV"
            onPress={handleExport}
          />
        </View>

        {/* Danger Zone */}
        <SectionLabel title="Danger Zone" />
        <View className="bg-surface">
          <Row
            label="Wipe All Data"
            sublabel="Permanently delete all workouts and records"
            danger
            onPress={handleWipeData}
          />
        </View>

        {/* About */}
        <SectionLabel title="About" />
        <View className="bg-surface">
          <Row label="KonaFit" sublabel="Version 1.0.0 · Local-first workout tracker" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
