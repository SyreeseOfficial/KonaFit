import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { LineChart } from "./LineChart";
import {
  getOneRMHistory, getTrackedExercises, getBodyweightTrend, type TrendPoint,
} from "../../db/statsQueries";
import { getWeeklyLoad, getLiftGoalOneRm, getBodyweightGoal } from "../../db/insightQueries";
import { deloadAlert, movingAverage, projectGoalDate } from "../../utils/training";
import { compactNumber } from "../../utils/format";
import { logError } from "../../utils/errors";

const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <View className="bg-surface dark:bg-zinc-900 rounded-2xl p-4 mb-4">
    <Text className="font-montserrat-bold text-text-primary dark:text-white text-base mb-3">{title}</Text>
    {children}
  </View>
);

const note = "font-montserrat text-text-secondary dark:text-zinc-400 text-sm mt-3";

/** Three small trend cards: best estimated 1RM per exercise, weekly volume, bodyweight. */
export function TrendCards({ refreshKey }: { refreshKey?: number }) {
  const [exercises, setExercises] = useState<{ id: number; name: string }[]>([]);
  const [exerciseId, setExerciseId] = useState<number | null>(null);
  const [rm, setRm] = useState<TrendPoint[]>([]);
  const [rmGoal, setRmGoal] = useState<number | null>(null);
  const [weekly, setWeekly] = useState<TrendPoint[]>([]);
  const [alert, setAlert] = useState<string | null>(null);
  const [bw, setBw] = useState<TrendPoint[]>([]);
  const [bwGoal, setBwGoal] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const [tracked, load, bwPoints, goal] = await Promise.all([
        getTrackedExercises(8), getWeeklyLoad(12), getBodyweightTrend(120), getBodyweightGoal(),
      ]);
      setExercises(tracked);
      setExerciseId((cur) => cur ?? tracked[0]?.id ?? null);
      setWeekly(load.map((w) => ({ x: w.x, y: w.volume })));
      setAlert(deloadAlert(load.filter((w) => !w.current)));
      setBw(bwPoints);
      setBwGoal(goal);
    })().catch(logError);
  }, [refreshKey]);

  useEffect(() => {
    if (exerciseId == null) return;
    Promise.all([getOneRMHistory(exerciseId), getLiftGoalOneRm(exerciseId)])
      .then(([points, goal]) => { setRm(points.map((p) => ({ x: p.date, y: p.oneRM }))); setRmGoal(goal); })
      .catch(logError);
  }, [exerciseId, refreshKey]);

  const avg = movingAverage(bw);
  const projected = bwGoal != null ? projectGoalDate(avg, bwGoal) : null;

  return (
    <View>
      <Card title="Best 1RM">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3">
          {exercises.map((e) => (
            <TouchableOpacity
              key={e.id}
              onPress={() => setExerciseId(e.id)}
              activeOpacity={0.7}
              className={`px-4 h-8 mr-2 items-center justify-center rounded-full ${exerciseId === e.id ? "bg-crimson dark:bg-blue-500" : "bg-surface-2 dark:bg-zinc-800"}`}
            >
              <Text className={`font-montserrat-semibold text-xs ${exerciseId === e.id ? "text-white" : "text-text-primary dark:text-white"}`}>{e.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <LineChart data={rm} goal={rmGoal ?? undefined} emptyText="Finish two workouts with this lift to see a trend" />
      </Card>

      <Card title="Weekly volume">
        <LineChart data={weekly} formatY={(v) => compactNumber(v, 1)} emptyText="Two weeks of workouts will draw this chart" />
        {alert && <Text className="font-montserrat-semibold text-amber-600 dark:text-amber-400 text-sm mt-3">{alert}</Text>}
      </Card>

      <Card title="Bodyweight">
        <LineChart data={bw} overlay={avg} goal={bwGoal ?? undefined} formatY={(v) => v.toFixed(1)} emptyText="Log your weight twice to see a trend" />
        {avg.length > 0 && (
          <Text className={note}>
            7-day average {avg[avg.length - 1].y.toFixed(1)} lb (orange line)
            {projected ? ` · on pace for ${bwGoal} lb around ${new Date(projected).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}` : ""}
          </Text>
        )}
      </Card>
    </View>
  );
}
