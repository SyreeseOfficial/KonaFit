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
const WEIGHT_UNIT_KEY = "@konafit_weight_unit";
export const DEFAULT_REST_SECONDS = 90;
const REST_STEP = 15;

export type WeightUnit = "lbs" | "kg";

export async function getDefaultRestSeconds(): Promise<number> {
  const raw = await kvStore.getItem(REST_TIMER_KEY);
  return raw ? parseInt(raw, 10) : DEFAULT_REST_SECONDS;
}

export async function getWeightUnit(): Promise<WeightUnit> {
  const v = await kvStore.getItem(WEIGHT_UNIT_KEY);
  return (v as WeightUnit) ?? "lbs";
}

function Row({
  label,
  sublabel,
  onPress,
  danger,
  right,
  disabled,
}: {
  label: string;
  sublabel?: string;
  onPress?: () => void;
  danger?: boolean;
  right?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="flex-row items-center justify-between px-5 py-5 border-b border-surface-2 dark:border-zinc-800"
      activeOpacity={onPress && !disabled ? 0.7 : 1}
    >
      <View className="flex-1">
        <Text
          className={`font-montserrat-semibold text-base ${
            danger ? "text-rose-500" : disabled ? "text-text-muted dark:text-zinc-500" : "text-text-primary dark:text-white"
          }`}
        >
          {label}
        </Text>
        {sublabel && (
          <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-sm mt-0.5">{sublabel}</Text>
        )}
      </View>
      {right ?? (onPress && !disabled ? <ChevronRight size={16} color="#94A3B8" /> : null)}
    </TouchableOpacity>
  );
}

function SectionLabel({ title }: { title: string }) {
  return (
    <Text className="font-montserrat-semibold text-text-muted dark:text-zinc-500 text-xs tracking-widest uppercase px-5 pt-8 pb-3">
      {title}
    </Text>
  );
}

function ChipGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View className="flex-row" style={{ gap: 6 }}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt.key}
          onPress={() => onChange(opt.key)}
          className={`px-4 py-2 rounded-full ${value === opt.key ? "bg-crimson dark:bg-blue-500" : "bg-surface-2 dark:bg-zinc-800"}`}
          activeOpacity={0.7}
        >
          <Text
            className={`font-montserrat-semibold text-sm ${
              value === opt.key ? "text-white" : "text-text-secondary dark:text-zinc-400"
            }`}
          >
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function SettingsScreen() {
  const [restSeconds, setRestSeconds] = useState(DEFAULT_REST_SECONDS);
  const [weightUnit, setWeightUnit] = useState<WeightUnit>("lbs");

  useEffect(() => {
    getDefaultRestSeconds().then(setRestSeconds);
    getWeightUnit().then(setWeightUnit);
  }, []);

  const adjustRest = useCallback(async (delta: number) => {
    const next = Math.max(REST_STEP, restSeconds + delta);
    setRestSeconds(next);
    await kvStore.setItem(REST_TIMER_KEY, String(next));
  }, [restSeconds]);

  const handleWeightUnit = useCallback(async (u: WeightUnit) => {
    setWeightUnit(u);
    await kvStore.setItem(WEIGHT_UNIT_KEY, u);
  }, []);

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
                DELETE FROM goals;
                DELETE FROM kv_store WHERE key NOT IN ('${REST_TIMER_KEY}','${WEIGHT_UNIT_KEY}');
              `);
              Alert.alert("Done", "All workout data has been deleted.");
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
    <SafeAreaView className="flex-1 bg-obsidian dark:bg-zinc-950">
      <View className="flex-row items-center gap-3 px-5 pt-5 pb-5 border-b border-surface-2 dark:border-zinc-800">
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} activeOpacity={0.7}>
          <ChevronLeft size={22} color="#94A3B8" />
        </TouchableOpacity>
        <Text className="font-montserrat-bold text-text-primary dark:text-white text-2xl">
          Settings
        </Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 64 }}>

        {/* ── Units ───────────────────────────────────────────────────────── */}
        <SectionLabel title="Units" />
        <View className="bg-surface dark:bg-zinc-900 mx-5 rounded-2xl overflow-hidden">
          <View className="flex-row items-center justify-between px-5 py-5">
            <Text className="font-montserrat-semibold text-text-primary dark:text-white text-base">Weight</Text>
            <ChipGroup
              options={[
                { key: "lbs", label: "lbs" },
                { key: "kg", label: "kg" },
              ]}
              value={weightUnit}
              onChange={handleWeightUnit}
            />
          </View>
        </View>

        {/* ── Workout ─────────────────────────────────────────────────────── */}
        <SectionLabel title="Workout" />
        <View className="bg-surface dark:bg-zinc-900 mx-5 rounded-2xl overflow-hidden">
          <Row
            label="Default Rest Timer"
            sublabel="Duration when rest timer auto-starts"
            right={
              <View className="flex-row items-center gap-3">
                <TouchableOpacity
                  onPress={() => adjustRest(-REST_STEP)}
                  className="w-9 h-9 bg-surface-2 dark:bg-zinc-800 rounded-full items-center justify-center"
                  hitSlop={8}
                  activeOpacity={0.7}
                >
                  <Minus size={14} color="#64748B" />
                </TouchableOpacity>
                <Text className="font-mono-medium text-text-primary dark:text-white text-base w-14 text-center">
                  {formatRestTime(restSeconds)}
                </Text>
                <TouchableOpacity
                  onPress={() => adjustRest(REST_STEP)}
                  className="w-9 h-9 bg-surface-2 dark:bg-zinc-800 rounded-full items-center justify-center"
                  hitSlop={8}
                  activeOpacity={0.7}
                >
                  <Plus size={14} color="#64748B" />
                </TouchableOpacity>
              </View>
            }
          />
        </View>

        {/* ── Library ─────────────────────────────────────────────────────── */}
        <SectionLabel title="Library" />
        <View className="bg-surface dark:bg-zinc-900 mx-5 rounded-2xl overflow-hidden">
          <Row
            label="Custom Exercises"
            sublabel="Edit or delete exercises you've created"
            onPress={() => router.push("/custom-exercises" as never)}
          />
          <Row
            label="Archived Programs"
            sublabel="Restore or permanently delete archived programs"
            onPress={() => router.push("/archived-programs" as never)}
          />
        </View>

        {/* ── Data ────────────────────────────────────────────────────────── */}
        <SectionLabel title="Data" />
        <View className="bg-surface dark:bg-zinc-900 mx-5 rounded-2xl overflow-hidden">
          <Row
            label="Export Workouts"
            sublabel="Download all workout data as CSV"
            onPress={handleExport}
          />
        </View>

        {/* ── Danger Zone ─────────────────────────────────────────────────── */}
        <SectionLabel title="Danger Zone" />
        <View className="bg-surface dark:bg-zinc-900 mx-5 rounded-2xl overflow-hidden">
          <Row
            label="Wipe All Data"
            sublabel="Permanently delete all workouts, goals, and records"
            danger
            onPress={handleWipeData}
          />
        </View>

        {/* ── About ───────────────────────────────────────────────────────── */}
        <SectionLabel title="About" />
        <View className="bg-surface dark:bg-zinc-900 mx-5 rounded-2xl px-5 py-6" style={{ gap: 16 }}>
          <View>
            <Text className="font-montserrat-bold text-text-primary dark:text-white text-2xl mb-1">
              KonaFit
            </Text>
            <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-sm tracking-widest">
              Version 1.0.0 · Local-first · Completely free
            </Text>
          </View>

          <View style={{ height: 1, backgroundColor: "#E2E8F0" }} />

          <Text className="font-montserrat text-text-secondary dark:text-zinc-400 text-base leading-7">
            Built by{" "}
            <Text className="font-montserrat-bold text-text-primary dark:text-white">Syreese Delos Santos</Text>
            {" "}— a lifter tired of great apps locked behind paywalls.
          </Text>

          <Text className="font-montserrat text-text-secondary dark:text-zinc-400 text-base leading-7">
            No subscriptions. No ads. Everything stored locally on your device. Your data is yours.
          </Text>

          <Text className="font-montserrat-bold text-crimson dark:text-blue-400 text-base">
            Train hard.
          </Text>

          <View style={{ height: 1, backgroundColor: "#E2E8F0" }} />

          <View style={{ gap: 4 }}>
            <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-sm">
              Data stored locally · No account required · No ads
            </Text>
            <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-sm">
              © 2026 Syreese Delos Santos
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
