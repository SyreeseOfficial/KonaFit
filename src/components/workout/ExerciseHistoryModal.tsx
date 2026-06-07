import { useState, useEffect } from "react";
import { View, Text, Modal, Pressable, TouchableOpacity, ScrollView, ActivityIndicator } from "react-native";
import { X, Trophy } from "lucide-react-native";
import {
  getExercisePRs,
  getRecentExerciseSessions,
  type ExercisePRs,
  type ExerciseSession,
} from "../../db/historyQueries";

type Props = {
  visible: boolean;
  exerciseId: number;
  exerciseName: string;
  onClose: () => void;
};

function formatVolume(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K lbs`;
  return `${Math.round(v)} lbs`;
}

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function PRStat({ label, value, unit }: { label: string; value: string | null; unit?: string }) {
  return (
    <View className="flex-1 bg-surface-2 p-3 items-center">
      <Text className="font-mono text-text-muted text-xs tracking-widest uppercase mb-1">{label}</Text>
      {value != null ? (
        <View className="flex-row items-end gap-1">
          <Text className="font-mono-medium text-white text-xl">{value}</Text>
          {unit && <Text className="font-mono text-text-muted text-xs mb-0.5">{unit}</Text>}
        </View>
      ) : (
        <Text className="font-mono text-text-muted text-base">—</Text>
      )}
    </View>
  );
}

export function ExerciseHistoryModal({ visible, exerciseId, exerciseName, onClose }: Props) {
  const [prs, setPRs] = useState<ExercisePRs | null>(null);
  const [sessions, setSessions] = useState<ExerciseSession[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    Promise.all([
      getExercisePRs(exerciseId),
      getRecentExerciseSessions(exerciseId, 5),
    ]).then(([pr, sess]) => {
      setPRs(pr);
      setSessions(sess);
    }).finally(() => setLoading(false));
  }, [visible, exerciseId]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/60 justify-end" onPress={onClose}>
        <Pressable style={{ width: "100%" }}>
          <View className="bg-surface" style={{ maxHeight: "70%" }}>
            {/* Header */}
            <View className="flex-row items-center justify-between px-4 py-4 border-b border-surface-2">
              <View className="flex-1">
                <Text className="font-anton text-white text-lg tracking-widest uppercase" numberOfLines={1}>
                  {exerciseName}
                </Text>
                <View className="flex-row items-center gap-1.5 mt-0.5">
                  <Trophy size={11} color="#FF0000" />
                  <Text className="font-mono text-crimson text-xs tracking-widest uppercase">
                    Personal Records
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={onClose} hitSlop={8} activeOpacity={0.7}>
                <X size={20} color="#606060" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
              {loading ? (
                <ActivityIndicator color="#FF0000" style={{ marginTop: 24 }} />
              ) : (
                <>
                  {/* PR stats */}
                  <View className="flex-row gap-2 mb-5">
                    <PRStat
                      label="Max Weight"
                      value={prs?.maxWeightLbs != null ? String(prs.maxWeightLbs) : null}
                      unit="lbs"
                    />
                    <PRStat
                      label="Max Reps"
                      value={prs?.maxReps != null ? String(prs.maxReps) : null}
                      unit="reps"
                    />
                    <PRStat
                      label="Best Volume"
                      value={prs?.maxVolumePerSession != null ? formatVolume(prs.maxVolumePerSession) : null}
                    />
                  </View>

                  {/* Recent sessions */}
                  <Text className="font-mono text-text-muted text-xs tracking-widest uppercase mb-2">
                    Recent Sessions
                  </Text>

                  {sessions.length === 0 ? (
                    <View className="bg-surface-2 p-4 items-center">
                      <Text className="font-montserrat text-text-muted text-sm text-center">
                        No completed sessions yet.{"\n"}Finish a workout to see your history.
                      </Text>
                    </View>
                  ) : (
                    <View className="bg-surface-2">
                      {sessions.map((s, i) => (
                        <View
                          key={i}
                          className={`flex-row items-center px-3 py-3 ${i > 0 ? "border-t border-surface-3" : ""}`}
                        >
                          <View className="flex-1">
                            <Text className="font-montserrat-semibold text-white text-xs">
                              {formatDate(s.startedAt)}
                            </Text>
                            <Text className="font-mono text-text-muted text-xs mt-0.5">
                              {s.sets} sets · {s.totalReps} reps
                            </Text>
                          </View>
                          <View className="items-end">
                            {s.bestWeightLbs != null && (
                              <Text className="font-mono-medium text-white text-sm">
                                {s.bestWeightLbs} lbs
                              </Text>
                            )}
                            <Text className="font-mono text-text-muted text-xs">
                              {formatVolume(s.volume)}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
