import React from "react";
import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, ScrollView, useWindowDimensions } from "react-native";
import Svg, { Path, Circle, Line, Text as SvgText } from "react-native-svg";
import { getOneRMHistory, getTrackedExercises, type OneRMDataPoint } from "../../db/statsQueries";

const PAD_LEFT = 48;
const PAD_RIGHT = 16;
const PAD_TOP = 16;
const PAD_BOTTOM = 32;
const CHART_H = 160;

type Exercise = { id: number; name: string };
type Props = { refreshKey: number };

export function OneRMChart({ refreshKey }: Props) {
  const { width } = useWindowDimensions();
  const chartW = width - 40 - PAD_LEFT - PAD_RIGHT;

  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selected, setSelected] = useState<Exercise | null>(null);
  const [data, setData] = useState<OneRMDataPoint[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    getTrackedExercises().then((list) => {
      setExercises(list);
      if (list.length > 0 && !selected) setSelected(list[0]);
    });
  }, [refreshKey]);

  useEffect(() => {
    if (!selected) return;
    getOneRMHistory(selected.id).then(setData);
  }, [selected, refreshKey]);

  const plotW = chartW;
  const plotH = CHART_H - PAD_TOP - PAD_BOTTOM;
  const hasData = data.length >= 2;

  const minY = hasData ? Math.min(...data.map((d) => d.oneRM)) * 0.9 : 0;
  const maxY = hasData ? Math.max(...data.map((d) => d.oneRM)) * 1.05 : 100;
  const minX = hasData ? data[0].date : 0;
  const maxX = hasData ? data[data.length - 1].date : 1;

  const toX = (date: number) => maxX === minX ? plotW / 2 : ((date - minX) / (maxX - minX)) * plotW;
  const toY = (val: number) => plotH - ((val - minY) / (maxY - minY)) * plotH;

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(minY + t * (maxY - minY)));
  const fmtDate = (ts: number) => new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <View>
      {/* Exercise picker */}
      <TouchableOpacity
        onPress={() => setPickerOpen(!pickerOpen)}
        className="flex-row items-center justify-between bg-surface-2 dark:bg-zinc-800 px-4 py-3 mb-2 rounded-xl"
        activeOpacity={0.7}
      >
        <Text className="font-montserrat-semibold text-text-primary dark:text-white text-base">
          {selected?.name ?? "Select Exercise"}
        </Text>
        <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs">{pickerOpen ? "▲" : "▼"}</Text>
      </TouchableOpacity>

      {pickerOpen && (
        <View className="bg-surface dark:bg-zinc-900 mb-2 max-h-40 rounded-xl overflow-hidden">
          <ScrollView keyboardShouldPersistTaps="handled">
            {exercises.length === 0 ? (
              <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-sm px-4 py-4 text-center">
                Finish a workout first
              </Text>
            ) : (
              exercises.map((ex) => (
                <TouchableOpacity
                  key={ex.id}
                  onPress={() => { setSelected(ex); setPickerOpen(false); }}
                  className={`px-4 py-3 border-b border-surface-2 dark:border-zinc-800 ${selected?.id === ex.id ? "bg-blue-50 dark:bg-blue-950/30" : ""}`}
                  activeOpacity={0.7}
                >
                  <Text className={`font-montserrat text-sm ${selected?.id === ex.id ? "text-crimson dark:text-blue-400" : "text-text-secondary dark:text-zinc-400"}`}>
                    {ex.name}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      )}

      {/* Chart */}
      <View className="bg-surface dark:bg-zinc-900 rounded-2xl overflow-hidden">
        {!hasData ? (
          <View className="h-28 items-center justify-center px-4">
            <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-xs text-center">
              {exercises.length === 0 ? "No workout data yet" : "Need 2+ sessions to show trajectory"}
            </Text>
          </View>
        ) : (
          <Svg width={PAD_LEFT + plotW + PAD_RIGHT} height={CHART_H} style={{ marginTop: 4 }}>
            {yTicks.map((val, i) => {
              const y = PAD_TOP + toY(val);
              return (
                <React.Fragment key={i}>
                  <Line x1={PAD_LEFT} y1={y} x2={PAD_LEFT + plotW} y2={y} stroke="#E2E8F0" strokeWidth={1} />
                  <SvgText x={PAD_LEFT - 6} y={y + 4} textAnchor="end" fill="#94A3B8" fontSize={9} fontFamily="JetBrainsMono_400Regular">
                    {val}
                  </SvgText>
                </React.Fragment>
              );
            })}

            <Path
              d={data.map((d, i) => `${i === 0 ? "M" : "L"} ${PAD_LEFT + toX(d.date)} ${PAD_TOP + toY(d.oneRM)}`).join(" ")}
              stroke="#2563EB"
              strokeWidth={2}
              fill="none"
              strokeLinejoin="round"
              strokeLinecap="round"
            />

            {data.map((d, i) => (
              <Circle key={i} cx={PAD_LEFT + toX(d.date)} cy={PAD_TOP + toY(d.oneRM)} r={3} fill="#2563EB" />
            ))}

            <SvgText x={PAD_LEFT} y={CHART_H - 4} fill="#94A3B8" fontSize={9} fontFamily="JetBrainsMono_400Regular">
              {fmtDate(data[0].date)}
            </SvgText>
            <SvgText x={PAD_LEFT + plotW} y={CHART_H - 4} textAnchor="end" fill="#94A3B8" fontSize={9} fontFamily="JetBrainsMono_400Regular">
              {fmtDate(data[data.length - 1].date)}
            </SvgText>
          </Svg>
        )}
      </View>
    </View>
  );
}
