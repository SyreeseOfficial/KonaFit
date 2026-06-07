import { View, Text, TouchableOpacity } from "react-native";
import { X } from "lucide-react-native";
import type { useRestTimer } from "../../hooks/useRestTimer";

type RestTimer = ReturnType<typeof useRestTimer>;

type Props = {
  timer: RestTimer;
};

export function RestTimerBar({ timer }: Props) {
  if (!timer.isRunning) return null;

  const progress = timer.remaining / timer.totalSeconds;

  return (
    <View className="bg-surface-2 border-t border-surface-3">
      {/* Progress bar */}
      <View className="h-0.5 bg-surface-3">
        <View
          className="h-0.5 bg-crimson"
          style={{ width: `${progress * 100}%` }}
        />
      </View>

      <View className="flex-row items-center justify-between px-4 py-3">
        <View>
          <Text className="font-mono text-text-muted text-xs tracking-widest uppercase">
            Rest
          </Text>
          <Text className="font-mono-medium text-white text-2xl tracking-wider">
            {timer.formattedTime}
          </Text>
        </View>

        <View className="flex-row items-center gap-3">
          <TouchableOpacity
            onPress={() => timer.adjust(-timer.STEP)}
            className="w-10 h-10 bg-surface-3 items-center justify-center"
            activeOpacity={0.7}
          >
            <Text className="font-montserrat-bold text-white text-sm">
              -{timer.STEP}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => timer.adjust(timer.STEP)}
            className="w-10 h-10 bg-surface-3 items-center justify-center"
            activeOpacity={0.7}
          >
            <Text className="font-montserrat-bold text-white text-sm">
              +{timer.STEP}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={timer.stop}
            className="w-10 h-10 bg-surface-3 items-center justify-center"
            activeOpacity={0.7}
          >
            <X size={16} color="#A0A0A0" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
