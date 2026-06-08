import { useState, useEffect, useCallback } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import Svg, {
  Ellipse, Rect, Polygon, Line, Circle,
  Text as SvgText, Path,
} from "react-native-svg";
import { getMuscleSets, type RawMuscleSets } from "../../db/statsQueries";

// ─── Weighted set contributions ───────────────────────────────────────────────
// Each muscle_group's sets credit weighted amounts to display muscles.
// Chest exercises: 1 chest + 0.5 arms (tricep stress). Back: 1 back + 0.5 arms (bicep). Etc.

const SECONDARY: Record<string, Record<string, number>> = {
  Chest:     { Chest: 1.0, Arms: 0.5 },
  Back:      { Back: 1.0, Arms: 0.5 },
  Shoulders: { Shoulders: 1.0, Arms: 0.25 },
  Legs:      { Legs: 1.0 },
  Arms:      { Arms: 1.0 },
  Core:      { Core: 1.0 },
};

function applyWeights(raw: RawMuscleSets): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [group, count] of Object.entries(raw)) {
    const weights = SECONDARY[group] ?? { [group]: 1.0 };
    for (const [target, w] of Object.entries(weights)) {
      out[target] = +(((out[target] ?? 0) + count * w).toFixed(1));
    }
  }
  return out;
}

// ─── Period config ────────────────────────────────────────────────────────────

type Period = "7d" | "30d" | "90d" | "1y" | "all";
const PERIODS: { key: Period; label: string; days: number | null }[] = [
  { key: "7d",  label: "7D",   days: 7 },
  { key: "30d", label: "30D",  days: 30 },
  { key: "90d", label: "90D",  days: 90 },
  { key: "1y",  label: "1Y",   days: 365 },
  { key: "all", label: "All",  days: null },
];

// ─── Body SVG ─────────────────────────────────────────────────────────────────

const MUSCLES_DISPLAY = ["Chest", "Back", "Shoulders", "Arms", "Legs", "Core"];

function lerp(t: number, a: string, b: string): string {
  const p = (h: string, o: number) => parseInt(h.slice(o, o + 2), 16);
  const r = Math.round(p(a,1) + (p(b,1) - p(a,1)) * t);
  const g = Math.round(p(a,3) + (p(b,3) - p(a,3)) * t);
  const bl = Math.round(p(a,5) + (p(b,5) - p(a,5)) * t);
  return `#${r.toString(16).padStart(2,"0")}${g.toString(16).padStart(2,"0")}${bl.toString(16).padStart(2,"0")}`;
}

function muscleColor(muscle: string, sets: Record<string, number>, maxSets: number): string {
  const val = sets[muscle] ?? 0;
  if (val === 0 || maxSets === 0) return "#252525";
  const t = Math.min(Math.pow(val / maxSets, 0.5), 1);
  return lerp(t, "#252525", "#FF0000");
}

function fmt(n: number | undefined): string {
  if (!n || n === 0) return "";
  return n % 1 === 0 ? String(n) : n.toFixed(1);
}

