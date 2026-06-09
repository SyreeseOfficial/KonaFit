import React from "react";
import { View, Text, useWindowDimensions } from "react-native";
import Svg, { Path, Circle, Line, Text as SvgText } from "react-native-svg";
import type { TrendPoint } from "../../db/statsQueries";

const PAD_L = 48;
const PAD_R = 12;
const PAD_T = 14;
const PAD_B = 28;

type Props = {
  data: TrendPoint[];
  color?: string;
  height?: number;
  formatY?: (v: number) => string;
  emptyText?: string;
};

function fmtDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function LineChart({
  data,
  color = "#FF0000",
  height = 150,
  formatY = (v) => String(Math.round(v)),
  emptyText = "No data for this period",
}: Props) {
  const { width } = useWindowDimensions();
  const plotW = width - 32 - PAD_L - PAD_R;
  const plotH = height - PAD_T - PAD_B;

  if (data.length < 2) {
    return (
      <View style={{ height }} className="bg-surface items-center justify-center px-4">
        <Text className="font-montserrat text-text-muted text-xs text-center">{emptyText}</Text>
      </View>
    );
  }

  const minX = data[0].x;
  const maxX = data[data.length - 1].x;
  const rawMin = Math.min(...data.map((d) => d.y));
  const rawMax = Math.max(...data.map((d) => d.y));
  const range = rawMax - rawMin || 1;
  const minY = rawMin - range * 0.1;
  const maxY = rawMax + range * 0.1;

  const toX = (x: number) => maxX === minX ? plotW / 2 : ((x - minX) / (maxX - minX)) * plotW;
  const toY = (y: number) => plotH - ((y - minY) / (maxY - minY)) * plotH;

  const pathD = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${PAD_L + toX(d.x)} ${PAD_T + toY(d.y)}`)
    .join(" ");

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => minY + t * (maxY - minY));

  return (
    <View className="bg-surface">
      <Svg width={PAD_L + plotW + PAD_R} height={height}>
        {/* Grid + Y labels */}
        {yTicks.map((val, i) => {
          const y = PAD_T + toY(val);
          return (
            <React.Fragment key={i}>
              <Line x1={PAD_L} y1={y} x2={PAD_L + plotW} y2={y} stroke="#1C1C1C" strokeWidth={1} />
              <SvgText
                x={PAD_L - 5} y={y + 4}
                textAnchor="end" fill="#606060"
                fontSize={9} fontFamily="JetBrainsMono_400Regular"
              >
                {formatY(val)}
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* Area fill */}
        <Path
          d={`${pathD} L ${PAD_L + toX(data[data.length - 1].x)} ${PAD_T + plotH} L ${PAD_L + toX(data[0].x)} ${PAD_T + plotH} Z`}
          fill={`${color}18`}
        />

        {/* Line */}
        <Path
          d={pathD}
          stroke={color}
          strokeWidth={1.5}
          fill="none"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Dots — only show when few points */}
        {data.length <= 30 && data.map((d, i) => (
          <Circle
            key={i}
            cx={PAD_L + toX(d.x)} cy={PAD_T + toY(d.y)}
            r={2.5} fill={color}
          />
        ))}

        {/* X axis labels */}
        <SvgText x={PAD_L} y={height - 6} fill="#606060" fontSize={9} fontFamily="JetBrainsMono_400Regular">
          {fmtDate(data[0].x)}
        </SvgText>
        <SvgText x={PAD_L + plotW} y={height - 6} textAnchor="end" fill="#606060" fontSize={9} fontFamily="JetBrainsMono_400Regular">
          {fmtDate(data[data.length - 1].x)}
        </SvgText>
      </Svg>
    </View>
  );
}
