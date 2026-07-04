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
} from "../../utils/strengthScore";

const CHART_SIZE = 180;
const CX = CHART_SIZE / 2;
const CY = CHART_SIZE / 2;
const R = 70;
const ANGLES = CATEGORY_ORDER.map((_, i) => ((-90 + i * 72) * Math.PI) / 180);
const GRID_LEVELS = [0.25, 0.5, 0.75, 1.0];

function pt(angle: number, radius: number) {
  return { x: CX + radius * Math.cos(angle), y: CY + radius * Math.sin(angle) };
}

function polygonPoints(radii: number[]): string {
  return ANGLES.map((a, i) => { const p = pt(a, radii[i]); return `${p.x},${p.y}`; }).join(" ");
}

function RadarChart({ scores }: { scores: (number | null)[] }) {
  const userRadii = scores.map((s) => ((s ?? 0) / 100) * R);
  const bgPoints = GRID_LEVELS.map((f) => polygonPoints(ANGLES.map(() => R * f)));
  const userPoints = polygonPoints(userRadii);

  return (
    <Svg width={CHART_SIZE} height={CHART_SIZE}>
      {bgPoints.map((pts, i) => (
        <Polygon key={i} points={pts} fill="none" stroke="#E2E8F0" strokeWidth={1} />
      ))}
      {ANGLES.map((a, i) => {
        const outer = pt(a, R);
        return <Line key={i} x1={CX} y1={CY} x2={outer.x} y2={outer.y} stroke="#E2E8F0" strokeWidth={1} />;
      })}
      <Polygon points={userPoints} fill="rgba(37,99,235,0.15)" stroke="#2563EB" strokeWidth={1.5} />
      {ANGLES.map((a, i) => {
        const p = pt(a, userRadii[i]);
        return <Circle key={i} cx={p.x} cy={p.y} r={3} fill="#2563EB" />;
      })}
      {ANGLES.map((a, i) => {
        const p = pt(a, R + 16);
        const score = scores[i];
        return (
          <SvgText key={i} x={p.x} y={p.y + 4} textAnchor="middle" fill={score != null ? "#0F172A" : "#94A3B8"} fontSize={9} fontFamily="Montserrat_600SemiBold">
            {CATEGORY_LABELS[CATEGORY_ORDER[i]]}
          </SvgText>
        );
      })}
    </Svg>
  );
}

function LevelBadge({ name, color, small }: { name: string; color: string; small?: boolean }) {
  return (
    <View
      className="px-2 py-0.5 rounded-full"
      style={{ backgroundColor: color + "22", borderWidth: 1, borderColor: color }}
    >
      <Text className="font-montserrat-bold uppercase" style={{ color, fontSize: small ? 9 : 10 }}>
        {name}
      </Text>
    </View>
  );
}

type Tab = "score" | "level" | "balance";
type Props = { refreshKey?: number };

