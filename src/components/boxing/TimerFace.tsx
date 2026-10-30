import { View, Text } from "react-native";
import type { PhaseKind } from "../../utils/boxingTimer";
import { formatTime } from "../../utils/time";

type Props = {
  kind: PhaseKind;
  round: number;
  rounds: number;
  remainingSec: number;
  /** 0..1 across the whole session */
  progress: number;
  paused: boolean;
};

// Phase colors come from existing tokens: work = accent blue, rest = neutral surface, get ready = the amber already used for PR badges.
export const PHASE_BG: Record<PhaseKind, string> = {
  work: "bg-crimson dark:bg-blue-500",
  rest: "bg-surface-3 dark:bg-zinc-800",
  getReady: "bg-amber-500",
};
export const onColor = (k: PhaseKind) => (k === "rest" ? "text-text-primary dark:text-white" : "text-white");

export function phaseLabel(kind: PhaseKind, round: number, rounds: number): string {
  if (kind === "getReady") return "GET READY";
  if (kind === "rest") return "REST";
  return `ROUND ${round} OF ${rounds}`;
}

/** The big readable part of the timer screen. Background color is applied by the screen, which wraps this and the controls. */
export function TimerFace({ kind, round, rounds, remainingSec, progress, paused }: Props) {
  const text = onColor(kind);
  return (
    <View className="flex-1 items-center justify-center px-6">
      <Text className={`font-montserrat-bold tracking-widest text-2xl ${text}`}>{phaseLabel(kind, round, rounds)}</Text>
      <Text
        className={`font-mono-medium ${text}`}
        style={{ fontSize: 112, lineHeight: 128, opacity: paused ? 0.5 : 1 }}
        adjustsFontSizeToFit
        numberOfLines={1}
      >
        {formatTime(remainingSec)}
      </Text>
      <Text className={`font-montserrat-semibold tracking-widest text-sm ${text}`} style={{ opacity: paused ? 1 : 0 }}>
        PAUSED
      </Text>
      <View className="absolute left-0 right-0 bottom-0 h-1.5 bg-black/15">
        <View className="h-full bg-white/80" style={{ width: `${Math.round(progress * 100)}%` }} />
      </View>
    </View>
  );
}
