import { View, Text, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { compactNumber } from "../../utils/format";

type Props = {
  totalLiftedLbs: number;
  workoutCount: number;
  streak: number;
  bodyweightLbs: number | null;
  totalSeconds: number;
  prCount: number;
};

const formatLbs = (lbs: number) => compactNumber(lbs, 1);

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

// Under an hour show minutes; under 10 h one decimal, so a first 29-minute workout doesn't read "0".
function formatHours(secs: number): { value: string; unit?: string } {
  if (secs < 3600) return { value: String(Math.round(secs / 60)), unit: "min" };
  const h = secs / 3600;
  return { value: h < 10 ? h.toFixed(1) : String(Math.round(h)) };
}

export function StatsGrid({ totalLiftedLbs, workoutCount, streak, bodyweightLbs, totalSeconds, prCount }: Props) {
  return (
    <View className="mx-5 rounded-2xl overflow-hidden">
      <View className="gap-px">
        <View className="flex-row gap-px">
          <StatCell label="Total Lifted" value={formatLbs(totalLiftedLbs)} unit="lbs" />
          <StatCell label="Workouts" value={String(workoutCount)} />
          <StatCell label="Hours" {...formatHours(totalSeconds)} />
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
