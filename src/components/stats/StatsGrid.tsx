import { View, Text, TouchableOpacity } from "react-native";
import { router } from "expo-router";

type Props = {
  totalLiftedLbs: number;
  workoutCount: number;
  streak: number;
  bodyweightLbs: number | null;
  totalHours: number;
  prCount: number;
};

function formatLbs(lbs: number): string {
  if (lbs >= 1_000_000) return `${(lbs / 1_000_000).toFixed(1)}M`;
  if (lbs >= 1_000) return `${(lbs / 1_000).toFixed(1)}K`;
  return String(Math.round(lbs));
}

function StatCell({ label, value, unit, onPress }: { label: string; value: string; unit?: string; onPress?: () => void }) {
  const Wrapper = onPress ? TouchableOpacity : View;
  return (
    <Wrapper className="flex-1 bg-surface dark:bg-zinc-900 p-5" {...(onPress ? { onPress, activeOpacity: 0.7 } : {})}>
      <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs uppercase tracking-widest mb-3">
        {label}
      </Text>
      <View className="flex-row items-end gap-1">
        <Text className="font-mono-medium text-text-primary dark:text-white text-2xl leading-none">
          {value}
        </Text>
        {unit && (
          <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs mb-0.5">{unit}</Text>
        )}
      </View>
    </Wrapper>
  );
}

export function StatsGrid({ totalLiftedLbs, workoutCount, streak, bodyweightLbs, totalHours, prCount }: Props) {
  return (
    <View className="mx-5 rounded-2xl overflow-hidden">
      <View className="gap-px">
        <View className="flex-row gap-px">
          <StatCell label="Total Lifted" value={formatLbs(totalLiftedLbs)} unit="lbs" />
          <StatCell label="Workouts" value={String(workoutCount)} />
          <StatCell label="Hours" value={String(totalHours)} />
        </View>
        <View className="flex-row gap-px">
          <StatCell label="Streak" value={String(streak)} unit={streak === 1 ? "day" : "days"} />
          <StatCell label="Bodyweight" value={bodyweightLbs != null ? String(bodyweightLbs) : "—"} unit={bodyweightLbs != null ? "lbs" : undefined} />
          <StatCell label="PRs" value={String(prCount)} onPress={() => router.push("/prs")} />
        </View>
      </View>
    </View>
  );
}
