import React, { useId } from "react";
import { View, Text, useWindowDimensions, useColorScheme } from "react-native";
import Svg, { Path, Circle, Line, Defs, LinearGradient, Stop, Text as SvgText } from "react-native-svg";
import type { TrendPoint } from "../../db/statsQueries";

const PAD_L = 44;
const PAD_R = 12;
const PAD_T = 14;
const PAD_B = 28;

type Props = {
  data: TrendPoint[];
  color?: string;
  height?: number;
  formatY?: (v: number) => string;
  emptyText?: string;
  goal?: number; // dashed horizontal target line
  overlay?: TrendPoint[]; // second, thinner series (e.g. a moving average) over the same x range
};

type Pt = [number, number];

/** Smooth path through the points (monotone cubic, so the curve never overshoots a data point). */
function smoothPath(pts: Pt[]): string {
  const n = pts.length;
  const dx = pts.slice(1).map((p, i) => p[0] - pts[i][0]);
  const m = pts.slice(1).map((p, i) => (dx[i] === 0 ? 0 : (p[1] - pts[i][1]) / dx[i]));
  const t = [m[0], ...pts.slice(1, -1).map((_, i) => (m[i] * m[i + 1] <= 0 ? 0 : (m[i] + m[i + 1]) / 2)), m[n - 2]];
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i] / m[i], b = t[i + 1] / m[i], h = Math.hypot(a, b);
    if (h > 3) { t[i] = (3 * a * m[i]) / h; t[i + 1] = (3 * b * m[i]) / h; }
  }
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const k = dx[i] / 3;
    d += ` C ${pts[i][0] + k} ${pts[i][1] + t[i] * k} ${pts[i + 1][0] - k} ${pts[i + 1][1] - t[i + 1] * k} ${pts[i + 1][0]} ${pts[i + 1][1]}`;
  }
  return d;
}

function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function LineChart({
  data,
  color = "#2563EB",
  height = 150,
  formatY = (v) => String(Math.round(v)),
  emptyText = "No data for this period",
  goal,
  overlay,
}: Props) {
  const { width } = useWindowDimensions();
  const dark = useColorScheme() === "dark";
  const gradId = useId();
  const gridColor = dark ? "#27272A" : "#EEF2F6";
  const labelColor = dark ? "#71717A" : "#94A3B8";
  const plotW = width - 40 - PAD_L - PAD_R;
  const plotH = height - PAD_T - PAD_B;

  if (data.length < 2) {
    return (
      <View style={{ height }} className="items-center justify-center px-4">
        <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-xs text-center">{emptyText}</Text>
      </View>
    );
  }

  const minX = data[0].x;
  const maxX = data[data.length - 1].x;
  const ys = [...data.map((d) => d.y), ...(goal != null ? [goal] : [])];
  const rawMin = Math.min(...ys);
  const rawMax = Math.max(...ys);
  const range = rawMax - rawMin || 1;
  const minY = rawMin - range * 0.1;
  const maxY = rawMax + range * 0.1;

  const toX = (x: number) => maxX === minX ? plotW / 2 : ((x - minX) / (maxX - minX)) * plotW;
  const toY = (y: number) => plotH - ((y - minY) / (maxY - minY)) * plotH;

  const toPt = (d: TrendPoint): Pt => [PAD_L + toX(d.x), PAD_T + toY(d.y)];
  const pathD = smoothPath(data.map(toPt));
  const last = toPt(data[data.length - 1]);
  const yTicks = [0, 1 / 3, 2 / 3, 1].map((t) => minY + t * (maxY - minY));

  return (
    <Svg width={PAD_L + plotW + PAD_R} height={height}>
      <Defs>
        <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={0.28} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      {yTicks.map((val, i) => {
        const y = PAD_T + toY(val);
        return (
          <React.Fragment key={i}>
            <Line x1={PAD_L} y1={y} x2={PAD_L + plotW} y2={y} stroke={gridColor} strokeWidth={1} strokeDasharray="2 4" />
            <SvgText x={PAD_L - 5} y={y + 4} textAnchor="end" fill={labelColor} fontSize={9} fontFamily="JetBrainsMono_400Regular">
              {formatY(val)}
            </SvgText>
          </React.Fragment>
        );
      })}

      <Path
        d={`${pathD} L ${last[0]} ${PAD_T + plotH} L ${PAD_L + toX(data[0].x)} ${PAD_T + plotH} Z`}
        fill={`url(#${gradId})`}
      />
      <Path d={pathD} stroke={color} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />

      {overlay && overlay.length > 1 && (
        <Path
          d={smoothPath(overlay.map(toPt))}
          stroke="#F59E0B" strokeWidth={1.5} strokeOpacity={0.9} fill="none" strokeLinejoin="round" strokeLinecap="round"
        />
      )}
      {goal != null && (
        <>
          <Line x1={PAD_L} y1={PAD_T + toY(goal)} x2={PAD_L + plotW} y2={PAD_T + toY(goal)} stroke="#10B981" strokeWidth={1.5} strokeDasharray="5 4" />
          <SvgText x={PAD_L + plotW} y={PAD_T + toY(goal) - 4} textAnchor="end" fill="#10B981" fontSize={9} fontFamily="JetBrainsMono_400Regular">
            goal {formatY(goal)}
          </SvgText>
        </>
      )}

      {/* Small dots for sparse data; the latest point always gets a halo + ring so the current value reads at a glance */}
      {data.length <= 12 && data.slice(0, -1).map((d, i) => (
        <Circle key={i} cx={PAD_L + toX(d.x)} cy={PAD_T + toY(d.y)} r={2.5} fill={color} />
      ))}
      <Circle cx={last[0]} cy={last[1]} r={7} fill={color} fillOpacity={0.18} />
      <Circle cx={last[0]} cy={last[1]} r={4} fill={dark ? "#18181B" : "#FFFFFF"} stroke={color} strokeWidth={2.5} />

      <SvgText x={PAD_L} y={height - 6} fill={labelColor} fontSize={9} fontFamily="JetBrainsMono_400Regular">
        {fmtDate(data[0].x)}
      </SvgText>
      <SvgText x={PAD_L + plotW} y={height - 6} textAnchor="end" fill={labelColor} fontSize={9} fontFamily="JetBrainsMono_400Regular">
        {fmtDate(data[data.length - 1].x)}
      </SvgText>
    </Svg>
  );
}
