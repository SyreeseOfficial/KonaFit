import { useState, useEffect } from "react";
import { View, Text, Modal, Pressable, TouchableOpacity, ActivityIndicator } from "react-native";
import { X, Trophy } from "lucide-react-native";
import { getExercisePRs, type ExercisePRs, type PRSet } from "../../db/historyQueries";

type Props = {
  visible: boolean;
  exerciseId: number;
  exerciseName: string;
  onClose: () => void;
};

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
}

function PRColumn({ label, set }: { label: string; set: PRSet }) {
  const hasData = set.weightLbs != null && set.reps != null;

  return (
    <View className="flex-1 bg-surface-2 dark:bg-zinc-800 p-4 items-center rounded-2xl">
      <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs uppercase tracking-widest mb-3">
        {label}
      </Text>

      {hasData ? (
        <>
          <Text className="font-mono-medium text-text-primary dark:text-white text-xl leading-none">
            {set.weightLbs} lbs
          </Text>
          <Text className="font-mono text-text-secondary dark:text-zinc-400 text-sm mt-1">
            × {set.reps} reps
          </Text>
          {set.achievedAt != null && (
            <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs mt-2 text-center">
              {formatDate(set.achievedAt)}
            </Text>
          )}
        </>
      ) : (
        <Text className="font-mono text-text-muted dark:text-zinc-500 text-base">—</Text>
      )}
    </View>
  );
}

export function ExerciseHistoryModal({ visible, exerciseId, exerciseName, onClose }: Props) {
  const [prs, setPRs] = useState<ExercisePRs | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    getExercisePRs(exerciseId).then(setPRs).finally(() => setLoading(false));
  }, [visible, exerciseId]);

  const noPRs = prs && !prs.maxWeight.weightLbs && !prs.maxReps.reps && !prs.maxVolume.weightLbs;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/60 justify-end" onPress={onClose}>
        <Pressable style={{ width: "100%" }}>
          <View className="bg-surface dark:bg-zinc-900 px-5 pt-5 pb-10 rounded-t-3xl">
            <View className="flex-row items-center justify-between mb-5">
              <View className="flex-1">
                <Text
                  className="font-montserrat-bold text-text-primary dark:text-white text-lg"
                  numberOfLines={1}
                >
                  {exerciseName}
                </Text>
                <View className="flex-row items-center gap-1.5 mt-0.5">
                  <Trophy size={11} color="#2563EB" />
                  <Text className="font-mono text-crimson dark:text-blue-400 text-xs uppercase tracking-widest">
                    Personal Records
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} hitSlop={8} activeOpacity={0.7}>
                <X size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {loading || prs === null ? (
              <ActivityIndicator color="#2563EB" style={{ marginVertical: 32 }} />
            ) : noPRs ? (
              <View className="bg-surface-2 dark:bg-zinc-800 p-6 items-center rounded-2xl">
                <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-sm text-center">
                  No completed sets yet.{"\n"}Finish a workout to see your PRs.
                </Text>
              </View>
            ) : (
              <View className="flex-row gap-2">
                <PRColumn label="Max Weight" set={prs!.maxWeight} />
                <PRColumn label="Max Reps" set={prs!.maxReps} />
                <PRColumn label="Max Volume" set={prs!.maxVolume} />
              </View>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
