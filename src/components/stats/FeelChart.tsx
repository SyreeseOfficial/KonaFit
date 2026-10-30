import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { LineChart } from "./LineChart";
import { getFeelTrend, type FeelField, type TrendPoint } from "../../db/statsQueries";

const FIELDS: { key: FeelField; label: string }[] = [
  { key: "rating", label: "Rating" },
  { key: "energy", label: "Energy" },
  { key: "sleep_hours", label: "Sleep" },
];

/** Rating, energy and sleep entered on the finish sheet, last 90 days. */
export function FeelChart({ refreshKey }: { refreshKey?: number }) {
  const [field, setField] = useState<FeelField>("rating");
  const [data, setData] = useState<TrendPoint[]>([]);

  useEffect(() => {
    getFeelTrend(field).then(setData).catch(console.error);
  }, [field, refreshKey]);

  return (
    <View>
      <View className="flex-row gap-2 mb-3">
        {FIELDS.map((f) => (
          <TouchableOpacity
            key={f.key}
            onPress={() => setField(f.key)}
            activeOpacity={0.7}
            className={`px-4 h-8 items-center justify-center rounded-full ${field === f.key ? "bg-crimson dark:bg-blue-500" : "bg-surface-2 dark:bg-zinc-800"}`}
          >
            <Text className={`font-montserrat-semibold text-xs ${field === f.key ? "text-white" : "text-text-primary dark:text-white"}`}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <LineChart
        data={data}
        formatY={(v) => (field === "sleep_hours" ? v.toFixed(1) : String(Math.round(v)))}
        emptyText="Rate a workout on the finish sheet to see it here"
      />
    </View>
  );
}
