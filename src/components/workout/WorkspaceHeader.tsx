import { useState } from "react";
import { View, Text, TouchableOpacity, Modal, Pressable } from "react-native";
import { Calculator, Pause, Play, RotateCcw, Camera, X } from "lucide-react-native";
import { useWorkoutTimer } from "../../hooks/useWorkoutTimer";

type Props = {
  startedAt: number;
  onFinish: () => void;
  onTools?: () => void;
  onCamera?: () => void;
};

const ADJUSTMENTS = [
  { label: "-30m", delta: -1800 },
  { label: "-5m", delta: -300 },
  { label: "-1m", delta: -60 },
  { label: "+1m", delta: 60 },
  { label: "+5m", delta: 300 },
  { label: "+30m", delta: 1800 },
];

export function WorkspaceHeader({ startedAt, onFinish, onTools, onCamera }: Props) {
  const { formattedTime, isPaused, pause, resume, reset, adjustElapsed } = useWorkoutTimer(startedAt);
  const [adjustOpen, setAdjustOpen] = useState(false);

  return (
    <>
      <View className="flex-row items-start justify-between px-4 pt-4 pb-4 border-b border-surface-2">
        <View>
          <Text className="font-anton text-white text-3xl tracking-widest uppercase">
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

            {onCamera && (
              <TouchableOpacity onPress={onCamera} hitSlop={8} activeOpacity={0.7}>
                <Camera size={17} color="#606060" />
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

            {/* Tappable timer — opens adjustment modal */}
            <TouchableOpacity onPress={() => setAdjustOpen(true)} hitSlop={4} activeOpacity={0.7}>
              <Text
                className={`font-mono-medium text-xl tracking-wider ${
                  isPaused ? "text-text-muted" : "text-white"
                }`}
              >
                {formattedTime}
              </Text>
            </TouchableOpacity>
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

      {/* Timer adjustment modal */}
      <Modal visible={adjustOpen} transparent animationType="fade" onRequestClose={() => setAdjustOpen(false)}>
        <Pressable className="flex-1 bg-black/70 justify-end" onPress={() => setAdjustOpen(false)}>
          <Pressable>
            <View className="bg-surface-2 px-4 pt-5 pb-10">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="font-mono text-text-muted text-xs tracking-widest uppercase">
                  Adjust Timer
                </Text>
                <TouchableOpacity onPress={() => setAdjustOpen(false)} hitSlop={8}>
                  <X size={18} color="#606060" />
                </TouchableOpacity>
              </View>

              <Text className="font-mono-medium text-white text-4xl tracking-widest text-center mb-5">
                {formattedTime}
              </Text>

              <View className="flex-row gap-2">
                {ADJUSTMENTS.map(({ label, delta }) => (
                  <TouchableOpacity
                    key={label}
                    onPress={() => adjustElapsed(delta)}
                    className={`flex-1 py-3 items-center ${delta < 0 ? "bg-surface-3" : "bg-surface-3"}`}
                    activeOpacity={0.7}
                  >
                    <Text className={`font-mono text-sm ${delta < 0 ? "text-text-secondary" : "text-crimson"}`}>
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text className="font-mono text-text-muted text-xs text-center mt-3">
                Tap timer anytime to adjust
              </Text>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
