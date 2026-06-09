import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  TextInput,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react-native";
import { router } from "expo-router";
import { kvStore } from "../src/utils/kvStore";
import { getAllWorkoutDataForExport } from "../src/db/historyQueries";
import { exportCsvAndShare } from "../src/utils/exportUtils";
import { getDatabase } from "../src/db/database";
import type { Gender } from "../src/utils/strengthScore";

// ─── Keys & defaults ──────────────────────────────────────────────────────────

const REST_TIMER_KEY = "@konafit_default_rest_seconds";
export const GENDER_KEY = "@konafit_gender";
export const AGE_KEY = "@konafit_age";
export const WEIGHT_UNIT_KEY = "@konafit_weight_unit";
export const DISTANCE_UNIT_KEY = "@konafit_distance_unit";
export const DEFAULT_REST_SECONDS = 90;
const REST_STEP = 15;

export type WeightUnit = "lbs" | "kg";
export type DistanceUnit = "mile" | "km";

export async function getDefaultRestSeconds(): Promise<number> {
  const raw = await kvStore.getItem(REST_TIMER_KEY);
  return raw ? parseInt(raw, 10) : DEFAULT_REST_SECONDS;
}

export async function getProfileSettings(): Promise<{ gender: Gender; age: number }> {
  const [g, a] = await Promise.all([kvStore.getItem(GENDER_KEY), kvStore.getItem(AGE_KEY)]);
  return {
    gender: (g as Gender) ?? "male",
    age: a ? parseInt(a, 10) : 25,
  };
}

export async function getWeightUnit(): Promise<WeightUnit> {
  const v = await kvStore.getItem(WEIGHT_UNIT_KEY);
  return (v as WeightUnit) ?? "lbs";
}

