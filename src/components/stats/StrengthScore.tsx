import { useState, useEffect, useCallback } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import Svg, { Polygon, Line, Circle, Text as SvgText } from "react-native-svg";
import { getAllExercise1RMs } from "../../db/statsQueries";
import { getLatestBodyweight } from "../../db/statsQueries";
import { getProfileSettings } from "../../../app/settings";
import {
  computeStrengthScore,
  CATEGORY_ORDER,
  CATEGORY_LABELS,
  LEVEL_CONFIG,
  getNextLevel,
  type StrengthScoreResult,
  type LiftCategory,
} from "../../utils/strengthScore";

// ─── Radar Chart ─────────────────────────────────────────────────────────────

const CHART_SIZE = 180;
const CX = CHART_SIZE / 2;
const CY = CHART_SIZE / 2;
const R = 70;
// Pentagon angles: top = squat, then clockwise
const ANGLES = CATEGORY_ORDER.map((_, i) => ((-90 + i * 72) * Math.PI) / 180);
const GRID_LEVELS = [0.25, 0.5, 0.75, 1.0];

function pt(angle: number, radius: number) {
  return { x: CX + radius * Math.cos(angle), y: CY + radius * Math.sin(angle) };
}

function polygonPoints(radii: number[]): string {
  return ANGLES.map((a, i) => {
    const p = pt(a, radii[i]);
    return `${p.x},${p.y}`;
  }).join(" ");
}

function RadarChart({ scores }: { scores: (number | null)[] }) {
  const userRadii = scores.map((s) => ((s ?? 0) / 100) * R);
  const bgPoints = GRID_LEVELS.map((f) => polygonPoints(ANGLES.map(() => R * f)));
  const userPoints = polygonPoints(userRadii);

  return (
    <Svg width={CHART_SIZE} height={CHART_SIZE}>
      {/* Grid pentagons */}
      {bgPoints.map((pts, i) => (
        <Polygon key={i} points={pts} fill="none" stroke="#2A2A2A" strokeWidth={1} />
      ))}
      {/* Grid spokes */}
      {ANGLES.map((a, i) => {
        const outer = pt(a, R);
        return <Line key={i} x1={CX} y1={CY} x2={outer.x} y2={outer.y} stroke="#2A2A2A" strokeWidth={1} />;
      })}
      {/* User polygon */}
      <Polygon points={userPoints} fill="rgba(255,0,0,0.15)" stroke="#FF0000" strokeWidth={1.5} />
      {/* User dots */}
      {ANGLES.map((a, i) => {
        const p = pt(a, userRadii[i]);
        return <Circle key={i} cx={p.x} cy={p.y} r={3} fill="#FF0000" />;
      })}
      {/* Labels */}
      {ANGLES.map((a, i) => {
        const labelR = R + 16;
        const p = pt(a, labelR);
        const score = scores[i];
        return (
          <SvgText
            key={i}
            x={p.x}
            y={p.y + 4}
            textAnchor="middle"
            fill={score != null ? "#FFFFFF" : "#444444"}
            fontSize={9}
            fontFamily="Montserrat_600SemiBold"
          >
            {CATEGORY_LABELS[CATEGORY_ORDER[i]]}
          </SvgText>
        );
      })}
    </Svg>
  );
}

// ─── Level Badge ──────────────────────────────────────────────────────────────

