import { useEffect, useState } from "react";
import { View, Text } from "react-native";
import { SectionHeader } from "./SectionHeader";
import { getTrainingLoad, type TrainingLoad } from "../../db/boxingStats";

/** Weekly training load (session RPE x minutes, lifting + boxing) with the change vs last week. No good/bad judgement. */
export function TrainingLoadCard({ refreshKey }: { refreshKey?: number }) {
  const [load, setLoad] = useState<TrainingLoad | null>(null);
  useEffect(() => { getTrainingLoad().then(setLoad).catch(console.error); }, [refreshKey]);
  if (!load) return null;

  const empty = load.thisWeek === 0 && load.lastWeek === 0;
  const change = load.changePct == null ? "n/a vs last week" : load.changePct === 0 ? "same as last week" : `${load.changePct > 0 ? "up" : "down"} ${Math.abs(load.changePct)}% vs last week`;
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 56 }}>
      <SectionHeader title="Weekly load" subtitle="RPE x minutes, all training" />
      <View className="bg-surface dark:bg-zinc-900 rounded-2xl p-5">
        {empty ? (
          <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-sm">
            Log RPE on your sets or rounds and finish a session to see your load.
          </Text>
        ) : (
          <>
            <Text className="font-mono-medium text-text-primary dark:text-white" style={{ fontSize: 40, lineHeight: 48 }}>{load.thisWeek}</Text>
            <Text className="font-montserrat text-text-secondary dark:text-zinc-400 text-sm mt-1">{change}</Text>
          </>
        )}
      </View>
    </View>
  );
}
