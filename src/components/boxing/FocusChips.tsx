import { View, Text, TextInput, TouchableOpacity } from "react-native";
import type { FocusChip } from "../../types/boxing";

type Props = {
  /** Visible chips only; hidden ones are filtered by the caller (getFocusChips default). */
  chips: FocusChip[];
  selected: number[];
  onToggle: (id: number) => void;
  note: string;
  onNoteChange: (text: string) => void;
  onManage?: () => void;
  /** Bigger targets for mid-workout use. */
  large?: boolean;
};

/** Chips grouped by their group (Punches, Movement, ...) plus an optional free-text note. Controlled. */
export function FocusChips({ chips, selected, onToggle, note, onNoteChange, onManage, large }: Props) {
  const groups = [...new Set(chips.map((c) => c.group))];
  return (
    <View style={{ gap: 10 }}>
      {groups.map((g) => (
        <View key={g}>
          <Text className="font-montserrat-semibold text-text-muted dark:text-zinc-500 text-xs tracking-widest uppercase mb-1.5">{g}</Text>
          <View className="flex-row flex-wrap" style={{ gap: large ? 8 : 6 }}>
            {chips.filter((c) => c.group === g).map((c) => {
              const on = selected.includes(c.id);
              return (
                <TouchableOpacity
                  key={c.id}
                  onPress={() => onToggle(c.id)}
                  className={`${large ? "px-4 min-h-12 justify-center rounded-xl" : "px-3 py-2 rounded-lg"} ${on ? "bg-crimson dark:bg-blue-500" : "bg-surface-2 dark:bg-zinc-800"}`}
                  activeOpacity={0.7}
                >
                  <Text className={`font-montserrat-semibold ${large ? "text-base" : "text-sm"} ${on ? "text-white" : "text-text-primary dark:text-white"}`}>{c.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ))}
      <TextInput
        className={`bg-surface-2 dark:bg-zinc-800 font-montserrat text-text-primary dark:text-white ${large ? "px-4 py-3.5 text-base rounded-xl" : "px-3 py-2.5 text-sm rounded-lg"}`}
        placeholder="Note (optional)"
        placeholderTextColor="#94A3B8"
        value={note}
        onChangeText={onNoteChange}
      />
      {onManage && (
        <TouchableOpacity onPress={onManage} hitSlop={8} className={large ? "min-h-12 justify-center" : ""} activeOpacity={0.7}>
          <Text className={`font-montserrat-semibold text-crimson dark:text-blue-400 ${large ? "text-base" : "text-sm"}`}>Manage chips</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
