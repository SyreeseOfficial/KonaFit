import { Fragment } from "react";
import { View, Text, TextInput } from "react-native";
import type { DateFields } from "../../utils/dateEdit";

const box = "bg-surface-3 dark:bg-zinc-700 text-text-primary dark:text-white font-mono text-base text-center py-3 rounded-xl";

/** Month / day / year text fields. (No native date picker package is installed.) */
export function DateField({ value, onChange }: { value: DateFields; onChange: (v: DateFields) => void }) {
  const set = (k: keyof DateFields, max: number) => (v: string) => onChange({ ...value, [k]: v.replace(/\D/g, "").slice(0, max) });
  const fields = [["month", "MM", 2, "w-14"], ["day", "DD", 2, "w-14"], ["year", "YYYY", 4, "w-20"]] as const;
  return (
    <View className="flex-row items-center gap-2">
      {fields.map(([k, ph, max, w], i) => (
        <Fragment key={k}>
          {i > 0 && <Text className="font-mono text-text-muted dark:text-zinc-500 text-xl">/</Text>}
          <TextInput className={`${box} ${w}`} value={value[k]} onChangeText={set(k, max)} keyboardType="number-pad" placeholder={ph} placeholderTextColor="#94A3B8" />
        </Fragment>
      ))}
    </View>
  );
}
