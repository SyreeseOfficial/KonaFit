import { View, Text, TouchableOpacity } from "react-native";

type Props = {
  value: number | null;
  onChange: (v: number | null) => void;
  /** Bigger targets for mid-workout use. */
  large?: boolean;
};

/** Tap 1-10; tapping the chosen number again clears it. */
export function RpeRow({ value, onChange, large }: Props) {
  return (
    <View className="flex-row" style={{ gap: 4 }}>
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
        const on = value === n;
        return (
          <TouchableOpacity
            key={n}
            onPress={() => onChange(on ? null : n)}
            accessibilityLabel={`RPE ${n}`}
            className={`flex-1 ${large ? "h-14" : "h-11"} items-center justify-center rounded-lg ${on ? "bg-crimson dark:bg-blue-500" : "bg-surface-2 dark:bg-zinc-800"}`}
            activeOpacity={0.7}
          >
            <Text className={`font-mono-medium ${large ? "text-lg" : "text-sm"} ${on ? "text-white" : "text-text-primary dark:text-white"}`}>{n}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
