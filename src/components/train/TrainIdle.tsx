import { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, Modal, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { Plus, Settings, BarChart2, ChevronRight, MoreHorizontal, Copy, Archive, Trash2 } from "lucide-react-native";
import { WeeklyGoal } from "./WeeklyGoal";
import { GoalsSection } from "./GoalsSection";
import { StartSheet } from "./StartSheet";
import { ReadinessForm } from "../stats/ReadinessCard";
import { EmptyState } from "../EmptyState";
import { loadSnapshot, clearSnapshot, type BoxingSnapshot } from "../../utils/boxingSnapshot";
import { hasLastSetup, getLastSetup, getGetReadySec } from "../../utils/boxingSettings";
import { sessionHref } from "../../utils/boxingRoute";
import { formatTime, localDateKey } from "../../utils/time";
import { getTodayReadiness } from "../../db/insightQueries";
import { getPrograms, deleteProgram, cloneProgram, archiveProgram } from "../../db/programQueries";
import { getWorkoutHistory, type WorkoutSummary } from "../../db/historyQueries";
import { formatVolume, formatShortDate, formatDuration } from "../../utils/exportUtils";
import { kvStore } from "../../utils/kvStore";
import type { ProgramSummary } from "../../types/program";
import { logError } from "../../utils/errors";
import { confirm } from "../../utils/confirm";

const READINESS_SKIP_KEY = "@konafit_boxing_readiness_skip_day"; // local day the pre-boxing check-in was skipped

type Props = {
  startWorkout: () => Promise<void>;
  repeatLastWorkout: () => Promise<void>;
  /** Runs `go` after asking about (and discarding) a boxing session left running. */
  startUnlessBoxingRunning: (go: () => void) => Promise<void>;
};

/** The Train tab with no workout in progress: week progress, start buttons, programs, recent history, goals. */
export function TrainIdle({ startWorkout, repeatLastWorkout, startUnlessBoxingRunning }: Props) {
  const [startSheetOpen, setStartSheetOpen] = useState(false);
  const start = (go: () => void) => { setStartSheetOpen(false); return startUnlessBoxingRunning(go); };
  const [readinessGo, setReadinessGo] = useState<(() => void) | null>(null); // boxing start waiting on the optional check-in
  const [readinessSaved, setReadinessSaved] = useState(false);

  // Once a day, before boxing: offer the readiness check-in. Skipping never blocks, and isn't asked again that day.
  const withReadiness = useCallback(async (go: () => void) => {
    const [today, skipped] = await Promise.all([getTodayReadiness(), kvStore.getItem(READINESS_SKIP_KEY)]).catch(() => [null, null] as const);
    if (today || skipped === localDateKey(new Date())) return go();
    setReadinessSaved(false);
    setReadinessGo(() => go);
  }, []);
  const finishReadiness = useCallback(async () => {
    const go = readinessGo;
    setReadinessGo(null);
    if (!readinessSaved) await kvStore.setItem(READINESS_SKIP_KEY, localDateKey(new Date())).catch(() => {});
    go?.();
  }, [readinessGo, readinessSaved]);
  const [boxingResume, setBoxingResume] = useState<BoxingSnapshot | null>(null);
  useEffect(() => { loadSnapshot().then(setBoxingResume).catch(() => {}); }, []); // killed mid-session? offer to pick up where it left off
  const [lastBoxing, setLastBoxing] = useState<{ rounds: number; workSec: number; restSec: number } | null>(null);

  const [programs, setPrograms] = useState<ProgramSummary[]>([]);
  const [recentWorkouts, setRecentWorkouts] = useState<WorkoutSummary[]>([]);
  const [menuProgram, setMenuProgram] = useState<ProgramSummary | null>(null);

  const loadPrograms = useCallback(async () => {
    setPrograms(await getPrograms());
  }, []);

  const loadRecentWorkouts = useCallback(async () => {
    setRecentWorkouts(await getWorkoutHistory(3));
  }, []);

  useFocusEffect(useCallback(() => {
    loadPrograms();
    loadRecentWorkouts();
    hasLastSetup().then(async (has) => setLastBoxing(has ? await getLastSetup() : null)).catch(() => setLastBoxing(null));
  }, [loadPrograms, loadRecentWorkouts]));

  const handleProgramDelete = async (p: ProgramSummary) => {
    setMenuProgram(null);
    if (!(await confirm({ title: "Delete Program", message: `Permanently delete "${p.name}"? This cannot be undone.`, confirmText: "Delete", destructive: true }))) return;
    await deleteProgram(p.id);
    loadPrograms();
  };

  const handleProgramArchive = async (p: ProgramSummary) => {
    setMenuProgram(null);
    await archiveProgram(p.id);
    loadPrograms();
  };

  const handleProgramClone = async (p: ProgramSummary) => {
    setMenuProgram(null);
    await cloneProgram(p.id);
    loadPrograms();
  };


  return (
    <SafeAreaView className="flex-1 bg-obsidian dark:bg-zinc-950">
      <View className="flex-row items-center justify-between px-5 pt-6 pb-3">
        <Text className="font-montserrat-bold text-text-primary dark:text-white text-3xl">
          Train
        </Text>
        <View className="flex-row items-center gap-4">
          <TouchableOpacity onPress={() => router.push("/stats" as never)} hitSlop={8} activeOpacity={0.7} accessibilityLabel="Stats">
            <BarChart2 size={20} color="#94A3B8" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push("/settings")} hitSlop={8} activeOpacity={0.7} accessibilityLabel="Settings">
            <Settings size={20} color="#94A3B8" />
          </TouchableOpacity>
        </View>
      </View>

      <WeeklyGoal />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 64 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Quick start */}
        <View className="px-5" style={{ paddingTop: 32, paddingBottom: 32 }}>
          <TouchableOpacity
            onPress={() => setStartSheetOpen(true)}
            className="bg-crimson dark:bg-blue-500 py-4 rounded-2xl items-center"
            activeOpacity={0.85}
          >
            <Text className="font-montserrat-bold text-white text-base">Start</Text>
          </TouchableOpacity>
          {recentWorkouts.length > 0 && (
            <TouchableOpacity
              onPress={() => start(repeatLastWorkout)}
              className="mt-3 py-4 rounded-2xl items-center bg-surface dark:bg-zinc-900 border border-surface-3 dark:border-zinc-700"
              activeOpacity={0.85}
            >
              <Text className="font-montserrat-bold text-text-primary dark:text-white text-base">Repeat Last Workout</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Programs */}
        <View style={{ paddingHorizontal: 20, paddingBottom: 32 }}>
          <View className="flex-row items-center justify-between mb-3">
            <Text className="font-montserrat-bold text-text-primary dark:text-white text-xl">
              Programs
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/programs/new" as never)}
              className="bg-crimson dark:bg-blue-500 w-8 h-8 items-center justify-center rounded-full"
              activeOpacity={0.85}
            >
              <Plus size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {programs.length === 0 ? (
            <EmptyState message={"No programs yet.\nTap + to build a reusable template."} />
          ) : (
            <View style={{ gap: 8 }}>
              {programs.map((item) => (
                <View key={item.id} className="bg-surface dark:bg-zinc-900 rounded-2xl overflow-hidden">
                  <TouchableOpacity
                    onPress={() => router.push(`/programs/${item.id}` as never)}
                    activeOpacity={0.8}
                    className="flex-row items-center px-5 py-4"
                  >
                    <View className="flex-1">
                      <Text className="font-montserrat-bold text-text-primary dark:text-white text-base mb-0.5">
                        {item.name}
                      </Text>
                      <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs">
                        {item.dayCount} {item.dayCount === 1 ? "day" : "days"} · {item.exerciseCount} exercises
                        {item.difficulty ? ` · ${item.difficulty}` : ""}
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-3">
                      <TouchableOpacity onPress={() => setMenuProgram(item)} hitSlop={8} activeOpacity={0.7}>
                        <MoreHorizontal size={18} color="#94A3B8" />
                      </TouchableOpacity>
                      <ChevronRight size={16} color="#94A3B8" />
                    </View>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* History */}
        <View style={{ paddingHorizontal: 20, paddingBottom: 32 }}>
          <View className="flex-row items-center justify-between mb-3">
            <Text className="font-montserrat-bold text-text-primary dark:text-white text-xl">
              History
            </Text>
            <TouchableOpacity onPress={() => router.push("/history" as never)} hitSlop={8} activeOpacity={0.7}>
              <Text className="font-montserrat-semibold text-crimson dark:text-blue-400 text-sm">
                View All
              </Text>
            </TouchableOpacity>
          </View>
          {recentWorkouts.length === 0 ? (
            <View className="bg-surface dark:bg-zinc-900 px-5 py-6 rounded-2xl items-center">
              <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-sm text-center">
                No workouts yet.{"\n"}Start your first session above.
              </Text>
            </View>
          ) : (
            <View style={{ gap: 8 }}>
              {recentWorkouts.map((w) => (
                <TouchableOpacity
                  key={w.id}
                  onPress={() => router.push(`/workout/${w.id}` as never)}
                  className="bg-surface dark:bg-zinc-900 rounded-2xl px-5 py-4 flex-row items-center"
                  activeOpacity={0.8}
                >
                  <View className="flex-1">
                    <Text className="font-montserrat-bold text-text-primary dark:text-white text-base mb-0.5">
                      {w.name}
                    </Text>
                    <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs">
                      {formatShortDate(w.started_at)} · {w.type === "boxing" ? `${w.round_count} rounds` : `${w.exercise_count} exercises`}
                    </Text>
                  </View>
                  <View className="items-end mr-3">
                    <Text className="font-mono-medium text-text-primary dark:text-white text-sm">
                      {w.type === "boxing" ? (w.avg_rpe != null ? `RPE ${w.avg_rpe.toFixed(1)}` : "Boxing") : formatVolume(w.total_volume)}
                    </Text>
                    <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs">
                      {formatDuration(w.duration_seconds)}
                    </Text>
                  </View>
                  <ChevronRight size={16} color="#94A3B8" />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Goals zone */}
        <View style={{ paddingTop: 32 }}>
          <GoalsSection />
        </View>
      </ScrollView>

      <Modal visible={boxingResume !== null} transparent animationType="fade" onRequestClose={() => setBoxingResume(null)}>
        <View className="flex-1 bg-black/60 items-center justify-center px-6">
          <View className="bg-surface dark:bg-zinc-900 w-full p-6 rounded-2xl shadow-lg">
            <Text className="font-montserrat-bold text-text-primary dark:text-white text-2xl mb-1">Resume Boxing?</Text>
            {boxingResume && (
              <Text className="font-montserrat text-text-secondary dark:text-zinc-400 text-sm mb-6">
                Started at {new Date(boxingResume.timer.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} ·{" "}
                {boxingResume.timer.setup.rounds} x {formatTime(boxingResume.timer.setup.workSec)} / {formatTime(boxingResume.timer.setup.restSec)}
              </Text>
            )}
            <TouchableOpacity
              onPress={() => { setBoxingResume(null); router.push("/boxing/session" as never); }}
              className="bg-crimson dark:bg-blue-500 py-4 items-center mb-3 rounded-xl"
              activeOpacity={0.8}
            >
              <Text className="font-montserrat-bold text-white text-sm">Resume</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { clearSnapshot().catch(logError); setBoxingResume(null); }}
              className="bg-surface-2 dark:bg-zinc-800 py-4 items-center rounded-xl"
              activeOpacity={0.8}
            >
              <Text className="font-montserrat-semibold text-text-secondary dark:text-zinc-400 text-sm">Discard</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={readinessGo !== null} transparent animationType="slide" onRequestClose={finishReadiness}>
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-surface dark:bg-zinc-900 rounded-t-3xl px-5 pt-6 pb-10">
            <Text className="font-montserrat-bold text-text-primary dark:text-white text-xl mb-1">Quick check-in</Text>
            <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-sm mb-5">How are you today? Optional, takes a few seconds.</Text>
            <ReadinessForm onSaved={() => setReadinessSaved(true)} />
            <TouchableOpacity onPress={finishReadiness} className="py-3.5 items-center mt-3" activeOpacity={0.7}>
              <Text className="font-montserrat-semibold text-crimson dark:text-blue-400 text-base">{readinessSaved ? "Continue" : "Skip"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <StartSheet
        visible={startSheetOpen}
        onClose={() => setStartSheetOpen(false)}
        onLift={() => start(startWorkout)}
        onBox={() => start(() => withReadiness(() => router.push("/boxing/setup" as never)))}
        repeatLabel={lastBoxing ? `${lastBoxing.rounds} x ${formatTime(lastBoxing.workSec)} / ${formatTime(lastBoxing.restSec)}` : null}
        onRepeat={() => lastBoxing && start(() => withReadiness(async () => router.push(sessionHref({ ...lastBoxing, getReadySec: await getGetReadySec() }))))}
      />

      {/* Programs context menu */}
      <Modal
        visible={menuProgram !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setMenuProgram(null)}
      >
        <Pressable className="flex-1 bg-black/50 justify-end" onPress={() => setMenuProgram(null)}>
          <Pressable>
            <View className="bg-surface dark:bg-zinc-900 rounded-t-3xl pb-10">
              <View className="px-5 py-5 border-b border-surface-2 dark:border-zinc-800">
                <Text className="font-montserrat-bold text-text-primary dark:text-white text-base" numberOfLines={1}>
                  {menuProgram?.name}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => menuProgram && handleProgramClone(menuProgram)}
                className="flex-row items-center gap-3 px-5 py-4 border-b border-surface-2 dark:border-zinc-800"
                activeOpacity={0.7}
              >
                <Copy size={18} color="#64748B" />
                <Text className="font-montserrat-semibold text-text-primary dark:text-white text-base">Duplicate</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => menuProgram && handleProgramArchive(menuProgram)}
                className="flex-row items-center gap-3 px-5 py-4 border-b border-surface-2 dark:border-zinc-800"
                activeOpacity={0.7}
              >
                <Archive size={18} color="#64748B" />
                <View className="flex-1">
                  <Text className="font-montserrat-semibold text-text-primary dark:text-white text-base">Archive</Text>
                  <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-sm mt-0.5">
                    Hidden from list, restore in Settings
                  </Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => menuProgram && handleProgramDelete(menuProgram)}
                className="flex-row items-center gap-3 px-5 py-4"
                activeOpacity={0.7}
              >
                <Trash2 size={18} color="#EF4444" />
                <Text className="font-montserrat-semibold text-rose-500 text-base">Delete Permanently</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
