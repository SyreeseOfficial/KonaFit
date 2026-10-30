import { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { getHardSetsLastWeek, getLastTrainedByGroup } from "../../db/insightQueries";
import { LANDMARKS, landmarkStatus, muscleBalance, setsByMuscle, type LandmarkStatus } from "../../utils/training";

const STATUS_COLOR: Record<LandmarkStatus, string> = { low: "#94A3B8", ok: "#2563EB", high: "#10B981", over: "#EF4444" };
const STATUS_TEXT: Record<LandmarkStatus, string> = { low: "below MEV", ok: "building", high: "productive", over: "above MRV" };

/** Hard sets per muscle over the last 7 days against MEV / MAV / MRV, push-pull balance, and hours since each muscle was trained. */
export function MuscleWeek({ refreshKey }: { refreshKey?: number }) {
  const [sets, setSets] = useState<Record<string, number>>({});
  const [recovery, setRecovery] = useState<{ muscle: string; hours: number }[]>([]);

  useEffect(() => {
    (async () => {
      const [week, last] = await Promise.all([getHardSetsLastWeek(), getLastTrainedByGroup()]);
      setSets(setsByMuscle(week));
      const latest: Record<string, number> = {};
      for (const r of last) for (const m of r.muscle_group.split(",").map((x) => x.trim()).filter(Boolean)) latest[m] = Math.max(latest[m] ?? 0, r.last);
      const nowSecs = Date.now() / 1000;
      setRecovery(Object.entries(latest).map(([muscle, t]) => ({ muscle, hours: Math.round((nowSecs - t) / 3600) })).sort((a, b) => a.hours - b.hours));
    })().catch(console.error);
  }, [refreshKey]);

  const rows = Object.keys(LANDMARKS).filter((m) => (sets[m] ?? 0) > 0).sort((a, b) => sets[b] - sets[a]);
  const balance = muscleBalance(sets);
  const mono = "font-mono text-text-muted dark:text-zinc-500 text-xs";

  if (rows.length === 0 && recovery.length === 0) {
    return <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-sm">Finish a workout to see your week.</Text>;
  }

  return (
    <View className="gap-5">
      <View className="bg-surface dark:bg-zinc-900 rounded-2xl p-4">
        <Text className="font-montserrat-bold text-text-primary dark:text-white text-base mb-1">Hard sets, last 7 days</Text>
        <Text className={`${mono} mb-3`}>MEV = fewest to grow · MRV = most you can recover from</Text>
        {rows.map((m) => {
          const l = LANDMARKS[m];
          const n = sets[m];
          const st = landmarkStatus(m, n)!;
          return (
            <View key={m} className="mb-3">
              <View className="flex-row justify-between mb-1">
                <Text className="font-montserrat-semibold text-text-primary dark:text-white text-sm">{m}</Text>
                <Text className={mono}>{n} sets · {STATUS_TEXT[st]}</Text>
              </View>
              <View className="h-2 rounded-full bg-surface-2 dark:bg-zinc-800 overflow-hidden">
                <View style={{ width: `${Math.min(100, (n / l.mrv) * 100)}%`, backgroundColor: STATUS_COLOR[st] }} className="h-2 rounded-full" />
              </View>
              <Text className={`${mono} mt-0.5`}>target {l.mev}–{l.mrv}</Text>
            </View>
          );
        })}
        {balance.map((b) => (
          <Text key={b} className="font-montserrat text-amber-600 dark:text-amber-400 text-sm mt-1">{b}</Text>
        ))}
      </View>

      <View className="bg-surface dark:bg-zinc-900 rounded-2xl p-4">
        <Text className="font-montserrat-bold text-text-primary dark:text-white text-base mb-3">Recovery</Text>
        {recovery.map((r) => (
          <View key={r.muscle} className="flex-row items-center justify-between py-1.5">
            <Text className="font-montserrat text-text-primary dark:text-white text-sm">{r.muscle}</Text>
            <Text className={mono} style={{ color: r.hours < 48 ? "#F59E0B" : r.hours < 96 ? "#10B981" : undefined }}>
              {r.hours < 48 ? `${r.hours} h ago` : `${Math.round(r.hours / 24)} days ago`}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
