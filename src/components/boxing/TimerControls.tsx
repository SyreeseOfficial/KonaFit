import { View, Text, TouchableOpacity } from "react-native";
import { Pause, Play, SkipForward, Plus, Square } from "lucide-react-native";
import type { PhaseKind } from "../../utils/boxingTimer";
import { onColor } from "./TimerFace";

type Props = {
  kind: PhaseKind;
  paused: boolean;
  onPauseToggle: () => void;
  onSkipRest: () => void;
  onAddThirty: () => void;
  onEnd: () => void;
};

/** Pause/resume (big), skip rest (rest only), +30s, end early. Buttons are translucent so they sit on any phase color. */
export function TimerControls({ kind, paused, onPauseToggle, onSkipRest, onAddThirty, onEnd }: Props) {
  const text = onColor(kind);
  const iconColor = kind === "rest" ? "#64748B" : "#FFFFFF";
  const small = "flex-1 h-14 rounded-2xl items-center justify-center flex-row gap-2 bg-black/15";
  return (
    <View className="px-5 pb-6" style={{ gap: 12 }}>
      <TouchableOpacity
        onPress={onPauseToggle}
        accessibilityLabel={paused ? "Resume" : "Pause"}
        className="h-20 rounded-3xl items-center justify-center flex-row gap-3 bg-black/25"
        activeOpacity={0.8}
      >
        {paused ? <Play size={28} color={iconColor} /> : <Pause size={28} color={iconColor} />}
        <Text className={`font-montserrat-bold text-xl ${text}`}>{paused ? "Resume" : "Pause"}</Text>
      </TouchableOpacity>
      <View className="flex-row" style={{ gap: 12 }}>
        {kind === "rest" && (
          <TouchableOpacity onPress={onSkipRest} accessibilityLabel="Skip rest" className={small} activeOpacity={0.8}>
            <SkipForward size={18} color={iconColor} />
            <Text className={`font-montserrat-semibold text-sm ${text}`}>Skip rest</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={onAddThirty} accessibilityLabel="Add 30 seconds" className={small} activeOpacity={0.8}>
          <Plus size={18} color={iconColor} />
          <Text className={`font-montserrat-semibold text-sm ${text}`}>30s</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onEnd} accessibilityLabel="End session" className={small} activeOpacity={0.8}>
          <Square size={16} color={iconColor} />
          <Text className={`font-montserrat-semibold text-sm ${text}`}>End</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