function BodySVG({ sets, side }: { sets: Record<string, number>; side: "front" | "back" }) {
  const maxSets = Math.max(0, ...Object.values(sets));
  const mc = (m: string) => muscleColor(m, sets, maxSets);

  const chest     = mc("Chest");
  const back      = mc("Back");
  const shoulders = mc("Shoulders");
  const arms      = mc("Arms");
  const legs      = mc("Legs");
  const core      = mc("Core");

  const torso = side === "front" ? chest : back;
  const textColor = "#FFFFFF";
  const textSize = 8;

  return (
    <Svg width={130} height={250} viewBox="0 0 130 250">
      {/* Head */}
      <Ellipse cx={65} cy={18} rx={14} ry={16} fill="#353534" />
      {/* Neck */}
      <Rect x={58} y={32} width={14} height={10} fill="#353534" />

      {/* Shoulders */}
      <Ellipse cx={30} cy={54} rx={15} ry={11} fill={shoulders} />
      <Ellipse cx={100} cy={54} rx={15} ry={11} fill={shoulders} />

      {/* Torso (chest front / back rear) */}
      <Rect x={40} y={46} width={50} height={46} rx={4} fill={torso} />

      {/* Abs (front only) */}
      {side === "front" && <Rect x={43} y={94} width={39} height={36} rx={3} fill={core} />}
      {side === "back"  && <Rect x={43} y={94} width={39} height={36} rx={3} fill="#1C1C1C" />}

      {/* Arms */}
      <Rect x={13} y={46} width={19} height={70} rx={9} fill={arms} />
      <Rect x={98} y={46} width={19} height={70} rx={9} fill={arms} />
      {/* Forearms (static) */}
      <Rect x={11} y={120} width={17} height={44} rx={8} fill="#252525" />
      <Rect x={102} y={120} width={17} height={44} rx={8} fill="#252525" />

      {/* Quads */}
      <Rect x={38} y={134} width={24} height={64} rx={9} fill={legs} />
      <Rect x={66} y={134} width={24} height={64} rx={9} fill={legs} />
      {/* Calves */}
      <Rect x={40} y={202} width={20} height={42} rx={8} fill={legs} />
      <Rect x={68} y={202} width={20} height={42} rx={8} fill={legs} />

      {/* Labels */}
      {side === "front" && sets["Chest"] > 0 && (
        <SvgText x={65} y={72} textAnchor="middle" fill={textColor} fontSize={textSize} fontFamily="Montserrat_700Bold">
          {fmt(sets["Chest"])}
        </SvgText>
      )}
      {side === "back" && sets["Back"] > 0 && (
        <SvgText x={65} y={72} textAnchor="middle" fill={textColor} fontSize={textSize} fontFamily="Montserrat_700Bold">
          {fmt(sets["Back"])}
        </SvgText>
      )}
      {sets["Shoulders"] > 0 && (
        <SvgText x={65} y={48} textAnchor="middle" fill={textColor} fontSize={textSize} fontFamily="Montserrat_700Bold">
          {fmt(sets["Shoulders"])}
        </SvgText>
      )}
      {sets["Arms"] > 0 && (
        <SvgText x={16} y={88} textAnchor="middle" fill={textColor} fontSize={textSize} fontFamily="Montserrat_700Bold">
          {fmt(sets["Arms"])}
        </SvgText>
      )}
      {side === "front" && sets["Core"] > 0 && (
        <SvgText x={65} y={114} textAnchor="middle" fill={textColor} fontSize={textSize} fontFamily="Montserrat_700Bold">
          {fmt(sets["Core"])}
        </SvgText>
      )}
      {sets["Legs"] > 0 && (
        <SvgText x={65} y={170} textAnchor="middle" fill={textColor} fontSize={textSize} fontFamily="Montserrat_700Bold">
          {fmt(sets["Legs"])}
        </SvgText>
      )}
    </Svg>
  );
}

// ─── Hexagon Radar Chart ──────────────────────────────────────────────────────

const RADAR_SIZE = 200;
const RADAR_CX = RADAR_SIZE / 2;
const RADAR_CY = RADAR_SIZE / 2;
const RADAR_R = 72;
const RADAR_MUSCLES = ["Chest", "Shoulders", "Arms", "Legs", "Core", "Back"];
const RADAR_ANGLES = RADAR_MUSCLES.map((_, i) => ((-90 + i * 60) * Math.PI) / 180);
const GRID_RINGS = [0.25, 0.5, 0.75, 1.0];

function rpt(angle: number, r: number) {
  return { x: RADAR_CX + r * Math.cos(angle), y: RADAR_CY + r * Math.sin(angle) };
}

function hexPoints(radii: number[]) {
  return RADAR_ANGLES.map((a, i) => {
    const p = rpt(a, radii[i]);
    return `${p.x},${p.y}`;
  }).join(" ");
}

