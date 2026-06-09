import { View, Text } from "react-native";

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

function StatCell({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <View className="flex-1 bg-surface p-5">
      <Text className="font-mono text-text-muted text-xs tracking-widest uppercase mb-3">
        {label}
      </Text>
      <View className="flex-row items-end gap-1">
        <Text className="font-mono-medium text-white text-2xl leading-none">
          {value}
        </Text>
        {unit && (
          <Text className="font-mono text-text-muted text-xs mb-0.5">{unit}</Text>
        )}
      </View>
    </View>
  );
}

export function StatsGrid({ totalLiftedLbs, workoutCount, streak, bodyweightLbs, totalHours, prCount }: Props) {
  return (
    <View>
      <View className="px-4 mb-3">
        <Text className="font-mono text-text-muted text-xs tracking-widest uppercase">
          Lifetime Stats
        </Text>
      </View>
      <View className="gap-px">
        <View className="flex-row gap-px">
          <StatCell label="Total Lifted" value={formatLbs(totalLiftedLbs)} unit="lbs" />
          <StatCell label="Workouts" value={String(workoutCount)} />
          <StatCell label="Hours" value={String(totalHours)} />
        </View>
        <View className="flex-row gap-px">
          <StatCell
            label="Streak"
            value={String(streak)}
            unit={streak === 1 ? "day" : "days"}
          />
          <StatCell
            label="Bodyweight"
            value={bodyweightLbs != null ? String(bodyweightLbs) : "—"}
            unit={bodyweightLbs != null ? "lbs" : undefined}
          />
          <StatCell label="PRs" value={String(prCount)} />
        </View>
      </View>
    </View>
  );
}
