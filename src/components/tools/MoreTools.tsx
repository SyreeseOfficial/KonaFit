import { useState } from "react";
import { View, Text, TextInput } from "react-native";
import { ONE_RM_FORMULAS, MAX_1RM_REPS, estimateOneRm } from "../../utils/oneRm";
import { RPE_CHART, warmupRamp } from "../../utils/training";

const input = "flex-1 h-13 bg-surface-2 dark:bg-zinc-800 px-4 font-mono-medium text-text-primary dark:text-white text-xl text-center rounded-xl";
const mono = "font-mono text-text-muted dark:text-zinc-500 text-xs";
const row = "flex-row items-center justify-between py-3 border-b border-surface-2 dark:border-zinc-800";

export function OneRmCalculator() {
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const w = parseFloat(weight);
  const r = parseInt(reps, 10);
  const ok = w > 0 && r > 0;
  return (
    <View>
      <View className="flex-row gap-3 mb-4">
        <TextInput className={input} placeholder="Weight" placeholderTextColor="#94A3B8" value={weight} onChangeText={setWeight} keyboardType="decimal-pad" selectTextOnFocus />
        <TextInput className={input} placeholder="Reps" placeholderTextColor="#94A3B8" value={reps} onChangeText={setReps} keyboardType="number-pad" selectTextOnFocus />
      </View>
      {ok && ONE_RM_FORMULAS.map((f) => (
        <View key={f.key} className={row}>
          <Text className="font-montserrat-semibold text-text-primary dark:text-white text-base">{f.label}</Text>
          <Text className="font-mono-medium text-text-primary dark:text-white text-lg">{Math.round(estimateOneRm(w, r, f.key))} lb</Text>
        </View>
      ))}
      <Text className={`${mono} mt-4`}>Estimate only. Sets over {MAX_1RM_REPS} reps are counted as {MAX_1RM_REPS}, since the formulas drift past that.</Text>
    </View>
  );
}

export function RpeChart() {
  const cols = [0, 2, 4, 6, 8]; // RPE 10, 9, 8, 7, 6
  return (
    <View>
      <Text className={`${mono} mb-3`}>% of your 1RM you can lift for a number of reps at each RPE (RPE 10 = nothing left, 8 = 2 reps in reserve).</Text>
      <View className="flex-row py-2 border-b border-surface-2 dark:border-zinc-800">
        <Text className={`${mono} w-12`}>Reps</Text>
        {cols.map((c) => <Text key={c} className={`${mono} flex-1 text-center`}>RPE {RPE_CHART.levels[c]}</Text>)}
      </View>
      {RPE_CHART.rows.map((vals, i) => (
        <View key={i} className="flex-row py-2.5 border-b border-surface-2 dark:border-zinc-800">
          <Text className="font-mono-medium text-text-primary dark:text-white text-sm w-12">{i + 1}</Text>
          {cols.map((c) => <Text key={c} className="font-mono text-text-primary dark:text-white text-sm flex-1 text-center">{vals[c]}%</Text>)}
        </View>
      ))}
    </View>
  );
}

export function WarmupCalculator() {
  const [work, setWork] = useState("");
  const bar = 45;
  const w = parseFloat(work);
  const ramp = w > 0 ? warmupRamp(w, 3, bar) : [];
  return (
    <View>
      <View className="flex-row items-center gap-3 mb-4">
        <TextInput className={input} placeholder="First working weight" placeholderTextColor="#94A3B8" value={work} onChangeText={setWork} keyboardType="decimal-pad" selectTextOnFocus />
        <Text className={mono}>lbs</Text>
      </View>
      <Text className={`${mono} mb-4`}>Rounded to 5 lb. Heavy lifts never go below the 45 lb bar.</Text>
      {ramp.map((s, i) => (
        <View key={i} className={row}>
          <Text className={mono}>Warm-up {i + 1}</Text>
          <Text className="font-mono-medium text-text-primary dark:text-white text-lg">{s.weight} × {s.reps}</Text>
        </View>
      ))}
      {w > 0 && ramp.length === 0 && <Text className={mono}>Too light to need a warm-up.</Text>}
    </View>
  );
}