function RadarChart({
  current,
  previous,
}: {
  current: Record<string, number>;
  previous: Record<string, number>;
}) {
  const allVals = [...Object.values(current), ...Object.values(previous)];
  const maxVal = Math.max(1, ...allVals);

  const curRadii = RADAR_MUSCLES.map((m) => ((current[m] ?? 0) / maxVal) * RADAR_R);
  const prevRadii = RADAR_MUSCLES.map((m) => ((previous[m] ?? 0) / maxVal) * RADAR_R);

  const hasPrev = Object.keys(previous).length > 0;

  return (
    <Svg width={RADAR_SIZE} height={RADAR_SIZE}>
      {/* Grid rings */}
      {GRID_RINGS.map((f, i) => (
        <Polygon
          key={i}
          points={hexPoints(RADAR_ANGLES.map(() => RADAR_R * f))}
          fill="none" stroke="#2A2A2A" strokeWidth={1}
        />
      ))}
      {/* Grid spokes */}
      {RADAR_ANGLES.map((a, i) => {
        const p = rpt(a, RADAR_R);
        return <Line key={i} x1={RADAR_CX} y1={RADAR_CY} x2={p.x} y2={p.y} stroke="#2A2A2A" strokeWidth={1} />;
      })}

      {/* Previous period polygon (dashed gray) */}
      {hasPrev && (
        <Polygon
          points={hexPoints(prevRadii)}
          fill="none"
          stroke="#606060"
          strokeWidth={1.5}
          strokeDasharray="4,3"
        />
      )}

      {/* Current period polygon (crimson) */}
      <Polygon
        points={hexPoints(curRadii)}
        fill="rgba(255,0,0,0.15)"
        stroke="#FF0000"
        strokeWidth={1.5}
      />
      {RADAR_ANGLES.map((a, i) => {
        const p = rpt(a, curRadii[i]);
        return <Circle key={i} cx={p.x} cy={p.y} r={3} fill="#FF0000" />;
      })}

      {/* Labels */}
      {RADAR_ANGLES.map((a, i) => {
        const p = rpt(a, RADAR_R + 17);
        const muscle = RADAR_MUSCLES[i];
        return (
          <SvgText
            key={i}
            x={p.x} y={p.y + 4}
            textAnchor="middle"
            fill={current[muscle] ? "#FFFFFF" : "#444444"}
            fontSize={9}
            fontFamily="Montserrat_600SemiBold"
          >
            {muscle}
          </SvgText>
        );
      })}
    </Svg>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type Tab = "body" | "radar" | "table";

type Props = { refreshKey?: number };

export function MuscleTracker({ refreshKey }: Props) {
  const [period, setPeriod] = useState<Period>("30d");
  const [tab, setTab] = useState<Tab>("body");
  const [bodySide, setBodySide] = useState<"front" | "back">("front");
  const [current, setCurrent] = useState<Record<string, number>>({});
  const [previous, setPrevious] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    const days = PERIODS.find((p) => p.key === period)?.days ?? null;
    const { current: raw, previous: rawPrev } = await getMuscleSets(days);
    setCurrent(applyWeights(raw));
    setPrevious(applyWeights(rawPrev));
  }, [period]);

  useEffect(() => { load(); }, [period, refreshKey, load]);

  const hasCurrent = Object.keys(current).length > 0;
  const hasPrev = Object.keys(previous).length > 0;

  return (
    <View className="bg-surface">
      {/* Period filter */}
      <View className="flex-row border-b border-surface-2">
        {PERIODS.map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            onPress={() => setPeriod(key)}
            className={`flex-1 py-2.5 items-center border-b-2 ${period === key ? "border-crimson" : "border-transparent"}`}
            activeOpacity={0.7}
          >
            <Text className={`font-mono text-xs tracking-widest ${period === key ? "text-white" : "text-text-muted"}`}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab bar */}
      <View className="flex-row border-b border-surface-2">
        {(["body", "radar", "table"] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setTab(t)}
            className={`flex-1 py-2.5 items-center border-b-2 ${tab === t ? "border-crimson" : "border-transparent"}`}
            activeOpacity={0.7}
          >
            <Text className={`font-montserrat-semibold text-xs tracking-widest uppercase ${tab === t ? "text-white" : "text-text-muted"}`}>
              {t}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {!hasCurrent && (
        <View className="p-8 items-center">
          <Text className="font-montserrat text-text-muted text-sm text-center">
            No workout data for this period.
          </Text>
        </View>
      )}

      {/* ── Body ─────────────────────────────────────────────── */}
      {hasCurrent && tab === "body" && (
        <View className="items-center py-4">
          {/* Front/back toggle */}
          <View className="flex-row mb-4">
            {(["front", "back"] as const).map((s) => (
              <TouchableOpacity
                key={s}
                onPress={() => setBodySide(s)}
                className={`px-5 py-1.5 ${s === "front" ? "mr-1" : ""} ${bodySide === s ? "bg-crimson" : "bg-surface-2"}`}
                activeOpacity={0.7}
              >
                <Text className={`font-mono text-xs tracking-widest uppercase ${bodySide === s ? "text-white" : "text-text-muted"}`}>
                  {s}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <BodySVG sets={current} side={bodySide} />

          {/* Legend */}
          <View className="flex-row gap-4 mt-4">
            <View className="flex-row items-center gap-1.5">
              <View className="w-3 h-3" style={{ backgroundColor: "#252525" }} />
              <Text className="font-mono text-text-muted text-xs">None</Text>
            </View>
            <View className="flex-row items-center gap-1.5">
              <View className="w-3 h-3" style={{ backgroundColor: lerp(0.5, "#252525", "#FF0000") }} />
              <Text className="font-mono text-text-muted text-xs">Low</Text>
            </View>
            <View className="flex-row items-center gap-1.5">
              <View className="w-3 h-3 bg-crimson" />
              <Text className="font-mono text-text-muted text-xs">High</Text>
            </View>
          </View>

          <Text className="font-mono text-text-muted text-xs mt-3 text-center px-4">
            Numbers = weighted sets. Chest press = 1 chest + 0.5 arms per set.
          </Text>
        </View>
      )}

      {/* ── Radar ────────────────────────────────────────────── */}
      {hasCurrent && tab === "radar" && (
        <View className="items-center py-4 px-4">
          <RadarChart current={current} previous={previous} />
          {/* Legend */}
          <View className="flex-row gap-5 mt-1">
            <View className="flex-row items-center gap-1.5">
              <View className="w-5 h-0.5 bg-crimson" />
              <Text className="font-mono text-text-muted text-xs">Current</Text>
            </View>
            {hasPrev && period !== "all" && (
              <View className="flex-row items-center gap-1.5">
                <View className="w-5 h-0.5" style={{ backgroundColor: "#606060" }} />
                <Text className="font-mono text-text-muted text-xs">Previous</Text>
              </View>
            )}
          </View>
          {period === "all" && (
            <Text className="font-mono text-text-muted text-xs mt-2">No comparison for all-time view</Text>
          )}
        </View>
      )}

      {/* ── Table ────────────────────────────────────────────── */}
      {hasCurrent && tab === "table" && (
        <View className="py-2">
          {/* Header */}
          <View className="flex-row px-4 py-2 border-b border-surface-2">
            <Text className="flex-1 font-mono text-text-muted text-xs tracking-widest uppercase">Muscle</Text>
            <Text className="w-16 font-mono text-text-muted text-xs tracking-widest uppercase text-right">Sets</Text>
            {hasPrev && period !== "all" && (
              <Text className="w-20 font-mono text-text-muted text-xs tracking-widest uppercase text-right">vs Prev</Text>
            )}
          </View>

          {MUSCLES_DISPLAY.map((muscle) => {
            const cur = current[muscle] ?? 0;
            const prev = previous[muscle] ?? 0;
            const diff = +(cur - prev).toFixed(1);
            const hasDiff = hasPrev && period !== "all";
            if (cur === 0 && prev === 0) return null;
            return (
              <View key={muscle} className="flex-row items-center px-4 py-3 border-b border-surface-2">
                <Text className="flex-1 font-montserrat-semibold text-white text-sm">{muscle}</Text>
                <Text className="w-16 font-mono-medium text-white text-sm text-right">{fmt(cur)}</Text>
                {hasDiff && (
                  <Text
                    className="w-20 font-mono text-sm text-right"
                    style={{ color: diff > 0 ? "#4CAF50" : diff < 0 ? "#FF0000" : "#606060" }}
                  >
                    {diff > 0 ? `+${fmt(diff)}` : diff < 0 ? fmt(diff) : "—"}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
