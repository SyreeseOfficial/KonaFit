import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronLeft, ChevronDown, ChevronUp, Trash2 } from "lucide-react-native";
import { getBoxingSession, getFocusChips } from "../../db/boxingQueries";
import { deleteWorkout } from "../../db/workoutQueries";
import { sessionAvgRpe } from "../../utils/boxingRecap";
import { formatShortDate } from "../../utils/exportUtils";
import { formatTime } from "../../utils/time";
import type { BoxingSession, FocusChip } from "../../types/boxing";

const card = "mx-5 bg-surface dark:bg-zinc-900 rounded-2xl mb-4";

/** A finished boxing session: summary card plus a collapsed list of its rounds. */
export function BoxingDetail({ id }: { id: number }) {
  const [session, setSession] = useState<BoxingSession | null>(null);
  const [chips, setChips] = useState<FocusChip[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRounds, setShowRounds] = useState(false);

  const reload = useCallback(async () => {
    const [s, c] = await Promise.all([getBoxingSession(id), getFocusChips({ includeHidden: true })]);
    setSession(s);
    setChips(c);
  }, [id]);
  useEffect(() => { reload().catch(console.error).finally(() => setLoading(false)); }, [reload]);

  const handleDelete = () =>
    Alert.alert("Delete Session", "Permanently delete this boxing session? This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => { await deleteWorkout(id); router.back(); } },
    ]);

  if (loading || !session) {
    return (
      <SafeAreaView className="flex-1 bg-obsidian dark:bg-zinc-950 items-center justify-center">
        {loading ? <ActivityIndicator color="#2563EB" /> : <Text className="font-montserrat text-text-muted dark:text-zinc-500">Session not found</Text>}
      </SafeAreaView>
    );
  }

  const avg = sessionAvgRpe(session.rounds.map((r) => r.rpe), session.rpe);
  const stats = [
    { label: "Time", value: formatTime(session.durationSeconds) },
    { label: "Rounds", value: String(session.rounds.length) },
    { label: "Avg RPE", value: avg != null ? avg.toFixed(1) : "–" },
  ];
  const chipName = (cid: number) => chips.find((c) => c.id === cid)?.name;

  return (
    <SafeAreaView className="flex-1 bg-obsidian dark:bg-zinc-950">
      <View className="flex-row items-center gap-3 px-5 pt-5 pb-5 border-b border-surface-2 dark:border-zinc-800">
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} activeOpacity={0.7}>
          <ChevronLeft size={22} color="#94A3B8" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="font-montserrat-bold text-text-primary dark:text-white text-xl" numberOfLines={1}>{session.name}</Text>
          <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-sm">{formatShortDate(session.startedAt)}</Text>
        </View>
        <TouchableOpacity onPress={handleDelete} hitSlop={8} activeOpacity={0.7} accessibilityLabel="Delete session">
          <Trash2 size={18} color="#F43F5E" />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingTop: 16, paddingBottom: 40 }}>
        <View className={`${card} flex-row overflow-hidden`}>
          {stats.map((s, i) => (
            <View key={s.label} className={`flex-1 items-center py-5 ${i > 0 ? "border-l border-surface-2 dark:border-zinc-800" : ""}`}>
              <Text className="font-mono-medium text-text-primary dark:text-white text-lg mb-0.5">{s.value}</Text>
              <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-xs">{s.label}</Text>
            </View>
          ))}
        </View>

        {(session.rpe != null || session.tags.length > 0 || session.notes) && (
          <View className={`${card} p-5`} style={{ gap: 10 }}>
            {session.rpe != null && (
              <Text className="font-montserrat text-text-primary dark:text-white text-sm">Overall RPE <Text className="font-mono-medium">{session.rpe}</Text></Text>
            )}
            {session.tags.length > 0 && (
              <View className="flex-row flex-wrap" style={{ gap: 6 }}>
                {session.tags.map((t) => (
                  <View key={t} className="bg-surface-2 dark:bg-zinc-800 px-3 py-1.5 rounded-lg">
                    <Text className="font-montserrat-semibold text-text-primary dark:text-white text-xs">{t}</Text>
                  </View>
                ))}
              </View>
            )}
            {session.notes && <Text className="font-montserrat text-text-secondary dark:text-zinc-400 text-sm">{session.notes}</Text>}
          </View>
        )}

        <View className={card}>
          <TouchableOpacity onPress={() => setShowRounds((o) => !o)} className="flex-row items-center px-5 py-4" activeOpacity={0.7}>
            <Text className="font-montserrat-bold text-text-primary dark:text-white text-base flex-1">Rounds</Text>
            {showRounds ? <ChevronUp size={18} color="#94A3B8" /> : <ChevronDown size={18} color="#94A3B8" />}
          </TouchableOpacity>
          {showRounds && (
            <View className="px-5 pb-4" style={{ gap: 12 }}>
              {session.rounds.map((r) => (
                <View key={r.roundNumber} className="flex-row">
                  <Text className="font-mono-medium text-text-muted dark:text-zinc-500 text-sm w-8">{r.roundNumber}</Text>
                  <View className="flex-1">
                    <Text className="font-montserrat-semibold text-text-primary dark:text-white text-sm">
                      {r.rpe != null ? `RPE ${r.rpe}` : "No RPE"} · {formatTime(r.actualWorkSeconds ?? r.workSeconds)} work
                      {(r.actualRestSeconds ?? r.restSeconds) > 0 ? ` · ${formatTime(r.actualRestSeconds ?? r.restSeconds)} rest` : ""}
                    </Text>
                    {(r.focusTags.length > 0 || r.focusNote) && (
                      <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-sm mt-0.5">
                        {[...r.focusTags.map(chipName).filter(Boolean), r.focusNote].filter(Boolean).join(" · ")}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