export function StrengthScore({ refreshKey }: Props) {
  const [result, setResult] = useState<StrengthScoreResult | null>(null);
  const [bodyweight, setBodyweight] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>("score");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [oneRMs, bw, profile] = await Promise.all([getAllExercise1RMs(), getLatestBodyweight(), getProfileSettings()]);
    setBodyweight(bw);
    if (bw && oneRMs.length > 0) setResult(computeStrengthScore(oneRMs, bw, profile.gender, profile.age));
    else setResult(null);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [refreshKey, load]);

  if (loading) return null;

  if (!bodyweight) {
    return (
      <View className="bg-surface dark:bg-zinc-900 p-6 items-center mx-5 rounded-2xl">
        <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-sm text-center">
          Log your bodyweight to unlock Strength Score.
        </Text>
      </View>
    );
  }

  if (!result || result.overall === 0) {
    return (
      <View className="bg-surface dark:bg-zinc-900 p-6 items-center mx-5 rounded-2xl">
        <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-sm text-center">
          Complete workouts with squat, bench, deadlift, overhead, or pull exercises to see your score.
        </Text>
      </View>
    );
  }

  const nextLevel = getNextLevel(result.overall);
  const progressFraction = nextLevel
    ? (result.overall - result.level.minScore) / (nextLevel.minScore - result.level.minScore)
    : 1;

  return (
    <View className="bg-surface dark:bg-zinc-900 mx-5 rounded-2xl overflow-hidden">
      {/* Tab bar */}
      <View className="flex-row border-b border-surface-2 dark:border-zinc-800">
        {(["score", "level", "balance"] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setTab(t)}
            className={`flex-1 py-3 items-center border-b-2 ${tab === t ? "border-crimson dark:border-blue-500" : "border-transparent"}`}
            activeOpacity={0.7}
          >
            <Text className={`font-montserrat-semibold text-xs uppercase tracking-widest ${tab === t ? "text-crimson dark:text-blue-400" : "text-text-muted dark:text-zinc-500"}`}>
              {t}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Score tab */}
      {tab === "score" && (
        <View className="p-5 items-center">
          <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs uppercase tracking-widest mb-3">
            Overall Score
          </Text>
          <Text className="font-mono-medium text-text-primary dark:text-white" style={{ fontSize: 80, lineHeight: 88 }}>
            {result.overall}
          </Text>
          <LevelBadge name={result.level.name} color={result.level.color} />

          {nextLevel && (
            <View className="w-full mt-5">
              <View className="h-1 bg-surface-2 dark:bg-zinc-800 w-full rounded-full overflow-hidden">
                <View className="h-1 rounded-full" style={{ width: `${Math.round(progressFraction * 100)}%`, backgroundColor: result.level.color }} />
              </View>
              <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs mt-2 text-center">
                {nextLevel.minScore - result.overall} pts to{" "}
                <Text style={{ color: nextLevel.color }}>{nextLevel.name}</Text>
              </Text>
            </View>
          )}

          {!nextLevel && (
            <Text className="font-mono text-crimson dark:text-blue-400 text-xs mt-3">World class level achieved</Text>
          )}

          <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs mt-5 text-center leading-5">
            Score = average relative strength{"\n"}across all tracked movement patterns
          </Text>
        </View>
      )}

      {/* Level tab */}
      {tab === "level" && (
        <View className="py-2">
          <View className="flex-row flex-wrap gap-2 px-5 py-3 border-b border-surface-2 dark:border-zinc-800">
            {LEVEL_CONFIG.map((l) => <LevelBadge key={l.name} name={l.name} color={l.color} small />)}
          </View>

          {result.categories.map((cat) => {
            const catNext = cat.score != null ? getNextLevel(cat.score) : null;
            return (
              <View key={cat.category} className="px-5 py-4 border-b border-surface-2 dark:border-zinc-800">
                <View className="flex-row items-center justify-between mb-1.5">
                  <View>
                    <Text className="font-montserrat-bold text-text-primary dark:text-white text-base">{cat.label}</Text>
                    {cat.bestExercise && (
                      <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs" numberOfLines={1}>{cat.bestExercise}</Text>
                    )}
                  </View>
                  {cat.level ? <LevelBadge name={cat.level.name} color={cat.level.color} small /> : (
                    <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs">No data</Text>
                  )}
                </View>
                {cat.score != null && cat.level && (
                  <>
                    <View className="h-1 bg-surface-2 dark:bg-zinc-800 w-full rounded-full overflow-hidden">
                      <View className="h-1 rounded-full" style={{ width: `${cat.score}%`, backgroundColor: cat.level.color }} />
                    </View>
                    {catNext && (
                      <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs mt-1">
                        {catNext.minScore - cat.score} pts to <Text style={{ color: catNext.color }}>{catNext.name}</Text>
                      </Text>
                    )}
                  </>
                )}
              </View>
            );
          })}

          <View className="px-5 py-4">
            <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs uppercase tracking-widest mb-3">Estimated 1RM</Text>
            {result.categories.map((cat) => (
              <View key={cat.category} className="flex-row justify-between py-2.5 border-b border-surface-2 dark:border-zinc-800">
                <Text className="font-montserrat-semibold text-text-primary dark:text-white text-sm">{cat.label}</Text>
                <Text className="font-mono-medium text-text-primary dark:text-white text-sm">
                  {cat.oneRM != null ? `${cat.oneRM} lbs` : "—"}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Balance tab */}
      {tab === "balance" && (
        <View className="items-center py-5 px-5">
          <RadarChart scores={CATEGORY_ORDER.map((cat) => result.categories.find((c) => c.category === cat)?.score ?? null)} />
          <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs text-center mt-2">
            A balanced shape = well-rounded strength.{"\n"}A lagging category has the most room to improve.
          </Text>
          <View className="w-full mt-4 gap-1.5">
            {result.categories.map((cat) => (
              <View key={cat.category} className="flex-row items-center gap-2">
                <Text className="font-montserrat-semibold text-text-secondary dark:text-zinc-400 text-xs w-16">{cat.label}</Text>
                <View className="flex-1 h-1.5 bg-surface-2 dark:bg-zinc-800 rounded-full overflow-hidden">
                  {cat.score != null && (
                    <View className="h-1.5 rounded-full" style={{ width: `${cat.score}%`, backgroundColor: cat.level?.color ?? "#94A3B8" }} />
                  )}
                </View>
                <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs w-8 text-right">
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
