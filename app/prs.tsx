import { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { getTrackedExercises } from "../src/db/statsQueries";
import { getExercisePRs, type ExercisePRs, type PRSet } from "../src/db/historyQueries";
import { estimateOneRm } from "../src/utils/oneRm";

type Exercise = { id: number; name: string };

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function PRCard({ label, value, set }: { label: string; value: string; set: PRSet }) {
  return (
    <View className="bg-surface dark:bg-zinc-900 p-5 rounded-2xl">
      <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs uppercase tracking-widest mb-2">
        {label}
      </Text>
      <Text className="font-mono-medium text-text-primary dark:text-white text-2xl">{value}</Text>
      <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs mt-1">
        {set.weightLbs} lbs × {set.reps} · {formatDate(set.achievedAt!)}
      </Text>
    </View>
  );
}

const PLATEAU_WEEKS = 4;
const WEEK_MS = 7 * 86400_000;

/** Weeks since the last est. 1RM PR, if the lift is still being trained but hasn't improved. */
function plateauWeeks(prs: ExercisePRs): number | null {
  const pr = prs.maxOneRM.achievedAt;
  if (pr == null || prs.lastTrainedAt == null) return null;
  const now = Date.now();
  if (prs.lastTrainedAt < now - PLATEAU_WEEKS * WEEK_MS) return null; // dropped the lift, not a plateau
  const weeks = Math.floor((now - pr) / WEEK_MS);
  return weeks >= PLATEAU_WEEKS ? weeks : null;
}

export default function PRsScreen() {
  const [exercises, setExercises] = useState<Exercise[] | null>(null);
  const [selected, setSelected] = useState<Exercise | null>(null);
  const [prs, setPRs] = useState<ExercisePRs | null>(null);

  useEffect(() => {
    getTrackedExercises(1000).then((list) => {
      setExercises(list);
      setSelected(list[0] ?? null);
    });
  }, []);

  useEffect(() => {
    if (!selected) return;
    setPRs(null);
    getExercisePRs(selected.id).then(setPRs);
  }, [selected]);

  const volume = prs?.maxVolume;
  const oneRM = prs?.maxOneRM;

  return (
    <SafeAreaView className="flex-1 bg-obsidian dark:bg-zinc-950">
      <View className="flex-row items-center gap-3 px-5 pt-5 pb-4">
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} activeOpacity={0.7}>
          <ChevronLeft size={22} color="#94A3B8" />
        </TouchableOpacity>
        <Text className="font-montserrat-bold text-text-primary dark:text-white text-2xl">
          Personal Records
        </Text>
      </View>

      {exercises === null ? (
        <ActivityIndicator color="#2563EB" style={{ marginTop: 32 }} />
      ) : exercises.length === 0 ? (
        <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-sm text-center px-5 mt-8">
          Finish a workout to see your PRs.
        </Text>
      ) : (
        <>
          <View style={{ height: 52 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
              {exercises.map((e) => {
                const active = e.id === selected?.id;
                return (
                  <TouchableOpacity
                    key={e.id}
                    onPress={() => setSelected(e)}
                    className={`px-4 h-11 items-center justify-center rounded-full ${active ? "bg-crimson dark:bg-blue-500" : "bg-surface-2 dark:bg-zinc-800"}`}
                    activeOpacity={0.7}
                  >
                    <Text className={`font-montserrat-semibold text-sm ${active ? "text-white" : "text-text-primary dark:text-white"}`}>
                      {e.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
            {prs === null ? (
              <ActivityIndicator color="#2563EB" />
            ) : !prs.maxWeight.weightLbs || !oneRM?.weightLbs ? (
              <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-sm text-center mt-6">
                No completed sets for this exercise yet.
              </Text>
            ) : (
              <>
                {plateauWeeks(prs) != null && (
                  <View className="bg-amber-500/15 p-4 rounded-2xl">
                    <Text className="font-montserrat-semibold text-amber-600 dark:text-amber-400 text-sm">
                      Plateau: no est. 1RM PR in {plateauWeeks(prs)} weeks
                    </Text>
                    <Text className="font-montserrat text-text-secondary dark:text-zinc-400 text-xs mt-1">
                      Try a deload week, a new rep range, or more rest between sets.
                    </Text>
                  </View>
                )}
                <PRCard label="Best Weight" value={`${prs.maxWeight.weightLbs} lbs`} set={prs.maxWeight} />
                <PRCard label="Best Reps" value={`${prs.maxReps.reps} reps`} set={prs.maxReps} />
                <PRCard label="Best Est. 1RM" value={`${Math.round(estimateOneRm(oneRM!.weightLbs!, oneRM!.reps!))} lbs`} set={oneRM!} />
                <PRCard label="Best Volume (one set)" value={`${volume!.weightLbs! * volume!.reps!} lbs`} set={volume!} />
                <TouchableOpacity
                  onPress={() => router.push({ pathname: "/exercise/[id]", params: { id: String(selected!.id), name: selected!.name } } as never)}
                  className="h-12 items-center justify-center rounded-2xl bg-surface-2 dark:bg-zinc-800"
                  activeOpacity={0.7}
                >
                  <Text className="font-montserrat-semibold text-text-primary dark:text-white text-sm">Open {selected!.name}</Text>
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}
