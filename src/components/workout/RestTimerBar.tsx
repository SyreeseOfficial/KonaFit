import { View, Text, TouchableOpacity } from "react-native";
import { X, Timer } from "lucide-react-native";
import type { useRestTimer } from "../../hooks/useRestTimer";

type RestTimer = ReturnType<typeof useRestTimer>;

type Props = {
  timer: RestTimer;
};

function formatSeconds(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m > 0 && sec > 0) return `${m}m ${sec}s`;
  if (m > 0) return `${m}m`;
  return `${sec}s`;
}

export function RestTimerBar({ timer }: Props) {
  if (!timer.isRunning) {
    return (
      <TouchableOpacity
        onPress={() => timer.start()}
        activeOpacity={0.7}
        className="flex-row items-center gap-2 px-5 py-3 border-t border-surface-2 dark:border-zinc-800 bg-surface dark:bg-zinc-900"
      >
        <Timer size={15} color="#64748B" />
        <Text className="font-montserrat-semibold text-text-secondary dark:text-zinc-400 text-sm">
          Rest Timer
        </Text>
        <Text className="font-mono text-text-muted dark:text-zinc-500 text-sm ml-1">
          {formatSeconds(timer.totalSeconds)}
        </Text>
      </TouchableOpacity>
    );
  }

  const progress = timer.remaining / timer.totalSeconds;

  return (
    <View className="bg-surface dark:bg-zinc-900 border-t border-surface-2 dark:border-zinc-800">
      {/* Progress bar */}
      <View className="h-1 bg-surface-2 dark:bg-zinc-800">
        <View
          className="h-1 bg-crimson dark:bg-blue-500"
          style={{ width: `${progress * 100}%` }}
        />
      </View>

      <View className="flex-row items-center justify-between px-5 py-3">
        <View>
          <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-xs">
            Rest
          </Text>
          <Text className="font-mono-medium text-text-primary dark:text-white text-2xl tracking-wider">
            {timer.formattedTime}
          </Text>
        </View>

        <View className="flex-row items-center gap-2">
          <TouchableOpacity
            onPress={() => timer.adjust(-timer.STEP)}
            className="w-10 h-10 bg-surface-2 dark:bg-zinc-800 items-center justify-center rounded-xl"
            activeOpacity={0.7}
          >
            <Text className="font-montserrat-bold text-text-primary dark:text-white text-sm">
              -{timer.STEP}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => timer.adjust(timer.STEP)}
            className="w-10 h-10 bg-surface-2 dark:bg-zinc-800 items-center justify-center rounded-xl"
            activeOpacity={0.7}
          >
            <Text className="font-montserrat-bold text-text-primary dark:text-white text-sm">
              +{timer.STEP}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={timer.stop}
            className="w-10 h-10 bg-surface-2 dark:bg-zinc-800 items-center justify-center rounded-xl"
            activeOpacity={0.7}
          >
            <X size={16} color="#94A3B8" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
