import { useState, useMemo } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView } from "react-native";
import { PERCENTAGES, REP_RANGES, roundWeight } from "../../utils/plateCalc";

type Rounding = 0 | 2.5 | 5;

type Props = {
  initialOneRM?: number;
  onSelectWeight?: (weight: number) => void;
};

export function PercentageCalculator({ initialOneRM, onSelectWeight }: Props) {
  const [oneRMInput, setOneRMInput] = useState(
    initialOneRM ? String(Math.round(initialOneRM)) : ""
  );
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
      <View className="flex-row items-center gap-2 mb-4">
        <TextInput
          className="flex-1 h-12 bg-surface-2 px-4 font-mono-medium text-white text-xl text-center"
          placeholder="Your 1RM"
          placeholderTextColor="#606060"
          value={oneRMInput}
          onChangeText={setOneRMInput}
          keyboardType="decimal-pad"
          selectTextOnFocus
        />
        <Text className="font-mono text-text-muted text-sm">lbs</Text>
      </View>

      {/* Rounding toggle */}
      <View className="flex-row items-center gap-1 mb-5">
        <Text className="font-mono text-text-muted text-xs tracking-wider mr-2">
          ROUND:
        </Text>
        {([0, 2.5, 5] as Rounding[]).map((r) => (
          <TouchableOpacity
            key={r}
            onPress={() => setRounding(r)}
            className={`px-3 py-1.5 ${rounding === r ? "bg-crimson" : "bg-surface-2"}`}
            activeOpacity={0.7}
          >
            <Text className={`font-mono text-xs ${rounding === r ? "text-white" : "text-text-muted"}`}>
              {r === 0 ? "Off" : `${r}`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Table */}
      {isValid ? (
        <View className="bg-surface">
          {/* Header */}
          <View className="flex-row px-4 py-2 border-b border-surface-3">
            <Text className="font-mono text-text-muted text-xs tracking-widest w-12">%</Text>
            <Text className="font-mono text-text-muted text-xs tracking-widest flex-1 text-right">
              WEIGHT
            </Text>
            <Text className="font-mono text-text-muted text-xs tracking-widest w-20 text-right">
              REPS
            </Text>
          </View>

          {rows.map(({ pct, exact, rounded }) => {
            const isHighlight = highlightRange.includes(pct);
            const displayWeight = rounding === 0 ? exact.toFixed(1) : String(rounded);

            return (
              <TouchableOpacity
                key={pct}
                onPress={() => onSelectWeight?.(rounding === 0 ? exact : rounded)}
                className={`flex-row items-center px-4 py-3 border-b border-surface-2 ${
                  isHighlight ? "bg-surface-2" : ""
                }`}
                activeOpacity={onSelectWeight ? 0.7 : 1}
              >
                <Text
                  className={`font-mono-medium text-sm w-12 ${
                    isHighlight ? "text-crimson" : "text-text-secondary"
                  }`}
                >
                  {pct}%
                </Text>
                <Text
                  className={`font-mono-medium text-sm flex-1 text-right ${
                    isHighlight ? "text-white" : "text-text-secondary"
                  }`}
                >
                  {displayWeight} lbs
                </Text>
                <Text className="font-mono text-text-muted text-xs w-20 text-right">
                  {REP_RANGES[pct]}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : (
        <View className="bg-surface p-6 items-center">
          <Text className="font-montserrat text-text-muted text-sm text-center">
            Enter your 1RM to see intensity breakdown
          </Text>
        </View>
      )}

      {onSelectWeight && isValid && (
        <Text className="font-mono text-text-muted text-xs text-center mt-3">
          Tap a row to load that weight in the plate calculator
        </Text>
      )}
    </View>
  );
}
