import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react-native";
import { router } from "expo-router";
import Constants from "expo-constants";
import { kvStore } from "../src/utils/kvStore";
import { getAllWorkoutDataForExport } from "../src/db/historyQueries";
import { exportCsvAndShare } from "../src/utils/exportUtils";
import { wipeAllData } from "../src/db/wipe";
import { removeOrphanPhotos } from "../src/utils/photoFiles";
import { THEME_KEY, loadTheme, setTheme, type ThemePref } from "../src/utils/theme";
import {
  REST_TIMER_KEY,
  PRESERVED_KEYS,
  REST_DAYS_KEY,
  getRestDays,
  REST_STEP_KEY,
  REST_STEP_OPTIONS,
  DEFAULT_REST_STEP,
  getRestStep,
  DEFAULT_REST_SECONDS,
  WEEKLY_GOAL_KEY,
  DEFAULT_WEEKLY_GOAL,
  getDefaultRestSeconds,
  getWeeklyGoal,
} from "../src/utils/settings";
import { HAPTICS_KEY, loadHapticsSetting, setHapticsEnabled } from "../src/utils/haptics";

const REST_STEP = 15;
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

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
  const [hapticsOn, setHapticsOn] = useState(true);
  const [theme, setThemePref] = useState<ThemePref>("system");
  const [weeklyGoal, setWeeklyGoal] = useState(DEFAULT_WEEKLY_GOAL);
  const [restDays, setRestDays] = useState<number[]>([]);
  const [restStep, setRestStepState] = useState(DEFAULT_REST_STEP);
  const [wipeOpen, setWipeOpen] = useState(false);
  const [wipeText, setWipeText] = useState("");

  useEffect(() => {
    getDefaultRestSeconds().then(setRestSeconds);
    loadHapticsSetting().then(setHapticsOn);
    loadTheme().then(setThemePref);
    getWeeklyGoal().then(setWeeklyGoal);
    getRestDays().then(setRestDays);
    getRestStep().then(setRestStepState);
  }, []);

  const toggleRestDay = useCallback(async (day: number) => {
    const next = restDays.includes(day) ? restDays.filter((d) => d !== day) : [...restDays, day].sort();
    setRestDays(next);
    await kvStore.setItem(REST_DAYS_KEY, next.join(","));
  }, [restDays]);

  const handleTheme = useCallback(async (t: ThemePref) => {
    setThemePref(t);
    await setTheme(t);
  }, []);

  const adjustWeeklyGoal = useCallback(async (delta: number) => {
    const next = Math.min(7, Math.max(1, weeklyGoal + delta));
    setWeeklyGoal(next);
    await kvStore.setItem(WEEKLY_GOAL_KEY, String(next));
  }, [weeklyGoal]);

  const handleHaptics = useCallback(async (v: "on" | "off") => {
    setHapticsOn(v === "on");
    await setHapticsEnabled(v === "on");
  }, []);

  const adjustRest = useCallback(async (delta: number) => {
    const next = Math.max(REST_STEP, restSeconds + delta);
    setRestSeconds(next);
    await kvStore.setItem(REST_TIMER_KEY, String(next));
  }, [restSeconds]);

  const handleRestStep = useCallback(async (v: string) => {
    setRestStepState(Number(v));
    await kvStore.setItem(REST_STEP_KEY, v);
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

  const handleWipeData = useCallback(async () => {
    setWipeOpen(false);
    setWipeText("");
    try {
      await wipeAllData([...PRESERVED_KEYS, HAPTICS_KEY, THEME_KEY]);
      await removeOrphanPhotos().catch(console.error); // the photo rows are gone, so every photo file is now an orphan
      Alert.alert("Done", "All workout data has been deleted.");
    } catch (e) {
      Alert.alert("Error", String(e));
    }
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

        {/* ── Preferences ─────────────────────────────────────────────────── */}
        <SectionLabel title="Preferences" />
        <View className="bg-surface dark:bg-zinc-900 mx-5 rounded-2xl overflow-hidden">
          <View className="flex-row items-center justify-between px-5 py-5">
            <Text className="font-montserrat-semibold text-text-primary dark:text-white text-base">Haptics</Text>
            <ChipGroup
              options={[
                { key: "on", label: "On" },
                { key: "off", label: "Off" },
              ]}
              value={hapticsOn ? "on" : "off"}
              onChange={handleHaptics}
            />
          </View>
          <View className="flex-row items-center justify-between px-5 py-5 border-t border-surface-2 dark:border-zinc-800">
            <Text className="font-montserrat-semibold text-text-primary dark:text-white text-base">Theme</Text>
            <ChipGroup
              options={[
                { key: "system", label: "System" },
                { key: "light", label: "Light" },
                { key: "dark", label: "Dark" },
              ]}
              value={theme}
              onChange={handleTheme}
            />
          </View>
          <Row
            label="Weekly Goal"
            sublabel="Workouts per week"
            right={
              <View className="flex-row items-center gap-3">
                <TouchableOpacity
                  onPress={() => adjustWeeklyGoal(-1)}
                  className="w-9 h-9 bg-surface-2 dark:bg-zinc-800 rounded-full items-center justify-center"
                  hitSlop={8}
                  activeOpacity={0.7}
                >
                  <Minus size={14} color="#64748B" />
                </TouchableOpacity>
                <Text className="font-mono-medium text-text-primary dark:text-white text-base w-8 text-center">
                  {weeklyGoal}
                </Text>
                <TouchableOpacity
                  onPress={() => adjustWeeklyGoal(1)}
                  className="w-9 h-9 bg-surface-2 dark:bg-zinc-800 rounded-full items-center justify-center"
                  hitSlop={8}
                  activeOpacity={0.7}
                >
                  <Plus size={14} color="#64748B" />
                </TouchableOpacity>
              </View>
            }
          />
          <View className="px-5 py-5 border-t border-surface-2 dark:border-zinc-800">
            <Text className="font-montserrat-semibold text-text-primary dark:text-white text-base">Rest Days</Text>
            <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-sm mt-0.5 mb-3">
              Planned days off won&apos;t break your streak
            </Text>
            <View className="flex-row justify-between">
              {WEEKDAYS.map((label, day) => (
                <TouchableOpacity
                  key={day}
                  onPress={() => toggleRestDay(day)}
                  className={`w-10 h-10 items-center justify-center rounded-full ${restDays.includes(day) ? "bg-crimson dark:bg-blue-500" : "bg-surface-2 dark:bg-zinc-800"}`}
                  activeOpacity={0.7}
                >
                  <Text className={`font-montserrat-semibold text-sm ${restDays.includes(day) ? "text-white" : "text-text-secondary dark:text-zinc-400"}`}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
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
          <View className="flex-row items-center justify-between px-5 py-5 border-t border-surface-2 dark:border-zinc-800">
            <View className="flex-1">
              <Text className="font-montserrat-semibold text-text-primary dark:text-white text-base">Timer +/- Step</Text>
              <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-sm mt-0.5">Seconds per tap while resting</Text>
            </View>
            <ChipGroup
              options={REST_STEP_OPTIONS.map((n) => ({ key: String(n), label: `${n}s` }))}
              value={String(restStep)}
              onChange={handleRestStep}
            />
          </View>
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
            label="Deleted Exercises"
            sublabel="Restore exercises you deleted"
            onPress={() => router.push("/deleted-exercises" as never)}
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
            onPress={() => setWipeOpen(true)}
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
              Version {Constants.expoConfig?.version ?? "1.0.0"} · Local-first · Completely free
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
      {/* Typing DELETE guards against a mis-tap; Export first is one tap away. */}
      <Modal visible={wipeOpen} transparent animationType="fade" onRequestClose={() => setWipeOpen(false)}>
        <View className="flex-1 bg-black/60 items-center justify-center px-6">
          <View className="bg-surface dark:bg-zinc-900 w-full p-6 rounded-2xl">
            <Text className="font-montserrat-bold text-text-primary dark:text-white text-xl mb-2">Wipe All Data</Text>
            <Text className="font-montserrat text-text-secondary dark:text-zinc-400 text-sm mb-4">
              This permanently deletes all workouts, programs, custom exercises, goals and records. There is no backup.
            </Text>
            <TouchableOpacity
              onPress={handleExport}
              className="bg-surface-2 dark:bg-zinc-800 py-3 items-center rounded-xl mb-4"
              activeOpacity={0.8}
            >
              <Text className="font-montserrat-semibold text-text-primary dark:text-white text-sm">Export first (CSV)</Text>
            </TouchableOpacity>
            <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-xs mb-2">Type DELETE to confirm</Text>
            <TextInput
              className="h-11 bg-surface-2 dark:bg-zinc-800 px-4 font-mono text-text-primary dark:text-white text-base rounded-xl mb-4"
              value={wipeText}
              onChangeText={setWipeText}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="DELETE"
              placeholderTextColor="#94A3B8"
            />
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => { setWipeOpen(false); setWipeText(""); }}
                className="flex-1 bg-surface-2 dark:bg-zinc-800 py-4 items-center rounded-xl"
                activeOpacity={0.8}
              >
                <Text className="font-montserrat-semibold text-text-secondary dark:text-zinc-400 text-sm">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleWipeData}
                disabled={wipeText !== "DELETE"}
                className={`flex-1 py-4 items-center rounded-xl bg-rose-500 ${wipeText !== "DELETE" ? "opacity-40" : ""}`}
                activeOpacity={0.8}
              >
                <Text className="font-montserrat-bold text-white text-sm">Delete Everything</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
