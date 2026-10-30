import { useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { CheckCircle } from "lucide-react-native";
import { getBoxingSession, getFocusChips, getPriorAvgRpes } from "../../src/db/boxingQueries";
import { buildRecap, type Recap } from "../../src/utils/boxingRecap";
import { formatTime } from "../../src/utils/time";
import { formatShortDate } from "../../src/utils/exportUtils";
import type { BoxingSession, FocusChip } from "../../src/types/boxing";

const card = "mx-5 bg-surface dark:bg-zinc-900 rounded-2xl mb-4";
const heading = "font-montserrat-semibold text-text-muted dark:text-zinc-500 text-xs tracking-widest uppercase mb-3";

/** One bar per round, height = RPE out of 10. Rounds without an RPE show a dash. */
function RpeBars({ points }: { points: Recap["rpePoints"] }) {
  const H = 96;
  return (
    <View className="flex-row items-end" style={{ gap: 6, height: H + 36 }}>
      {points.map((p) => (
        <View key={p.round} className="flex-1 items-center justify-end">
          <Text className="font-mono-medium text-text-primary dark:text-white text-xs mb-1">{p.rpe ?? "–"}</Text>
          <View
            className={p.rpe ? "w-full bg-crimson dark:bg-blue-500 rounded-t-md" : "w-full bg-surface-3 dark:bg-zinc-700 rounded-t-md"}
            style={{ height: p.rpe ? (p.rpe / 10) * H : 4 }}
          />
          <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs mt-1">{p.round}</Text>
        </View>
      ))}
    </View>
  );
}

export default function BoxingCompleteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [data, setData] = useState<{ session: BoxingSession; recap: Recap; chips: FocusChip[] } | null>(null);

  useEffect(() => {
    (async () => {
      const session = await getBoxingSession(parseInt(id ?? "0", 10));
      if (!session) return router.back();
      const [chips, prior] = await Promise.all([getFocusChips({ includeHidden: true }), getPriorAvgRpes(session.startedAt, session.id!)]);
      setData({ session, recap: buildRecap(session, prior), chips });
    })().catch(console.error);
  }, [id]);

  if (!data) {
    return (
      <SafeAreaView className="flex-1 bg-obsidian dark:bg-zinc-950 items-center justify-center">
        <ActivityIndicator color="#2563EB" />
      </SafeAreaView>
    );
  }
  const { session, recap, chips } = data;
  const name = (cid: number) => chips.find((c) => c.id === cid)?.name;
  const withFocus = session.rounds.filter((r) => r.focusTags.length > 0 || r.focusNote);
  const total = recap.workSec + recap.restSec;
  const stats = [
    { label: "Rounds", value: String(recap.rounds) },
    { label: "Time", value: formatTime(recap.durationSec) },
    { label: "Avg RPE", value: recap.avgRpe != null ? recap.avgRpe.toFixed(1) : "–" },
  ];

  return (
    <SafeAreaView className="flex-1 bg-obsidian dark:bg-zinc-950">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View className="items-center px-6 pt-12 pb-8">
          <View className="w-20 h-20 bg-crimson dark:bg-blue-500 rounded-full items-center justify-center mb-6">
            <CheckCircle size={40} color="#FFFFFF" strokeWidth={2} />
          </View>
          <Text className="font-montserrat-bold text-text-primary dark:text-white text-3xl text-center mb-1">{session.name}</Text>
          <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-base text-center">{formatShortDate(session.startedAt)}</Text>
        </View>

        <View className={`${card} flex-row overflow-hidden`}>
          {stats.map((s, i) => (
            <View key={s.label} className={`flex-1 items-center py-5 ${i > 0 ? "border-l border-surface-2 dark:border-zinc-800" : ""}`}>
              <Text className="font-mono-medium text-text-primary dark:text-white text-lg mb-0.5">{s.value}</Text>
              <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-xs">{s.label}</Text>
            </View>
          ))}
        </View>

        {recap.comparison && (
          <View className={`${card} px-5 py-4`}>
            <Text className="font-montserrat-semibold text-text-primary dark:text-white text-base">
              {recap.comparison.verdict === "about the same"
                ? "About your usual effort"
                : recap.comparison.verdict === "harder" ? "Harder than your usual session" : "Easier than your usual session"}
            </Text>
            <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs mt-1">
              {recap.comparison.avgRpe.toFixed(1)} vs {recap.comparison.usualRpe.toFixed(1)} average RPE
            </Text>
          </View>
        )}

        {recap.rpePoints.some((p) => p.rpe != null) && (
          <View className={`${card} p-5`}>
            <Text className={heading}>RPE by round</Text>
            <RpeBars points={recap.rpePoints} />
          </View>
        )}

        {total > 0 && (
          <View className={`${card} p-5`}>
            <Text className={heading}>Work vs rest</Text>
            <View className="flex-row h-3 rounded-full overflow-hidden bg-surface-2 dark:bg-zinc-800">
              <View className="bg-crimson dark:bg-blue-500" style={{ flex: recap.workSec }} />
              <View style={{ flex: recap.restSec }} />
            </View>
            <View className="flex-row justify-between mt-2">
              <Text className="font-mono text-text-secondary dark:text-zinc-400 text-xs">Work {formatTime(recap.workSec)}</Text>
              <Text className="font-mono text-text-secondary dark:text-zinc-400 text-xs">Rest {formatTime(recap.restSec)}</Text>
            </View>
          </View>
        )}

        {withFocus.length > 0 && (
          <View className={`${card} p-5`}>
            <Text className={heading}>Focus</Text>
            <View style={{ gap: 10 }}>
              {withFocus.map((r) => (
                <View key={r.roundNumber} className="flex-row">
                  <Text className="font-mono-medium text-text-muted dark:text-zinc-500 text-sm w-8">{r.roundNumber}</Text>
                  <Text className="font-montserrat text-text-primary dark:text-white text-sm flex-1">
                    {[...r.focusTags.map(name).filter(Boolean), r.focusNote].filter(Boolean).join(" · ")}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View className="mx-5" style={{ gap: 10 }}>
          <TouchableOpacity onPress={() => router.dismissAll()} className="bg-crimson dark:bg-blue-500 py-4 rounded-2xl items-center" activeOpacity={0.85}>
            <Text className="font-montserrat-bold text-white text-base">Done</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
