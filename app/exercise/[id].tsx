import { useState, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { ChevronLeft, Trophy } from "lucide-react-native";
import { getExerciseNotes, type ExerciseNote } from "../../src/db/workoutQueries";
import { getExercisePRs, getExerciseSets, type ExercisePRs, type PRSet, type ExerciseSetRow } from "../../src/db/historyQueries";
import { getOneRMHistory } from "../../src/db/statsQueries";
import { LineChart } from "../../src/components/stats/LineChart";
import type { TrendPoint } from "../../src/db/statsQueries";

const formatDate = (ms: number) =>
  new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const label = "font-mono text-text-muted dark:text-zinc-500 text-xs uppercase tracking-widest";

function PRColumn({ title, set }: { title: string; set: PRSet }) {
  const hasData = set.weightLbs != null && set.reps != null;
  return (
    <View className="flex-1 bg-surface dark:bg-zinc-900 px-2 py-5 items-center rounded-2xl">
      <Text className="font-mono text-text-muted dark:text-zinc-500 text-[10px] uppercase tracking-widest mb-3">{title}</Text>
      {hasData ? (
        <>
          <Text className="font-mono-medium text-text-primary dark:text-white text-lg leading-none">{set.weightLbs} lbs</Text>
          <Text className="font-mono text-text-secondary dark:text-zinc-400 text-sm mt-1.5">× {set.reps} reps</Text>
          {set.achievedAt != null && (
            <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs mt-3 text-center">{formatDate(set.achievedAt)}</Text>
          )}
        </>
      ) : (
        <Text className="font-mono text-text-muted dark:text-zinc-500 text-base">—</Text>
      )}
    </View>
  );
}

/** Everything about one exercise: PRs, est. 1RM over time, recent sets and your notes. */
export default function ExerciseScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const exerciseId = Number(id);
  const [prs, setPRs] = useState<ExercisePRs | null>(null);
  const [sets, setSets] = useState<ExerciseSetRow[]>([]);
  const [notes, setNotes] = useState<ExerciseNote[]>([]);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [shown, setShown] = useState(10);

  useEffect(() => {
    Promise.all([getExercisePRs(exerciseId), getExerciseSets(exerciseId, 30), getExerciseNotes(exerciseId), getOneRMHistory(exerciseId)])
      .then(([p, s, n, h]) => { setPRs(p); setSets(s); setNotes(n); setTrend(h.map((d) => ({ x: d.date, y: d.oneRM }))); });
  }, [exerciseId]);

  const empty = prs && !prs.maxWeight.weightLbs && !prs.maxReps.reps && !prs.maxVolume.weightLbs;

  return (
    <SafeAreaView className="flex-1 bg-obsidian dark:bg-zinc-950">
      <View className="flex-row items-center gap-3 px-5 pt-5 pb-4">
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} activeOpacity={0.7} accessibilityLabel="Back">
          <ChevronLeft size={22} color="#94A3B8" />
        </TouchableOpacity>
        <Text className="flex-1 font-montserrat-bold text-text-primary dark:text-white text-2xl" numberOfLines={1}>{name ?? "Exercise"}</Text>
      </View>

      {prs === null ? (
        <ActivityIndicator color="#2563EB" style={{ marginTop: 32 }} />
      ) : empty ? (
        <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-sm text-center px-5 mt-8">
          No completed sets yet.{"\n"}Finish a workout with this exercise to see your history.
        </Text>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 56, gap: 12 }}>
          <View className="flex-row items-center gap-1.5">
            <Trophy size={12} color="#2563EB" />
            <Text className="font-mono text-crimson dark:text-blue-400 text-xs uppercase tracking-widest">Personal Records</Text>
          </View>
          <View className="flex-row gap-3">
            <PRColumn title="Max Weight" set={prs.maxWeight} />
            <PRColumn title="Max Reps" set={prs.maxReps} />
            <PRColumn title="Max Volume" set={prs.maxVolume} />
          </View>

          <Text className={`${label} mt-4`}>Est. 1RM</Text>
          <View className="bg-surface dark:bg-zinc-900 rounded-2xl py-3 -mx-1">
            <LineChart data={trend} formatY={(v) => `${Math.round(v)}`} emptyText="Log this lift in 2+ workouts to see a trend" />
          </View>

          {sets.length > 0 && (
            <>
              <View className="flex-row items-center justify-between mt-4">
                <Text className={label}>Recent Sets</Text>
                {sets.length > 10 && (
                  <View className="flex-row gap-2">
                    {[10, 20, 30].map((n) => (
                      <TouchableOpacity
                        key={n}
                        onPress={() => setShown(n)}
                        activeOpacity={0.7}
                        className={`px-4 h-8 items-center justify-center rounded-full ${shown === n ? "bg-crimson dark:bg-blue-500" : "bg-surface-2 dark:bg-zinc-800"}`}
                      >
                        <Text className={`font-montserrat-semibold text-xs ${shown === n ? "text-white" : "text-text-primary dark:text-white"}`}>{n}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
              <View className="bg-surface dark:bg-zinc-900 rounded-2xl overflow-hidden">
                {sets.slice(0, shown).map((s, i, arr) => (
                  <View key={i} className={`flex-row items-center justify-between px-4 py-3.5 ${i < arr.length - 1 ? "border-b border-surface-2 dark:border-zinc-800" : ""}`}>
                    <Text className="font-montserrat text-text-secondary dark:text-zinc-400 text-sm">{formatDate(s.achievedAt)}</Text>
                    <Text className="font-mono-medium text-text-primary dark:text-white text-sm">{s.weightLbs ?? 0} lbs × {s.reps ?? 0}</Text>
                  </View>
                ))}
              </View>
              <TouchableOpacity
                onPress={() => router.push({ pathname: "/history", params: { exercise: name ?? "" } } as never)}
                className="h-12 items-center justify-center rounded-2xl bg-surface-2 dark:bg-zinc-800"
                activeOpacity={0.7}
              >
                <Text className="font-montserrat-semibold text-text-primary dark:text-white text-sm">Show every session in History</Text>
              </TouchableOpacity>
            </>
          )}

          {notes.length > 0 && (
            <>
              <Text className={`${label} mt-4`}>Notes</Text>
              <View className="bg-surface dark:bg-zinc-900 rounded-2xl overflow-hidden">
                {notes.map((n, i) => (
                  <View key={i} className={`px-4 py-3.5 ${i < notes.length - 1 ? "border-b border-surface-2 dark:border-zinc-800" : ""}`}>
                    <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs mb-1">{formatDate(n.at)}</Text>
                    <Text className="font-montserrat text-text-primary dark:text-white text-sm">{n.text}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
