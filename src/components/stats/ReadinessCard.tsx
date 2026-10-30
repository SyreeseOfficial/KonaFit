import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { LineChart } from "./LineChart";
import {
  getTodayReadiness, saveReadiness, getReadinessTrend, getReadinessVsRating, type Readiness,
} from "../../db/insightQueries";
import type { TrendPoint } from "../../db/statsQueries";

const FIELDS: { key: keyof Readiness; label: string; low: string; high: string }[] = [
  { key: "sleep", label: "Sleep", low: "poor", high: "great" },
  { key: "soreness", label: "Soreness", low: "none", high: "very" },
  { key: "mood", label: "Mood", low: "low", high: "high" },
];

/** Daily 1-5 check-in (sleep, soreness, mood) with a trend and how workouts rated on high- vs low-readiness days. */
export function ReadinessCard({ refreshKey }: { refreshKey?: number }) {
  const [value, setValue] = useState<Partial<Readiness>>({});
  const [saved, setSaved] = useState(false);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [split, setSplit] = useState<{ high: number | null; low: number | null }>({ high: null, low: null });

  const load = () => {
    getReadinessTrend().then(setTrend).catch(console.error);
    getReadinessVsRating().then(setSplit).catch(console.error);
  };
  useEffect(() => {
    getTodayReadiness().then((r) => { if (r) { setValue(r); setSaved(true); } }).catch(console.error);
  }, []);
  useEffect(load, [refreshKey]);

  const complete = value.sleep != null && value.soreness != null && value.mood != null;
  const save = async () => {
    if (!complete) return;
    await saveReadiness(value as Readiness);
    setSaved(true);
    load();
  };

  return (
    <View className="bg-surface dark:bg-zinc-900 rounded-2xl p-4">
      {FIELDS.map((f) => (
        <View key={f.key} className="mb-3">
          <Text className="font-montserrat-semibold text-text-primary dark:text-white text-sm mb-1.5">
            {f.label} <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs">1 = {f.low} · 5 = {f.high}</Text>
          </Text>
          <View className="flex-row gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <TouchableOpacity
                key={n}
                onPress={() => { setValue((v) => ({ ...v, [f.key]: n })); setSaved(false); }}
                activeOpacity={0.7}
                className={`flex-1 h-11 items-center justify-center rounded-xl ${value[f.key] === n ? "bg-crimson dark:bg-blue-500" : "bg-surface-2 dark:bg-zinc-800"}`}
              >
                <Text className={`font-mono-medium text-sm ${value[f.key] === n ? "text-white" : "text-text-primary dark:text-white"}`}>{n}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}
      <TouchableOpacity
        onPress={save}
        disabled={!complete || saved}
        className={`h-11 items-center justify-center rounded-xl ${complete && !saved ? "bg-crimson dark:bg-blue-500" : "bg-surface-2 dark:bg-zinc-800"}`}
        activeOpacity={0.85}
      >
        <Text className={`font-montserrat-bold text-sm ${complete && !saved ? "text-white" : "text-text-muted dark:text-zinc-500"}`}>
          {saved ? "Saved for today" : "Save check-in"}
        </Text>
      </TouchableOpacity>
      <View className="mt-4">
        <LineChart data={trend} formatY={(v) => v.toFixed(1)} emptyText="Check in on two days to see a trend" />
      </View>
      {split.high != null && split.low != null && (
        <Text className="font-montserrat text-text-secondary dark:text-zinc-400 text-sm mt-3">
          Workouts felt {split.high.toFixed(1)}/5 on high-readiness days vs {split.low.toFixed(1)}/5 on the rest.
        </Text>
      )}
    </View>
  );
}
