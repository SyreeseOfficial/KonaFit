import { useState, useEffect, useCallback } from "react";
import {
  View, Text, TouchableOpacity, Modal, Pressable,
  TextInput, FlatList,
} from "react-native";
import { Pencil, X, Check, Search } from "lucide-react-native";
import { LineChart } from "./LineChart";
import { kvStore } from "../../utils/kvStore";
import {
  getAllExercisesForAnalytics,
  getExerciseBrzyckiHistory,
  getExerciseRPE1RMHistory,
  getExerciseVolumeForAnalytics,
  type AnalyticsExercise,
  type TrendPoint,
} from "../../db/statsQueries";

const STORAGE_KEY = "@konafit_analytics_exercises";
const MAX_SELECTED = 5;

type Metric = "brzycki" | "rpe" | "volume";
type Period = "7d" | "30d" | "90d" | "1y" | "all";
type Granularity = "daily" | "weekly" | "monthly";

const METRICS: { key: Metric; label: string }[] = [
  { key: "brzycki", label: "Brzycki 1RM" },
  { key: "rpe",     label: "RPE 1RM" },
  { key: "volume",  label: "Volume" },
];

const PERIODS: { key: Period; label: string; days: number | null }[] = [
  { key: "7d",  label: "7D",  days: 7 },
  { key: "30d", label: "30D", days: 30 },
  { key: "90d", label: "90D", days: 90 },
  { key: "1y",  label: "1Y",  days: 365 },
  { key: "all", label: "All", days: null },
];

const GRANS: { key: Granularity; label: string }[] = [
  { key: "daily",   label: "Daily" },
  { key: "weekly",  label: "Weekly" },
  { key: "monthly", label: "Monthly" },
];

const CHART_COLORS = ["#2563EB", "#8B5CF6", "#10B981", "#F59E0B", "#EF4444"];

function bucketKey(ts: number, g: Granularity): number {
  const d = new Date(ts);
  if (g === "daily") return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  if (g === "weekly") {
    const day = d.getDay();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() - day + (day === 0 ? -6 : 1)).getTime();
  }
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

function aggregateData(raw: TrendPoint[], g: Granularity, mode: "max" | "sum"): TrendPoint[] {
  const buckets = new Map<number, number[]>();
  for (const p of raw) {
    const k = bucketKey(p.x, g);
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k)!.push(p.y);
  }
  return Array.from(buckets.entries())
    .sort(([a], [b]) => a - b)
    .map(([k, vals]) => ({
      x: k,
      y: mode === "max" ? Math.max(...vals) : vals.reduce((s, v) => s + v, 0),
    }));
}

type PickerProps = {
  visible: boolean;
  all: AnalyticsExercise[];
  selected: number[];
  onDone: (ids: number[]) => void;
};

