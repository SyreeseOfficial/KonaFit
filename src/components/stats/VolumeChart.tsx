import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, useWindowDimensions } from "react-native";
import Svg, { Rect, Text as SvgText } from "react-native-svg";
import { getVolumeByMuscle, type VolumeByMuscle } from "../../db/statsQueries";

const BAR_H = 20;
const BAR_GAP = 10;
const LABEL_W = 80;
const VALUE_W = 52;
const PAD_V = 12;

type Props = { refreshKey: number };

function formatVol(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(Math.round(v));
}

export function VolumeChart({ refreshKey }: Props) {
  const { width } = useWindowDimensions();
  const [period, setPeriod] = useState<7 | 30>(7);
  const [data, setData] = useState<VolumeByMuscle[]>([]);

  useEffect(() => {
    getVolumeByMuscle(period).then(setData);
  }, [period, refreshKey]);

  const barAreaW = width - 32 - LABEL_W - VALUE_W - 8; // 32 = screen padding
  const maxVol = data.length > 0 ? Math.max(...data.map((d) => d.volumeLbs)) : 1;
  const svgH = data.length > 0 ? data.length * (BAR_H + BAR_GAP) - BAR_GAP + PAD_V * 2 : 80;

  return (
    <View>
      {/* Period toggle */}
      <View className="flex-row mb-3 self-start">
        {([7, 30] as const).map((p) => (
          <TouchableOpacity
            key={p}
            onPress={() => setPeriod(p)}
            className={`px-3 py-1 mr-1 ${
              period === p ? "bg-crimson" : "bg-surface-2"
            }`}
            activeOpacity={0.7}
          >
            <Text
              className={`font-mono text-xs tracking-wider ${
                period === p ? "text-white" : "text-text-muted"
              }`}
            >
              {p}D
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View className="bg-surface">
        {data.length === 0 ? (
          <View className="h-20 items-center justify-center">
            <Text className="font-montserrat text-text-muted text-xs">
              No data for this period
            </Text>
          </View>
        ) : (
          <Svg width={LABEL_W + barAreaW + VALUE_W + 8} height={svgH}>
            {data.map((item, i) => {
              const barW = Math.max(2, (item.volumeLbs / maxVol) * barAreaW);
              const y = PAD_V + i * (BAR_H + BAR_GAP);
              const midY = y + BAR_H / 2 + 4;

              return (
                <React.Fragment key={item.muscleGroup}>
                  {/* Label */}
                  <SvgText
                    x={LABEL_W - 8}
                    y={midY}
                    textAnchor="end"
                    fill="#A0A0A0"
                    fontSize={10}
                    fontFamily="JetBrainsMono_400Regular"
                  >
                    {item.muscleGroup.toUpperCase()}
                  </SvgText>

                  {/* Track */}
                  <Rect
                    x={LABEL_W}
                    y={y}
                    width={barAreaW}
                    height={BAR_H}
                    fill="#1C1C1C"
                  />

                  {/* Bar */}
                  <Rect
                    x={LABEL_W}
                    y={y}
                    width={barW}
                    height={BAR_H}
                    fill="#FF0000"
                    opacity={0.85}
                  />

                  {/* Value */}
                  <SvgText
                    x={LABEL_W + barAreaW + 6}
                    y={midY}
                    fill="#606060"
                    fontSize={9}
                    fontFamily="JetBrainsMono_400Regular"
                  >
                    {formatVol(item.volumeLbs)}
                  </SvgText>
                </React.Fragment>
              );
            })}
          </Svg>
        )}
      </View>
    </View>
  );
}

import React from "react";
