import { View, Text, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { ChevronRight, MapPin } from "lucide-react-native";
import { formatDuration, formatShortDate, formatVolume } from "../../utils/exportUtils";
import type { WorkoutSummary } from "../../db/historyQueries";

type Props = { workouts: WorkoutSummary[] };

export function WorkoutHistoryList({ workouts }: Props) {
  if (workouts.length === 0) {
    return (
      <View className="bg-surface p-6 items-center">
        <Text className="font-montserrat text-text-muted text-sm text-center">
          Finish a workout to see your history here
        </Text>
      </View>
    );
  }

  return (
    <View className="bg-surface">
      {workouts.map((w, i) => (
        <TouchableOpacity
          key={w.id}
          onPress={() => router.push(`/workout/${w.id}` as never)}
          className={`flex-row items-center px-4 py-5 ${i > 0 ? "border-t border-surface-2" : ""}`}
          activeOpacity={0.7}
        >
          <View className="flex-1">
            <Text className="font-montserrat-semibold text-white text-xs tracking-wider uppercase mb-0.5">
              {formatShortDate(w.started_at)}
            </Text>
            <View className="flex-row gap-3 flex-wrap">
              <Text className="font-mono text-text-muted text-xs">
                {formatDuration(w.duration_seconds)}
              </Text>
              <Text className="font-mono text-text-muted text-xs">
                {w.exercise_count} exercises
              </Text>
              <Text className="font-mono text-text-muted text-xs">
                {formatVolume(w.total_volume)}
              </Text>
            </View>
            {w.location ? (
              <View className="flex-row items-center gap-1 mt-1">
                <MapPin size={10} color="#606060" />
                <Text className="font-mono text-text-muted text-xs">{w.location}</Text>
              </View>
            ) : null}
          </View>
          <ChevronRight size={16} color="#606060" />
        </TouchableOpacity>
      ))}

      {/* View All */}
      <TouchableOpacity
        onPress={() => router.push("/history" as never)}
        className="flex-row items-center justify-center gap-1.5 py-4 border-t border-surface-2"
        activeOpacity={0.7}
      >
        <Text className="font-montserrat-semibold text-text-secondary text-xs tracking-widest uppercase">
          View All
        </Text>
        <ChevronRight size={12} color="#606060" />
      </TouchableOpacity>
    </View>
  );
}