function ExercisePicker({ visible, all, selected, onDone }: PickerProps) {
  const [draft, setDraft] = useState<number[]>(selected);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (visible) { setDraft(selected); setQuery(""); }
  }, [visible, selected]);

  const filtered = query.trim()
    ? all.filter((e) => e.name.toLowerCase().includes(query.toLowerCase()))
    : all;

  const toggle = (id: number) => {
    setDraft((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : prev.length < MAX_SELECTED ? [...prev, id] : prev
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => onDone(selected)}>
      <Pressable className="flex-1 bg-black/60 justify-end" onPress={() => onDone(selected)}>
        <Pressable>
          <View className="bg-surface dark:bg-zinc-900 rounded-t-3xl" style={{ maxHeight: "85%" }}>
            <View className="flex-row items-center justify-between px-5 py-5 border-b border-surface-2 dark:border-zinc-800">
              <View>
                <Text className="font-montserrat-bold text-text-primary dark:text-white text-xl">
                  Edit Exercises
                </Text>
                <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs mt-0.5">
                  {draft.length}/{MAX_SELECTED} selected
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => onDone(draft)}
                className="bg-crimson dark:bg-blue-500 px-5 py-2.5 rounded-xl"
                activeOpacity={0.85}
              >
                <Text className="font-montserrat-bold text-white text-sm">Done</Text>
              </TouchableOpacity>
            </View>

            <View className="flex-row items-center gap-2 px-5 py-3 border-b border-surface-2 dark:border-zinc-800">
              <Search size={14} color="#94A3B8" />
              <TextInput
                className="flex-1 font-montserrat text-text-primary dark:text-white text-sm h-9"
                placeholder="Search exercises..."
                placeholderTextColor="#94A3B8"
                value={query}
                onChangeText={setQuery}
                autoCorrect={false}
              />
              {query !== "" && (
                <TouchableOpacity onPress={() => setQuery("")} hitSlop={8}>
                  <X size={14} color="#94A3B8" />
                </TouchableOpacity>
              )}
            </View>

            <FlatList
              data={filtered}
              keyExtractor={(e) => String(e.id)}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item: ex }) => {
                const isSelected = draft.includes(ex.id);
                const atMax = !isSelected && draft.length >= MAX_SELECTED;
                return (
                  <TouchableOpacity
                    onPress={() => !atMax && toggle(ex.id)}
                    className={`flex-row items-center px-5 py-4 border-b border-surface-2 dark:border-zinc-800 ${isSelected ? "bg-blue-50 dark:bg-blue-950/30" : ""} ${atMax ? "opacity-40" : ""}`}
                    activeOpacity={0.7}
                  >
                    <View
                      className={`w-5 h-5 mr-3 items-center justify-center border rounded ${isSelected ? "bg-crimson dark:bg-blue-500 border-crimson dark:border-blue-500" : "border-surface-3 dark:border-zinc-700"}`}
                    >
                      {isSelected && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
                    </View>
                    <View className="flex-1">
                      <Text className={`font-montserrat-semibold text-base ${isSelected ? "text-crimson dark:text-blue-400" : "text-text-primary dark:text-white"}`}>
                        {ex.name}
                      </Text>
                      <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs">{ex.muscle_group}</Text>
                    </View>
                    {ex.use_count > 0 && (
                      <View className="bg-surface-2 dark:bg-zinc-800 px-2 py-0.5 rounded-full ml-2">
                        <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs">{ex.use_count}×</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

type Props = { refreshKey?: number };

export function ExerciseAnalytics({ refreshKey }: Props) {
  const [metric, setMetric]     = useState<Metric>("brzycki");
  const [period, setPeriod]     = useState<Period>("30d");
  const [gran, setGran]         = useState<Granularity>("weekly");
  const [granOpen, setGranOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [allExercises, setAllExercises] = useState<AnalyticsExercise[]>([]);
  const [selectedIds, setSelectedIds]   = useState<number[]>([]);
  const [chartData, setChartData]       = useState<Record<number, TrendPoint[]>>({});
  const [loadedOnce, setLoadedOnce]     = useState(false);

  const days = PERIODS.find((p) => p.key === period)!.days;

  useEffect(() => {
    (async () => {
      const all = await getAllExercisesForAnalytics();
      setAllExercises(all);
      const stored = await kvStore.getItem(STORAGE_KEY);
      if (stored) {
        const ids: number[] = JSON.parse(stored);
        const valid = ids.filter((id) => all.some((e) => e.id === id));
        setSelectedIds(valid.length > 0 ? valid : all.slice(0, 3).map((e) => e.id));
      } else {
        setSelectedIds(all.slice(0, 3).map((e) => e.id));
      }
      setLoadedOnce(true);
    })();
  }, []);

  useEffect(() => {
    if (!loadedOnce || selectedIds.length === 0) return;
    const fetchFn =
      metric === "brzycki" ? getExerciseBrzyckiHistory
      : metric === "rpe"   ? getExerciseRPE1RMHistory
      :                      getExerciseVolumeForAnalytics;
    (async () => {
      const entries = await Promise.all(
        selectedIds.map(async (id) => [id, await fetchFn(id, days)] as [number, TrendPoint[]])
      );
      setChartData(Object.fromEntries(entries));
    })();
  }, [metric, days, selectedIds, loadedOnce, refreshKey]);

  const handlePickerDone = useCallback(async (ids: number[]) => {
    setPickerOpen(false);
    const valid = ids.length > 0 ? ids : allExercises.slice(0, 3).map((e) => e.id);
    setSelectedIds(valid);
    await kvStore.setItem(STORAGE_KEY, JSON.stringify(valid));
  }, [allExercises]);

  const granLabel = GRANS.find((g) => g.key === gran)!.label;
  const aggregateMode = metric === "volume" ? "sum" : "max";
  const formatY = metric === "volume"
    ? (v: number) => v >= 1000 ? `${(v / 1000).toFixed(1)}K` : String(Math.round(v))
    : (v: number) => `${Math.round(v)}`;
  const emptyText = metric === "rpe"
    ? "No RPE data for this period — log RPE values during your workout"
    : "No data for this period";

  const selectedExercises = selectedIds
    .map((id) => allExercises.find((e) => e.id === id))
    .filter(Boolean) as AnalyticsExercise[];

  return (
    <View className="bg-surface dark:bg-zinc-900 rounded-2xl overflow-hidden">
      {/* Metric tabs */}
      <View className="flex-row border-b border-surface-2 dark:border-zinc-800">
        {METRICS.map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            onPress={() => setMetric(key)}
            className={`flex-1 py-3 items-center border-b-2 ${metric === key ? "border-crimson dark:border-blue-500" : "border-transparent"}`}
            activeOpacity={0.7}
          >
            <Text className={`font-mono text-xs tracking-widest ${metric === key ? "text-crimson dark:text-blue-400" : "text-text-muted dark:text-zinc-500"}`}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          onPress={() => setPickerOpen(true)}
          className="px-3 py-3 border-l border-surface-2 dark:border-zinc-800 flex-row items-center gap-1"
          activeOpacity={0.7}
        >
          <Pencil size={13} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      {/* Period + granularity */}
      <View className="flex-row items-center border-b border-surface-2 dark:border-zinc-800">
        {PERIODS.map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            onPress={() => setPeriod(key)}
            className={`flex-1 py-2.5 items-center border-b-2 ${period === key ? "border-crimson dark:border-blue-500" : "border-transparent"}`}
            activeOpacity={0.7}
          >
            <Text className={`font-mono text-xs tracking-widest ${period === key ? "text-crimson dark:text-blue-400" : "text-text-muted dark:text-zinc-500"}`}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          onPress={() => setGranOpen((o) => !o)}
          className="px-3 py-2.5 border-l border-surface-2 dark:border-zinc-800 flex-row items-center gap-1"
          activeOpacity={0.7}
        >
          <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs">{granLabel}</Text>
          <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs">{granOpen ? "▲" : "▼"}</Text>
        </TouchableOpacity>
      </View>

      {granOpen && (
        <View className="border-b border-surface-2 dark:border-zinc-800">
          {GRANS.map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              onPress={() => { setGran(key); setGranOpen(false); }}
              className={`px-5 py-4 border-b border-surface-2 dark:border-zinc-800 flex-row items-center justify-between ${gran === key ? "bg-blue-50 dark:bg-blue-950/30" : ""}`}
              activeOpacity={0.7}
            >
              <Text className={`font-montserrat-semibold text-base ${gran === key ? "text-crimson dark:text-blue-400" : "text-text-secondary dark:text-zinc-400"}`}>
                {label}
              </Text>
              {gran === key && <Check size={14} color="#2563EB" />}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {selectedIds.length === 0 ? (
        <View className="p-8 items-center">
          <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-sm text-center">
            Tap the pencil icon to choose exercises
          </Text>
        </View>
      ) : (
        <View className="p-5 gap-5">
          {selectedExercises.map((ex, idx) => {
            const raw = chartData[ex.id] ?? [];
            const agg = aggregateData(raw, gran, aggregateMode);
            const color = CHART_COLORS[idx % CHART_COLORS.length];
            return (
              <View key={ex.id}>
                <View className="flex-row items-baseline justify-between mb-1">
                  <Text className="font-montserrat-bold text-text-primary dark:text-white text-sm" numberOfLines={1}>
                    {ex.name}
                  </Text>
                  <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs">{ex.muscle_group}</Text>
                </View>
                <LineChart data={agg} color={color} height={140} formatY={formatY} emptyText={emptyText} />
              </View>
            );
          })}
        </View>
      )}

      <ExercisePicker visible={pickerOpen} all={allExercises} selected={selectedIds} onDone={handlePickerDone} />
    </View>
  );
}
