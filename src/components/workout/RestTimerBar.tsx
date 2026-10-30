import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, Modal, Pressable } from "react-native";
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";
import { X, Timer } from "lucide-react-native";
import type { useRestTimer } from "../../hooks/useRestTimer";

type RestTimer = ReturnType<typeof useRestTimer>;

type Props = {
  timer: RestTimer;
  onPick?: () => void;
};

function formatSeconds(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m > 0 && sec > 0) return `${m}m ${sec}s`;
  if (m > 0) return `${m}m`;
  return `${sec}s`;
}

const PRESETS = [60, 90, 120, 180];

function PresetChips({ timer, onPick }: Props) {
  return (
    <View className="flex-row gap-2 px-5 pb-3">
      {PRESETS.map((s) => {
        const active = timer.isRunning && timer.totalSeconds === s;
        return (
          <TouchableOpacity
            key={s}
            onPress={() => { timer.start(s); onPick?.(); }}
            className={`flex-1 h-11 items-center justify-center rounded-xl ${
              active ? "bg-crimson dark:bg-blue-500" : "bg-surface-2 dark:bg-zinc-800"
            }`}
            activeOpacity={0.7}
          >
            <Text
              className={`font-mono-medium text-sm ${active ? "text-white" : "text-text-primary dark:text-white"}`}
            >
              {formatSeconds(s)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** Header button: timer icon when idle, live countdown when running. Tap opens the rest sheet. */
export function RestTimerButton({ timer }: Props) {
  const [open, setOpen] = useState(false);
  const progress = timer.isRunning ? timer.remaining / timer.totalSeconds : 1;
  const anim = useSharedValue(progress);
  const barStyle = useAnimatedStyle(() => ({ width: `${anim.value * 100}%` }));

  useEffect(() => {
    anim.value = withTiming(progress, { duration: 900 });
  }, [progress]);

  return (
    <>
      <TouchableOpacity onPress={() => setOpen(true)} hitSlop={8} activeOpacity={0.7}>
        {timer.isRunning ? (
          <View className="flex-row items-center gap-1">
            <Timer size={16} color="#2563EB" />
            <Text className="font-mono-medium text-sm text-crimson dark:text-blue-500">
              {timer.formattedTime}
            </Text>
          </View>
        ) : (
          <Timer size={18} color="#94A3B8" />
        )}
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 bg-black/50 justify-end" onPress={() => setOpen(false)}>
          <Pressable>
            <View className="bg-surface dark:bg-zinc-900 rounded-t-3xl pt-5 pb-10 overflow-hidden">
              <View className="flex-row items-center justify-between px-5 mb-4">
                <Text className="font-montserrat-bold text-text-primary dark:text-white text-lg">
                  Rest Timer
                </Text>
                <TouchableOpacity onPress={() => setOpen(false)} hitSlop={8}>
                  <X size={20} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              {timer.isRunning ? (
                <>
                  <View className="h-1.5 bg-surface-2 dark:bg-zinc-800 mb-4">
                    <Animated.View className="h-1.5 bg-crimson dark:bg-blue-500" style={barStyle} />
                  </View>
                  <View className="flex-row items-center justify-between px-5 mb-4">
                    <Text className="font-mono-medium text-text-primary dark:text-white text-4xl tracking-wider">
                      {timer.formattedTime}
                    </Text>
                    <View className="flex-row items-center gap-2">
                      <TouchableOpacity
                        onPress={() => timer.adjust(-timer.STEP)}
                        className="w-11 h-11 bg-surface-2 dark:bg-zinc-800 items-center justify-center rounded-xl"
                        activeOpacity={0.7}
                      >
                        <Text className="font-montserrat-bold text-text-primary dark:text-white text-sm">-{timer.STEP}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => timer.adjust(timer.STEP)}
                        className="w-11 h-11 bg-surface-2 dark:bg-zinc-800 items-center justify-center rounded-xl"
                        activeOpacity={0.7}
                      >
                        <Text className="font-montserrat-bold text-text-primary dark:text-white text-sm">+{timer.STEP}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => { timer.stop(); setOpen(false); }}
                        className="h-11 px-4 bg-surface-2 dark:bg-zinc-800 items-center justify-center rounded-xl"
                        activeOpacity={0.7}
                      >
                        <Text className="font-montserrat-bold text-text-primary dark:text-white text-sm">Stop</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              ) : (
                <TouchableOpacity
                  onPress={() => { timer.start(); setOpen(false); }}
                  className="mx-5 mb-3 bg-crimson dark:bg-blue-500 py-4 items-center rounded-2xl"
                  activeOpacity={0.85}
                >
                  <Text className="font-montserrat-bold text-white text-base">
                    Start {formatSeconds(timer.totalSeconds)}
                  </Text>
                </TouchableOpacity>
              )}

              <PresetChips timer={timer} onPick={() => setOpen(false)} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
