import { useState, useCallback } from "react";
import { View, Text, TouchableOpacity, Modal, Pressable } from "react-native";
import { Calculator, Pause, Play, RotateCcw, Camera, X, Minus, Plus } from "lucide-react-native";
import { useWorkoutTimer } from "../../hooks/useWorkoutTimer";

type Props = {
  startedAt: number;
  onFinish: () => void;
  onTools?: () => void;
  onCamera?: () => void;
};

const MAX_MINS = 360;

const minuteLabel = (totalMins: number): string => {
  const h = Math.floor(totalMins / 60);
  const min = totalMins % 60;
  if (h === 0) return `${min}m`;
  if (min === 0) return `${h}h`;
  return `${h}h ${min}m`;
};

const ADJUSTMENTS = [-10, -5, -1, 1, 5, 10] as const;

export function WorkspaceHeader({ startedAt, onFinish, onTools, onCamera }: Props) {
  const { elapsed, formattedTime, isPaused, pause, resume, reset, setElapsed } = useWorkoutTimer(startedAt);
  const [adjustOpen, setAdjustOpen] = useState(false);
  // Target minutes shown in the picker — initialised when modal opens
  const [targetMins, setTargetMins] = useState(0);

  const openAdjust = useCallback(() => {
    setTargetMins(Math.min(MAX_MINS, Math.max(0, Math.round(elapsed / 60))));
    setAdjustOpen(true);
  }, [elapsed]);

  const changeTarget = useCallback((delta: number) => {
    setTargetMins((prev) => Math.max(0, Math.min(MAX_MINS, prev + delta)));
  }, []);

  const handleSetTime = useCallback(() => {
    setElapsed(targetMins * 60);
    setAdjustOpen(false);
  }, [targetMins, setElapsed]);

  return (
    <>
      <View className="flex-row items-center justify-between px-5 pt-4 pb-4 border-b border-surface-2 dark:border-zinc-800 bg-surface dark:bg-zinc-900">
        <Text className="font-montserrat-bold text-text-primary dark:text-white text-2xl">
          Train
        </Text>

        <View className="items-end gap-2">
          <View className="flex-row items-center gap-3">
            {onTools && (
              <TouchableOpacity onPress={onTools} hitSlop={8} activeOpacity={0.7}>
                <Calculator size={18} color="#94A3B8" />
              </TouchableOpacity>
            )}

            {onCamera && (
              <TouchableOpacity onPress={onCamera} hitSlop={8} activeOpacity={0.7}>
                <Camera size={18} color="#94A3B8" />
              </TouchableOpacity>
            )}

            {isPaused && (
              <TouchableOpacity onPress={reset} hitSlop={8} activeOpacity={0.7}>
                <RotateCcw size={16} color="#94A3B8" />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={isPaused ? resume : pause}
              hitSlop={8}
              activeOpacity={0.7}
            >
              {isPaused ? (
                <Play size={18} color="#2563EB" fill="#2563EB" />
              ) : (
                <Pause size={18} color="#94A3B8" />
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={openAdjust} hitSlop={4} activeOpacity={0.7}>
              <Text
                className={`font-mono-medium text-xl tracking-wider ${
                  isPaused ? "text-text-muted dark:text-zinc-500" : "text-text-primary dark:text-white"
                }`}
              >
                {formattedTime}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={onFinish}
            className="bg-crimson dark:bg-blue-500 px-5 py-2 rounded-xl"
            activeOpacity={0.85}
          >
            <Text className="font-montserrat-bold text-white text-sm">
              Finish
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Timer adjustment modal */}
      <Modal visible={adjustOpen} transparent animationType="fade" onRequestClose={() => setAdjustOpen(false)}>
        <Pressable className="flex-1 bg-black/50 justify-end" onPress={() => setAdjustOpen(false)}>
          <Pressable>
            <View className="bg-surface dark:bg-zinc-900 rounded-t-3xl px-5 pt-5 pb-10">
              <View className="flex-row items-center justify-between mb-6">
                <Text className="font-montserrat-bold text-text-primary dark:text-white text-lg">
                  Adjust Timer
                </Text>
                <TouchableOpacity onPress={() => setAdjustOpen(false)} hitSlop={8}>
                  <X size={20} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              {/* Target time display */}
              <Text className="font-mono-medium text-text-primary dark:text-white text-5xl tracking-widest text-center mb-2">
                {minuteLabel(targetMins)}
              </Text>
              <Text className="font-mono text-text-muted dark:text-zinc-500 text-sm text-center mb-8">
                Current: {formattedTime}
              </Text>

              {/* Decrement row */}
              <View className="flex-row gap-2 mb-3">
                {([-10, -5, -1] as const).map((delta) => (
                  <TouchableOpacity
                    key={delta}
                    onPress={() => changeTarget(delta)}
                    disabled={targetMins === 0}
                    className="flex-1 py-4 items-center bg-surface-2 dark:bg-zinc-800 rounded-2xl"
                    activeOpacity={0.7}
                  >
                    <Minus size={12} color="#64748B" />
                    <Text className="font-montserrat-bold text-text-primary dark:text-white text-sm mt-1">
                      {Math.abs(delta)}m
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Increment row */}
              <View className="flex-row gap-2 mb-6">
                {([1, 5, 10] as const).map((delta) => (
                  <TouchableOpacity
                    key={delta}
                    onPress={() => changeTarget(delta)}
                    disabled={targetMins >= MAX_MINS}
                    className="flex-1 py-4 items-center bg-surface-2 dark:bg-zinc-800 rounded-2xl"
                    activeOpacity={0.7}
                  >
                    <Plus size={12} color="#64748B" />
                    <Text className="font-montserrat-bold text-text-primary dark:text-white text-sm mt-1">
                      {delta}m
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                onPress={handleSetTime}
                className="bg-crimson dark:bg-blue-500 py-4 items-center rounded-2xl"
                activeOpacity={0.85}
              >
                <Text className="font-montserrat-bold text-white text-base">
                  Set Timer
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
