import { View, Text, TouchableOpacity } from "react-native";
import { Calculator, Pause, Play, RotateCcw } from "lucide-react-native";
import { useWorkoutTimer } from "../../hooks/useWorkoutTimer";

type Props = {
  startedAt: number;
  onFinish: () => void;
  onTools?: () => void;
};

export function WorkspaceHeader({ startedAt, onFinish, onTools }: Props) {
  const { formattedTime, isPaused, pause, resume, reset } = useWorkoutTimer(startedAt);

  return (
    <View className="flex-row items-start justify-between px-4 pt-2 pb-3 border-b border-surface-2">
      <View>
        <Text className="font-anton text-white text-3xl tracking-widest uppercase">
          The Workspace
        </Text>
        <Text className="font-mono text-text-muted text-xs tracking-widest uppercase">
          Train
        </Text>
      </View>

      <View className="items-end gap-2">
        {/* Timer row */}
        <View className="flex-row items-center gap-3">
          {onTools && (
            <TouchableOpacity onPress={onTools} hitSlop={8} activeOpacity={0.7}>
              <Calculator size={17} color="#606060" />
            </TouchableOpacity>
          )}

          {/* Reset — only show when paused */}
          {isPaused && (
            <TouchableOpacity onPress={reset} hitSlop={8} activeOpacity={0.7}>
              <RotateCcw size={15} color="#606060" />
            </TouchableOpacity>
          )}

          {/* Pause / Resume */}
          <TouchableOpacity
            onPress={isPaused ? resume : pause}
            hitSlop={8}
            activeOpacity={0.7}
          >
            {isPaused ? (
              <Play size={17} color="#FF0000" fill="#FF0000" />
            ) : (
              <Pause size={17} color="#606060" />
            )}
          </TouchableOpacity>

          <Text
            className={`font-mono-medium text-xl tracking-wider ${
              isPaused ? "text-text-muted" : "text-white"
            }`}
          >
            {formattedTime}
          </Text>
        </View>

        {/* Finish button */}
        <TouchableOpacity
          onPress={onFinish}
          className="bg-crimson px-4 py-1.5"
          activeOpacity={0.8}
        >
          <Text className="font-montserrat-bold text-white text-xs tracking-widest uppercase">
            Finish
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
