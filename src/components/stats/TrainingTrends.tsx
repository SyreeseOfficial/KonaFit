import { useState, useEffect, useCallback } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { LineChart } from "./LineChart";
import {
  getVolumeTrend,
  getFrequencyTrend,
  getBodyweightTrend,
  type TrendPoint,
} from "../../db/statsQueries";

type Granularity = "daily" | "weekly" | "monthly";

function bucketKey(ts: number, g: Granularity): number {
  const d = new Date(ts);
  if (g === "daily") return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  if (g === "weekly") {
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.getFullYear(), d.getMonth(), diff).getTime();
  }
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

function aggregate(raw: TrendPoint[], g: Granularity, mode: "sum" | "avg"): TrendPoint[] {
  const buckets = new Map<number, number[]>();
  for (const p of raw) {
    const k = bucketKey(p.x, g);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(p.y);
  }
  return Array.from(buckets.entries()).sort(([a], [b]) => a - b).map(([k, vals]) => ({
    x: k,
    y: mode === "sum" ? vals.reduce((s, v) => s + v, 0) : vals.reduce((s, v) => s + v, 0) / vals.length,
  }));
}

type Period = "7d" | "30d" | "90d" | "1y" | "all";
const PERIODS: { key: Period; label: string; days: number | null }[] = [
  { key: "7d",  label: "7D",  days: 7 },
  { key: "30d", label: "30D", days: 30 },
  { key: "90d", label: "90D", days: 90 },
  { key: "1y",  label: "1Y",  days: 365 },
  { key: "all", label: "All", days: null },
];

const GRANULARITIES: { key: Granularity; label: string }[] = [
  { key: "daily",   label: "Daily" },
  { key: "weekly",  label: "Weekly" },
  { key: "monthly", label: "Monthly" },
];

function formatVolume(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return String(Math.round(v));
}

function ChartLabel({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View className="flex-row items-baseline justify-between mb-1">
      <Text className="font-montserrat-bold text-text-primary dark:text-white text-sm">{title}</Text>
      <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs">{subtitle}</Text>
    </View>
  );
}

type Props = { refreshKey?: number };

export function TrainingTrends({ refreshKey }: Props) {
  const [period, setPeriod] = useState<Period>("30d");
  const [gran, setGran] = useState<Granularity>("weekly");
  const [granOpen, setGranOpen] = useState(false);
  const [rawVolume, setRawVolume] = useState<TrendPoint[]>([]);
  const [rawFreq, setRawFreq] = useState<TrendPoint[]>([]);
  const [rawWeight, setRawWeight] = useState<TrendPoint[]>([]);

  const days = PERIODS.find((p) => p.key === period)!.days;

  const load = useCallback(async () => {
    const [vol, freq, bw] = await Promise.all([getVolumeTrend(days), getFrequencyTrend(days), getBodyweightTrend(days)]);
    setRawVolume(vol); setRawFreq(freq); setRawWeight(bw);
  }, [days]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const volumeData = aggregate(rawVolume, gran, "sum");
  const freqData   = aggregate(rawFreq, gran, "sum");
  const weightData = aggregate(rawWeight, gran, "avg");
  const granLabel  = GRANULARITIES.find((g) => g.key === gran)!.label;

  return (
    <View className="bg-surface dark:bg-zinc-900 mx-5 rounded-2xl overflow-hidden">
      {/* Period + granularity controls */}
      <View className="flex-row items-center border-b border-surface-2 dark:border-zinc-800">
        {PERIODS.map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            onPress={() => setPeriod(key)}
            className={`flex-1 py-3 items-center border-b-2 ${period === key ? "border-crimson dark:border-blue-500" : "border-transparent"}`}
            activeOpacity={0.7}
          >
            <Text className={`font-mono text-xs tracking-widest ${period === key ? "text-crimson dark:text-blue-400" : "text-text-muted dark:text-zinc-500"}`}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          onPress={() => setGranOpen((o) => !o)}
          className="px-3 py-3 border-l border-surface-2 dark:border-zinc-800 flex-row items-center gap-1"
          activeOpacity={0.7}
        >
          <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs">{granLabel}</Text>
          <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs">{granOpen ? "▲" : "▼"}</Text>
        </TouchableOpacity>
      </View>

      {granOpen && (
        <View className="border-b border-surface-2 dark:border-zinc-800">
          {GRANULARITIES.map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              onPress={() => { setGran(key); setGranOpen(false); }}
              className={`px-5 py-4 border-b border-surface-2 dark:border-zinc-800 flex-row items-center justify-between ${gran === key ? "bg-blue-50 dark:bg-blue-950/30" : ""}`}
              activeOpacity={0.7}
            >
              <Text className={`font-montserrat-semibold text-base ${gran === key ? "text-crimson dark:text-blue-400" : "text-text-secondary dark:text-zinc-400"}`}>
                {label}
              </Text>
              {gran === key && <Text className="font-mono text-crimson dark:text-blue-400 text-xs">✓</Text>}
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View className="p-5 gap-5">
        <View>
          <ChartLabel
            title="Volume"
            subtitle={gran === "daily" ? "lbs per workout" : `lbs per ${gran.replace("ly", "")}`}
          />
          <LineChart data={volumeData} color="#2563EB" height={140} formatY={formatVolume} emptyText="Log workouts to see volume trend" />
        </View>
        <View>
          <ChartLabel title="Frequency" subtitle={`workouts per ${gran.replace("ly","").replace("dai","day")}`} />
          <LineChart data={freqData} color="#8B5CF6" height={120} formatY={(v) => String(Math.round(v))} emptyText="Log workouts to see frequency trend" />
        </View>
        <View>
          <ChartLabel title="Bodyweight" subtitle="lbs" />
          <LineChart data={weightData} color="#10B981" height={130} formatY={(v) => v.toFixed(1)} emptyText="Log bodyweight to see trend" />
        </View>
      </View>
    </View>
  );
}
