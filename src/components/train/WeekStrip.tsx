import { View, Text } from "react-native";
import { weekStartSecs } from "../../db/statsQueries";
import { localDateKey } from "../../utils/time";
import { BOXING_DOT } from "../../utils/theme";

const LABELS = ["M", "T", "W", "T", "F", "S", "S"];

/** Monday to Sunday of this week; a blue dot for a lifting day, an orange one for boxing, both when both. */
export function WeekStrip({ days }: { days: Record<string, { lift: boolean; boxing: boolean }> }) {
  const start = new Date(weekStartSecs() * 1000);
  const today = localDateKey(new Date());
  return (
    <View className="mx-5 mb-4 flex-row justify-between">
      {LABELS.map((label, i) => {
        const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i); // calendar-day step, DST safe
        const key = localDateKey(d);
        const a = days[key];
        return (
          <View key={key} className="items-center" style={{ width: 32 }}>
            <Text className={`font-mono text-xs ${key === today ? "text-crimson dark:text-blue-400" : "text-text-muted dark:text-zinc-500"}`}>{label}</Text>
            <View className="flex-row mt-1.5" style={{ height: 8, gap: 3 }}>
              {a?.lift && <View className="bg-crimson dark:bg-blue-500" style={{ width: 8, height: 8, borderRadius: 4 }} />}
              {a?.boxing && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: BOXING_DOT }} />}
            </View>
          </View>
        );
      })}
    </View>
  );
}
