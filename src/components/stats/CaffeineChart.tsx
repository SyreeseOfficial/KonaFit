import { useState, useEffect, useCallback } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { LineChart } from "./LineChart";
import { getCaffeineTrend, type TrendPoint } from "../../db/statsQueries";

type Period = "7d" | "30d" | "90d" | "1y" | "all";
const PERIODS: { key: Period; label: string; days: number | null }[] = [
  { key: "7d",  label: "7D",  days: 7 },
  { key: "30d", label: "30D", days: 30 },
  { key: "90d", label: "90D", days: 90 },
  { key: "1y",  label: "1Y",  days: 365 },
  { key: "all", label: "All", days: null },
];

type Props = { refreshKey?: number };

export function CaffeineChart({ refreshKey }: Props) {
  const [period, setPeriod] = useState<Period>("30d");
  const [data, setData] = useState<TrendPoint[]>([]);

  const days = PERIODS.find((p) => p.key === period)!.days;

  const load = useCallback(async () => {
    setData(await getCaffeineTrend(days));
  }, [days]);

  useEffect(() => { load(); }, [load, refreshKey]);

  return (
    <View className="bg-surface">
      {/* Period filter */}
      <View className="flex-row border-b border-surface-2">
        {PERIODS.map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            onPress={() => setPeriod(key)}
            className={`flex-1 py-2 items-center border-b-2 ${period === key ? "border-crimson" : "border-transparent"}`}
            activeOpacity={0.7}
          >
            <Text className={`font-mono text-xs tracking-widest ${period === key ? "text-white" : "text-text-muted"}`}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View className="px-0 pt-0">
        <LineChart
          data={data}
          color="#FF9800"
          height={140}
          formatY={(v) => `${Math.round(v)}`}
          emptyText="Log pre-workout caffeine to see trend"
        />
      </View>

      {data.length > 0 && (
        <Text className="font-mono text-text-muted text-xs text-center pb-3">
          mg caffeine per entry
        </Text>
      )}
    </View>
  );
}
