import { useState, useMemo } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { PERCENTAGES, REP_RANGES, roundWeight } from "../../utils/plateCalc";

type Rounding = 0 | 2.5 | 5;

type Props = {
  initialOneRM?: number;
  onSelectWeight?: (weight: number) => void;
};

export function PercentageCalculator({ initialOneRM, onSelectWeight }: Props) {
  const [oneRMInput, setOneRMInput] = useState(initialOneRM ? String(Math.round(initialOneRM)) : "");
  const [rounding, setRounding] = useState<Rounding>(2.5);

  const oneRM = parseFloat(oneRMInput);
  const isValid = !isNaN(oneRM) && oneRM > 0;

  const rows = useMemo(() => {
    if (!isValid) return [];
    return PERCENTAGES.map((pct) => {
      const exact = (oneRM * pct) / 100;
      const rounded = roundWeight(exact, rounding);
      return { pct, exact, rounded };
    });
  }, [oneRM, rounding, isValid]);

  const highlightRange = [70, 75, 80, 85];

  return (
    <View>
      {/* 1RM input */}
      <View className="flex-row items-center gap-3 mb-4">
        <TextInput
          className="flex-1 h-13 bg-surface-2 dark:bg-zinc-800 px-4 font-mono-medium text-text-primary dark:text-white text-xl text-center rounded-xl"
          placeholder="Your 1RM"
          placeholderTextColor="#94A3B8"
          value={oneRMInput}
          onChangeText={setOneRMInput}
          keyboardType="decimal-pad"
          selectTextOnFocus
        />
        <Text className="font-mono text-text-muted dark:text-zinc-500 text-sm">lbs</Text>
      </View>

      {/* Rounding toggle */}
      <View className="flex-row items-center gap-2 mb-5">
        <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs mr-1">Round:</Text>
        {([0, 2.5, 5] as Rounding[]).map((r) => (
          <TouchableOpacity
            key={r}
            onPress={() => setRounding(r)}
            className={`px-4 py-2 rounded-full ${rounding === r ? "bg-crimson dark:bg-blue-500" : "bg-surface-2 dark:bg-zinc-800"}`}
            activeOpacity={0.7}
          >
            <Text className={`font-mono text-xs ${rounding === r ? "text-white" : "text-text-muted dark:text-zinc-500"}`}>
              {r === 0 ? "Off" : `${r}`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Table */}
      {isValid ? (
        <View className="bg-surface dark:bg-zinc-900 rounded-2xl overflow-hidden">
          <View className="flex-row px-5 py-3 border-b border-surface-2 dark:border-zinc-800">
            <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs uppercase tracking-widest w-12">%</Text>
            <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs uppercase tracking-widest flex-1 text-right">Weight</Text>
            <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs uppercase tracking-widest w-20 text-right">Reps</Text>
          </View>

          {rows.map(({ pct, exact, rounded }) => {
            const isHighlight = highlightRange.includes(pct);
            const displayWeight = rounding === 0 ? exact.toFixed(1) : String(rounded);

            return (
              <TouchableOpacity
                key={pct}
                onPress={() => onSelectWeight?.(rounding === 0 ? exact : rounded)}
                className={`flex-row items-center px-5 py-3.5 border-b border-surface-2 dark:border-zinc-800 ${
                  isHighlight ? "bg-blue-50 dark:bg-blue-950/30" : ""
                }`}
                activeOpacity={onSelectWeight ? 0.7 : 1}
              >
                <Text
                  className={`font-mono-medium text-sm w-12 ${
                    isHighlight ? "text-crimson dark:text-blue-400" : "text-text-secondary dark:text-zinc-400"
                  }`}
                >
                  {pct}%
                </Text>
                <Text
                  className={`font-mono-medium text-sm flex-1 text-right ${
                    isHighlight ? "text-text-primary dark:text-white" : "text-text-secondary dark:text-zinc-400"
                  }`}
                >
                  {displayWeight} lbs
                </Text>
                <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs w-20 text-right">
                  {REP_RANGES[pct]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : (
        <View className="bg-surface dark:bg-zinc-900 p-6 items-center rounded-2xl">
          <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-sm text-center">
            Enter your 1RM to see intensity breakdown
          </Text>
        </View>
      )}

      {onSelectWeight && isValid && (
        <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs text-center mt-3">
          Tap a row to load that weight in the plate calculator
        </Text>
      )}
    </View>
  );
}
