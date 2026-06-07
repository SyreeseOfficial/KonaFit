import { View, Text } from "react-native";
import type { WorkoutDetail } from "../../db/historyQueries";
import { formatDuration, formatShortDate, formatVolume } from "../../utils/exportUtils";

type Props = {
  workout: WorkoutDetail;
  cardRef?: React.RefObject<View>;
};

export function WorkoutShareCard({ workout, cardRef }: Props) {
  const completedSets = workout.exercises.flatMap((e) =>
    e.sets.filter((s) => s.is_completed && !s.is_warmup)
  );
  const totalSets = completedSets.length;

  return (
    <View
      ref={cardRef}
      style={{
        backgroundColor: "#131313",
        padding: 24,
        width: 340,
      }}
    >
      {/* Branding header */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <Text style={{ fontFamily: "Anton_400Regular", color: "#FFFFFF", fontSize: 22, letterSpacing: 4 }}>
          KONAFIT
        </Text>
        <View style={{ width: 24, height: 4, backgroundColor: "#FF0000" }} />
      </View>

      {/* Date + duration */}
      <Text style={{ fontFamily: "JetBrainsMono_400Regular", color: "#A0A0A0", fontSize: 11, letterSpacing: 1, marginBottom: 2 }}>
        {formatShortDate(workout.started_at).toUpperCase()}
      </Text>
      <Text style={{ fontFamily: "JetBrainsMono_500Medium", color: "#FFFFFF", fontSize: 28, letterSpacing: 2, marginBottom: 20 }}>
        {formatDuration(workout.duration_seconds)}
      </Text>

      {/* Exercises */}
      <View style={{ gap: 12, marginBottom: 20 }}>
        {workout.exercises.slice(0, 6).map((ex) => {
          const workSets = ex.sets.filter((s) => s.is_completed && !s.is_warmup);
          if (workSets.length === 0) return null;

          const maxWeight = Math.max(...workSets.map((s) => s.weight_lbs ?? 0));
          const totalReps = workSets.reduce((sum, s) => sum + (s.reps ?? 0), 0);

          return (
            <View key={ex.id} style={{ borderLeftWidth: 2, borderLeftColor: "#FF0000", paddingLeft: 10 }}>
              <Text style={{ fontFamily: "Montserrat_600SemiBold", color: "#FFFFFF", fontSize: 11, letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 }}>
                {ex.exercise_name}
              </Text>
              <Text style={{ fontFamily: "JetBrainsMono_400Regular", color: "#606060", fontSize: 10 }}>
                {workSets.length} sets · {maxWeight > 0 ? `${maxWeight} lbs` : "BW"} · {totalReps} reps
              </Text>
            </View>
          );
        })}
        {workout.exercises.length > 6 && (
          <Text style={{ fontFamily: "JetBrainsMono_400Regular", color: "#606060", fontSize: 10 }}>
            +{workout.exercises.length - 6} more exercises
          </Text>
        )}
      </View>

      {/* Divider */}
      <View style={{ height: 1, backgroundColor: "#252525", marginBottom: 16 }} />

      {/* Stats footer */}
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <View>
          <Text style={{ fontFamily: "JetBrainsMono_400Regular", color: "#606060", fontSize: 9, letterSpacing: 1, textTransform: "uppercase" }}>
            Volume
          </Text>
          <Text style={{ fontFamily: "JetBrainsMono_500Medium", color: "#FF0000", fontSize: 14 }}>
            {formatVolume(workout.totalVolume)}
          </Text>
        </View>
        <View style={{ alignItems: "center" }}>
          <Text style={{ fontFamily: "JetBrainsMono_400Regular", color: "#606060", fontSize: 9, letterSpacing: 1, textTransform: "uppercase" }}>
            Sets
          </Text>
          <Text style={{ fontFamily: "JetBrainsMono_500Medium", color: "#FFFFFF", fontSize: 14 }}>
            {totalSets}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontFamily: "JetBrainsMono_400Regular", color: "#606060", fontSize: 9, letterSpacing: 1, textTransform: "uppercase" }}>
            Exercises
          </Text>
          <Text style={{ fontFamily: "JetBrainsMono_500Medium", color: "#FFFFFF", fontSize: 14 }}>
            {workout.exercises.length}
          </Text>
        </View>
      </View>
    </View>
  );
}
