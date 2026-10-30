import { useState, useEffect } from "react";
import { View, Text, Modal, Pressable, TouchableOpacity, ActivityIndicator, ScrollView } from "react-native";
import { X, Trophy } from "lucide-react-native";
import { getExercisePRs, getExerciseSets, type ExercisePRs, type PRSet, type ExerciseSetRow } from "../../db/historyQueries";

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
    <View className="flex-1 bg-surface-2 dark:bg-zinc-800 px-2 py-5 items-center rounded-2xl">
      <Text className="font-mono text-text-muted dark:text-zinc-500 text-[10px] uppercase tracking-widest mb-3">
        {label}
      </Text>

      {hasData ? (
        <>
          <Text className="font-mono-medium text-text-primary dark:text-white text-lg leading-none">
            {set.weightLbs} lbs
          </Text>
          <Text className="font-mono text-text-secondary dark:text-zinc-400 text-sm mt-1.5">
            × {set.reps} reps
          </Text>
          {set.achievedAt != null && (
            <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs mt-3 text-center">
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
  const [sets, setSets] = useState<ExerciseSetRow[]>([]);
  const [shown, setShown] = useState(10);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    setShown(10);
    Promise.all([getExercisePRs(exerciseId), getExerciseSets(exerciseId, 30)])
      .then(([p, s]) => { setPRs(p); setSets(s); })
      .finally(() => setLoading(false));
  }, [visible, exerciseId]);

  const noPRs = prs && !prs.maxWeight.weightLbs && !prs.maxReps.reps && !prs.maxVolume.weightLbs;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-black/60 justify-end">
        <Pressable style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} onPress={onClose} />
        <View style={{ width: "100%" }}>
          <View className="bg-surface dark:bg-zinc-900 px-6 pt-3 pb-12 rounded-t-3xl">
            <View className="w-10 h-1 rounded-full bg-surface-3 dark:bg-zinc-700 self-center mb-5" />

            <View className="flex-row items-center justify-between mb-6">
              <View className="flex-1 mr-4">
                <Text
                  className="font-montserrat-bold text-text-primary dark:text-white text-xl"
                  numberOfLines={1}
                >
                  {exerciseName}
                </Text>
                <View className="flex-row items-center gap-1.5 mt-1.5">
                  <Trophy size={12} color="#2563EB" />
                  <Text className="font-mono text-crimson dark:text-blue-400 text-xs uppercase tracking-widest">
                    Personal Records
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={8}
                activeOpacity={0.7}
                className="w-9 h-9 items-center justify-center rounded-full bg-surface-2 dark:bg-zinc-800"
              >
                <X size={18} color="#94A3B8" />
              </TouchableOpacity>
            </View>

            {loading || prs === null ? (
              <ActivityIndicator color="#2563EB" style={{ marginVertical: 40 }} />
            ) : noPRs ? (
              <View className="bg-surface-2 dark:bg-zinc-800 p-8 items-center rounded-2xl">
                <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-sm text-center leading-5">
                  No completed sets yet.{"\n"}Finish a workout to see your PRs.
                </Text>
              </View>
            ) : (
              <View className="flex-row gap-3">
                <PRColumn label="Max Weight" set={prs!.maxWeight} />
                <PRColumn label="Max Reps" set={prs!.maxReps} />
                <PRColumn label="Max Volume" set={prs!.maxVolume} />
              </View>
            )}

            {!loading && !noPRs && sets.length > 0 && (
              <>
                <View className="flex-row items-center justify-between mt-8 mb-3">
                  <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs uppercase tracking-widest">
                    Recent Sets
                  </Text>
                  {sets.length <= 10 ? (
                    <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs">{sets.length} sets total</Text>
                  ) : (
                    <View className="flex-row gap-2">
                      {[10, 20, 30].map((n) => (
                        <TouchableOpacity
                          key={n}
                          onPress={() => setShown(n)}
                          activeOpacity={0.7}
                          className={`px-4 h-8 items-center justify-center rounded-full ${shown === n ? "bg-crimson dark:bg-blue-500" : "bg-surface-2 dark:bg-zinc-800"}`}
                        >
                          <Text className={`font-montserrat-semibold text-xs ${shown === n ? "text-white" : "text-text-primary dark:text-white"}`}>
                            {n}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
                <View className="bg-surface-2 dark:bg-zinc-800 rounded-2xl overflow-hidden">
                  <ScrollView style={{ maxHeight: 300 }} nestedScrollEnabled>
                    {sets.slice(0, shown).map((s, i, arr) => (
                      <View
                        key={i}
                        className={`flex-row items-center justify-between px-4 py-3.5 ${i < arr.length - 1 ? "border-b border-surface-3 dark:border-zinc-700" : ""}`}
                      >
                        <Text className="font-montserrat text-text-secondary dark:text-zinc-400 text-sm">{formatDate(s.achievedAt)}</Text>
                        <Text className="font-mono-medium text-text-primary dark:text-white text-sm">
                          {s.weightLbs ?? 0} lbs × {s.reps ?? 0}
                        </Text>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}
