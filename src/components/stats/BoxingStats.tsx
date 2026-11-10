import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { LineChart } from "./LineChart";
import { SectionHeader } from "./SectionHeader";
import { getBoxingBuckets, hasBoxingSessions, roundsTrend, minutesTrend, rpeTrend, type BoxingBucket, type BoxingPeriod } from "../../db/boxingStats";
import { logError } from "../../utils/errors";

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <View className="bg-surface dark:bg-zinc-900 rounded-2xl p-4 mb-4">
    <Text className="font-montserrat-bold text-text-primary dark:text-white text-base mb-3">{title}</Text>
    {children}
  </View>
);

/** Rounds, time and average RPE over time. Renders nothing until the first boxing session exists. */
export function BoxingStats({ refreshKey }: { refreshKey?: number }) {
  const [show, setShow] = useState(false);
  const [period, setPeriod] = useState<BoxingPeriod>("week");
  const [buckets, setBuckets] = useState<BoxingBucket[]>([]);

  useEffect(() => {
    (async () => {
      const has = await hasBoxingSessions();
      setShow(has);
      setBuckets(has ? await getBoxingBuckets(period, 12) : []);
    })().catch(logError);
  }, [period, refreshKey]);

  if (!show) return null;
  const unit = period === "week" ? "week" : "month";
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 56 }}>
      <SectionHeader title="Boxing" subtitle="Rounds, time, effort" />
      <View className="flex-row mb-4" style={{ gap: 8 }}>
        {(["week", "month"] as const).map((p) => (
          <TouchableOpacity key={p} onPress={() => setPeriod(p)} activeOpacity={0.7}
            className={`px-4 h-8 items-center justify-center rounded-full ${period === p ? "bg-crimson dark:bg-blue-500" : "bg-surface-2 dark:bg-zinc-800"}`}>
            <Text className={`font-montserrat-semibold text-xs ${period === p ? "text-white" : "text-text-primary dark:text-white"}`}>{p === "week" ? "Weekly" : "Monthly"}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Card title={`Rounds per ${unit}`}>
        <LineChart data={roundsTrend(buckets)} formatY={(v) => String(Math.round(v))} emptyText={`Two ${unit}s of boxing will draw this chart`} />
      </Card>
      <Card title={`Minutes per ${unit}`}>
        <LineChart data={minutesTrend(buckets)} formatY={(v) => String(Math.round(v))} emptyText={`Two ${unit}s of boxing will draw this chart`} />
      </Card>
      <Card title="Average RPE">
        <LineChart data={rpeTrend(buckets)} formatY={(v) => v.toFixed(1)} emptyText="Log RPE on a few rounds to see a trend" />
      </Card>
    </View>
  );
}
