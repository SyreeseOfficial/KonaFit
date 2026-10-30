import { View, Text, TextInput } from "react-native";
import type { DateFields } from "../../utils/dateEdit";

const box = "bg-surface-3 dark:bg-zinc-700 text-text-primary dark:text-white font-mono text-base text-center py-3 rounded-xl";

/** Month / day / year text fields. (No native date picker package is installed; see BOXING_BUILD_NOTES D3.) */
export function DateField({ value, onChange }: { value: DateFields; onChange: (v: DateFields) => void }) {
  const set = (k: keyof DateFields, max: number) => (v: string) => onChange({ ...value, [k]: v.replace(/\D/g, "").slice(0, max) });
  const sep = <Text className="font-mono text-text-muted dark:text-zinc-500 text-xl">/</Text>;
  return (
    <View className="flex-row items-center gap-2">
      <TextInput className={`${box} w-14`} value={value.month} onChangeText={set("month", 2)} keyboardType="number-pad" placeholder="MM" placeholderTextColor="#94A3B8" />
      {sep}
      <TextInput className={`${box} w-14`} value={value.day} onChangeText={set("day", 2)} keyboardType="number-pad" placeholder="DD" placeholderTextColor="#94A3B8" />
      {sep}
      <TextInput className={`${box} w-20`} value={value.year} onChangeText={set("year", 4)} keyboardType="number-pad" placeholder="YYYY" placeholderTextColor="#94A3B8" />
    </View>
  );
}