export async function getDistanceUnit(): Promise<DistanceUnit> {
  const v = await kvStore.getItem(DISTANCE_UNIT_KEY);
  return (v as DistanceUnit) ?? "mile";
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

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
      className="flex-row items-center justify-between px-4 py-4 border-b border-surface-2"
      activeOpacity={onPress && !disabled ? 0.7 : 1}
    >
      <View className="flex-1">
        <Text
          className={`font-montserrat-semibold text-sm ${
            danger ? "text-crimson" : disabled ? "text-text-muted" : "text-white"
          }`}
        >
          {label}
        </Text>
        {sublabel && (
          <Text className="font-mono text-text-muted text-xs mt-0.5">{sublabel}</Text>
        )}
      </View>
      {right ?? (onPress && !disabled ? <ChevronRight size={16} color="#606060" /> : null)}
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
          className={`px-4 py-2 ${value === opt.key ? "bg-crimson" : "bg-surface-2"}`}
          activeOpacity={0.7}
        >
          <Text
            className={`font-mono text-xs ${
              value === opt.key ? "text-white" : "text-text-secondary"
            }`}
          >
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const [restSeconds, setRestSeconds] = useState(DEFAULT_REST_SECONDS);
  const [gender, setGender] = useState<Gender>("male");
  const [ageText, setAgeText] = useState("25");
  const [weightUnit, setWeightUnit] = useState<WeightUnit>("lbs");
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>("mile");

  useEffect(() => {
    getDefaultRestSeconds().then(setRestSeconds);
    getProfileSettings().then((p) => {
      setGender(p.gender);
      setAgeText(String(p.age));
    });
    getWeightUnit().then(setWeightUnit);
    getDistanceUnit().then(setDistanceUnit);
  }, []);

  const handleGender = useCallback(async (g: Gender) => {
    setGender(g);
    await kvStore.setItem(GENDER_KEY, g);
  }, []);

  const handleAgeBlur = useCallback(async () => {
    const n = parseInt(ageText, 10);
    if (!isNaN(n) && n > 0 && n < 120) {
      await kvStore.setItem(AGE_KEY, String(n));
    } else {
      setAgeText("25");
      await kvStore.setItem(AGE_KEY, "25");
    }
  }, [ageText]);

  const adjustRest = useCallback(async (delta: number) => {
    const next = Math.max(REST_STEP, restSeconds + delta);
    setRestSeconds(next);
    await kvStore.setItem(REST_TIMER_KEY, String(next));
  }, [restSeconds]);

  const handleWeightUnit = useCallback(async (u: WeightUnit) => {
    setWeightUnit(u);
    await kvStore.setItem(WEIGHT_UNIT_KEY, u);
  }, []);

  const handleDistanceUnit = useCallback(async (u: DistanceUnit) => {
    setDistanceUnit(u);
    await kvStore.setItem(DISTANCE_UNIT_KEY, u);
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
                DELETE FROM kv_store WHERE key NOT IN ('${REST_TIMER_KEY}','${WEIGHT_UNIT_KEY}','${DISTANCE_UNIT_KEY}','${GENDER_KEY}','${AGE_KEY}');
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
    <SafeAreaView className="flex-1 bg-obsidian">
      <View className="flex-row items-center gap-3 px-4 pt-4 pb-4 border-b border-surface-2">
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} activeOpacity={0.7}>
          <ChevronLeft size={22} color="#A0A0A0" />
        </TouchableOpacity>
        <Text className="font-anton text-white text-2xl tracking-widest uppercase">
          Settings
        </Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 64 }}>

        {/* ── Profile ─────────────────────────────────────────────────────── */}
        <SectionLabel title="Profile" />
        <View className="bg-surface">
          <View className="flex-row items-center justify-between px-4 py-4 border-b border-surface-2">
            <View>
              <Text className="font-montserrat-semibold text-white text-sm">Gender</Text>
              <Text className="font-mono text-text-muted text-xs mt-0.5">Used for strength score</Text>
            </View>
            <View className="flex-row gap-1">
              {(["male", "female"] as Gender[]).map((g) => (
                <TouchableOpacity
                  key={g}
                  onPress={() => handleGender(g)}
                  className={`px-4 py-2 ${gender === g ? "bg-crimson" : "bg-surface-2"}`}
                  activeOpacity={0.7}
                >
                  <Text className={`font-montserrat-semibold text-xs uppercase tracking-wider ${gender === g ? "text-white" : "text-text-secondary"}`}>
                    {g === "male" ? "Male" : "Female"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View className="flex-row items-center justify-between px-4 py-4">
            <View>
              <Text className="font-montserrat-semibold text-white text-sm">Age</Text>
              <Text className="font-mono text-text-muted text-xs mt-0.5">Used for strength score</Text>
            </View>
            <TextInput
              className="font-mono-medium text-white text-sm bg-surface-2 w-16 text-center h-9"
              value={ageText}
              onChangeText={setAgeText}
              onBlur={handleAgeBlur}
              keyboardType="number-pad"
              maxLength={3}
            />
          </View>
        </View>

        {/* ── Units ───────────────────────────────────────────────────────── */}
        <SectionLabel title="Units" />
        <View className="bg-surface">
          <View className="flex-row items-center justify-between px-4 py-4 border-b border-surface-2">
            <View>
              <Text className="font-montserrat-semibold text-white text-sm">Weight</Text>
            </View>
            <ChipGroup
              options={[
                { key: "lbs", label: "lbs" },
                { key: "kg", label: "kg" },
              ]}
              value={weightUnit}
              onChange={handleWeightUnit}
            />
          </View>
          <View className="flex-row items-center justify-between px-4 py-4">
            <View>
              <Text className="font-montserrat-semibold text-white text-sm">Distance</Text>
            </View>
            <ChipGroup
              options={[
                { key: "mile", label: "mi" },
                { key: "km", label: "km" },
              ]}
              value={distanceUnit}
              onChange={handleDistanceUnit}
            />
          </View>
        </View>

        {/* ── Workout ─────────────────────────────────────────────────────── */}
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

        {/* ── Library ─────────────────────────────────────────────────────── */}
        <SectionLabel title="Library" />
        <View className="bg-surface">
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
        <View className="bg-surface">
          <Row
            label="Export Workouts"
            sublabel="Download all workout data as CSV"
            onPress={handleExport}
          />
        </View>

        {/* ── Danger Zone ─────────────────────────────────────────────────── */}
        <SectionLabel title="Danger Zone" />
        <View className="bg-surface">
          <Row
            label="Wipe All Data"
            sublabel="Permanently delete all workouts, goals, and records"
            danger
            onPress={handleWipeData}
          />
        </View>

        {/* ── About ───────────────────────────────────────────────────────── */}
        <SectionLabel title="About" />
        <View className="bg-surface mx-0 px-4 py-5" style={{ gap: 16 }}>
          <View>
            <Text className="font-anton text-white text-2xl tracking-widest uppercase mb-1">
              KonaFit
            </Text>
            <Text className="font-mono text-text-muted text-xs tracking-widest">
              VERSION 1.0.0 · LOCAL-FIRST · FULLY FREE
            </Text>
          </View>

          <View style={{ height: 1, backgroundColor: "#2A2A2A" }} />

          <Text className="font-montserrat text-text-secondary text-sm leading-6">
            Built by{" "}
            <Text className="font-montserrat-bold text-white">Syreese Delos Santos</Text>
            {" "}— a lifter who got tired of every good workout app either being garbage or locking its best features behind a paywall.
          </Text>

          <Text className="font-montserrat text-text-secondary text-sm leading-6">
            KonaFit is completely free. No subscriptions. No premium tiers. No paywalled features. Everything works out of the box, stored locally on your device. Your data is yours.
          </Text>

          <Text className="font-montserrat text-text-secondary text-sm leading-6">
            The mission is simple: build the best free workout tracker that actually respects the people using it.
          </Text>

          <Text className="font-montserrat-bold text-crimson text-sm tracking-widest uppercase">
            Train hard.
          </Text>

          <View style={{ height: 1, backgroundColor: "#2A2A2A" }} />

          <View style={{ gap: 4 }}>
            <Text className="font-mono text-text-muted text-xs">
              Data stored locally · No account required · No ads
            </Text>
            <Text className="font-mono text-text-muted text-xs">
              © 2025 Syreese Delos Santos
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
