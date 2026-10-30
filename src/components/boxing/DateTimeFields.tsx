import { View, Text, TextInput, TouchableOpacity } from "react-native";
import type { InfoEdits } from "../../utils/dateEdit";

const box = "bg-surface-2 dark:bg-zinc-800 text-text-primary dark:text-white font-mono text-base text-center py-3 rounded-xl";
const dim = "font-mono text-text-muted dark:text-zinc-500";

type Props = { value: InfoEdits; onChange: (v: InfoEdits) => void };

/** Month / day / year and hour : minute AM/PM text fields (same input model as the lift workout editor). */
export function DateTimeFields({ value, onChange }: Props) {
  const set = (patch: Partial<InfoEdits>) => onChange({ ...value, ...patch });
  const field = (k: "month" | "day" | "year" | "hour" | "minute", w: string, ph: string, max: number) => (
    <TextInput className={`${box} ${w}`} value={value[k]} onChangeText={(v) => set({ [k]: v.replace(/\D/g, "") })} keyboardType="number-pad" maxLength={max} placeholder={ph} placeholderTextColor="#94A3B8" />
  );
  return (
    <View style={{ gap: 12 }}>
      <View className="flex-row items-center gap-2">
        {field("month", "w-14", "MM", 2)}<Text className={`${dim} text-xl`}>/</Text>
        {field("day", "w-14", "DD", 2)}<Text className={`${dim} text-xl`}>/</Text>
        {field("year", "w-20", "YYYY", 4)}
      </View>
      <View className="flex-row items-center gap-2">
        {field("hour", "w-14", "H", 2)}<Text className={`${dim} text-xl`}>:</Text>
        {field("minute", "w-14", "MM", 2)}
        <View className="flex-row gap-1.5 ml-1">
          {(["AM", "PM"] as const).map((v) => (
            <TouchableOpacity key={v} onPress={() => set({ ampm: v })} className={`px-4 py-3 rounded-xl ${value.ampm === v ? "bg-crimson dark:bg-blue-500" : "bg-surface-2 dark:bg-zinc-800"}`} activeOpacity={0.7}>
              <Text className={`font-mono text-sm ${value.ampm === v ? "text-white" : "text-text-muted dark:text-zinc-500"}`}>{v}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}