function LevelBadge({ name, color, small }: { name: string; color: string; small?: boolean }) {
  return (
    <View
      className={`px-2 py-0.5 ${small ? "" : "px-3 py-1"}`}
      style={{ backgroundColor: color + "22", borderWidth: 1, borderColor: color }}
    >
      <Text
        className={`font-montserrat-bold tracking-widest uppercase ${small ? "text-xs" : "text-xs"}`}
        style={{ color, fontSize: small ? 9 : 10 }}
      >
        {name}
      </Text>
    </View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type Tab = "score" | "level" | "balance";

type Props = { refreshKey?: number };

export function StrengthScore({ refreshKey }: Props) {
  const [result, setResult] = useState<StrengthScoreResult | null>(null);
  const [bodyweight, setBodyweight] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>("score");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [oneRMs, bw, profile] = await Promise.all([
      getAllExercise1RMs(),
      getLatestBodyweight(),
      getProfileSettings(),
    ]);
    setBodyweight(bw);
    if (bw && oneRMs.length > 0) {
      setResult(computeStrengthScore(oneRMs, bw, profile.gender, profile.age));
    } else {
      setResult(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [refreshKey, load]);

  if (loading) return null;

  if (!bodyweight) {
    return (
      <View className="bg-surface p-6 items-center">
        <Text className="font-montserrat text-text-muted text-sm text-center">
          Log your bodyweight to unlock Strength Score.
        </Text>
      </View>
    );
  }

  if (!result || result.overall === 0) {
    return (
      <View className="bg-surface p-6 items-center">
        <Text className="font-montserrat text-text-muted text-sm text-center">
          Complete workouts with squat, bench, deadlift, overhead, or pull exercises to see your score.
        </Text>
      </View>
    );
  }

  const nextLevel = getNextLevel(result.overall);
  const currentLevelConfig = LEVEL_CONFIG.find((l) => l.name === result.level.name)!;
  const progressFraction = nextLevel
    ? (result.overall - result.level.minScore) / (nextLevel.minScore - result.level.minScore)
    : 1;

  return (
    <View className="bg-surface">
      {/* Tab bar */}
      <View className="flex-row border-b border-surface-2">
        {(["score", "level", "balance"] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setTab(t)}
            className={`flex-1 py-3 items-center border-b-2 ${tab === t ? "border-crimson" : "border-transparent"}`}
            activeOpacity={0.7}
          >
            <Text className={`font-montserrat-semibold text-xs tracking-widest uppercase ${tab === t ? "text-white" : "text-text-muted"}`}>
              {t}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Score tab ─────────────────────────────────────────── */}
      {tab === "score" && (
        <View className="p-5 items-center">
          <Text className="font-mono text-text-muted text-xs tracking-widest uppercase mb-3">
            Overall Score
          </Text>
          <Text className="font-anton text-white tracking-widest" style={{ fontSize: 80, lineHeight: 88 }}>
            {result.overall}
          </Text>
          <LevelBadge name={result.level.name} color={result.level.color} />

          {nextLevel && (
            <View className="w-full mt-5">
              <View className="h-1 bg-surface-2 w-full">
                <View
                  className="h-1"
                  style={{ width: `${Math.round(progressFraction * 100)}%`, backgroundColor: result.level.color }}
                />
              </View>
              <Text className="font-mono text-text-muted text-xs mt-2 text-center">
                {nextLevel.minScore - result.overall} pts to{" "}
                <Text style={{ color: nextLevel.color }}>{nextLevel.name}</Text>
              </Text>
            </View>
          )}

          {!nextLevel && (
            <Text className="font-mono text-crimson text-xs mt-3">World class level achieved</Text>
          )}

          <Text className="font-mono text-text-muted text-xs mt-5 text-center leading-5">
            Score = average relative strength{"\n"}across all tracked movement patterns
          </Text>
        </View>
      )}

      {/* ── Level tab ─────────────────────────────────────────── */}
      {tab === "level" && (
        <View className="py-2">
          {/* Legend */}
          <View className="flex-row flex-wrap gap-2 px-4 py-3 border-b border-surface-2">
            {LEVEL_CONFIG.map((l) => (
              <LevelBadge key={l.name} name={l.name} color={l.color} small />
            ))}
          </View>

          {result.categories.map((cat) => {
            const catNext = cat.score != null ? getNextLevel(cat.score) : null;
            return (
              <View key={cat.category} className="px-4 py-3 border-b border-surface-2">
                <View className="flex-row items-center justify-between mb-1.5">
                  <View>
                    <Text className="font-montserrat-bold text-white text-sm">{cat.label}</Text>
                    {cat.bestExercise && (
                      <Text className="font-mono text-text-muted text-xs" numberOfLines={1}>
                        {cat.bestExercise}
                      </Text>
                    )}
                  </View>
                  {cat.level ? (
                    <LevelBadge name={cat.level.name} color={cat.level.color} small />
                  ) : (
                    <Text className="font-mono text-text-muted text-xs">No data</Text>
                  )}
                </View>
                {cat.score != null && cat.level && (
                  <>
                    <View className="h-1 bg-surface-2 w-full">
                      <View
                        className="h-1"
                        style={{
                          width: `${cat.score}%`,
                          backgroundColor: cat.level.color,
                        }}
                      />
                    </View>
                    {catNext && (
                      <Text className="font-mono text-text-muted text-xs mt-1">
                        {catNext.minScore - cat.score} pts to{" "}
                        <Text style={{ color: catNext.color }}>{catNext.name}</Text>
                      </Text>
                    )}
                  </>
                )}
              </View>
            );
          })}

          {/* Max 1RM reference */}
          <View className="px-4 py-3">
            <Text className="font-mono text-text-muted text-xs tracking-widest uppercase mb-2">
              Estimated 1RM
            </Text>
            {result.categories.map((cat) => (
              <View key={cat.category} className="flex-row justify-between py-1 border-b border-surface-2">
                <Text className="font-montserrat-semibold text-white text-xs">{cat.label}</Text>
                <Text className="font-mono-medium text-white text-xs">
                  {cat.oneRM != null ? `${cat.oneRM} lbs` : "—"}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ── Balance tab ───────────────────────────────────────── */}
      {tab === "balance" && (
        <View className="items-center py-5 px-4">
          <RadarChart scores={CATEGORY_ORDER.map((cat) => result.categories.find((c) => c.category === cat)?.score ?? null)} />
          <Text className="font-mono text-text-muted text-xs text-center mt-2">
            A balanced shape = well-rounded strength.{"\n"}
            A lagging category has the most room to improve your score.
          </Text>
          <View className="w-full mt-4 gap-1">
            {result.categories.map((cat) => (
              <View key={cat.category} className="flex-row items-center gap-2">
                <Text className="font-montserrat-semibold text-text-secondary text-xs w-16">{cat.label}</Text>
                <View className="flex-1 h-1.5 bg-surface-2">
                  {cat.score != null && (
                    <View
                      className="h-1.5"
                      style={{
                        width: `${cat.score}%`,
                        backgroundColor: cat.level?.color ?? "#606060",
                      }}
                    />
                  )}
                </View>
                <Text className="font-mono text-text-muted text-xs w-8 text-right">
                  {cat.score ?? "—"}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </View>
  );
}
