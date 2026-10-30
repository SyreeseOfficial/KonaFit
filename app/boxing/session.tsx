import { useEffect } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useBoxingSession } from "../../src/hooks/useBoxingSession";
import { setupFromParams } from "../../src/utils/boxingRoute";
import { currentPhase, remainingSec, sessionProgress } from "../../src/utils/boxingTimer";
import { TimerFace, PHASE_BG } from "../../src/components/boxing/TimerFace";

export default function BoxingSessionScreen() {
  const params = useLocalSearchParams();
  const b = useBoxingSession(setupFromParams(params));

  useEffect(() => { if (b.status === "none") router.back(); }, [b.status]);
  if (!b.timer) return <SafeAreaView className="flex-1 bg-obsidian dark:bg-zinc-950" />;

  const t = b.timer;
  const p = currentPhase(t);
  return (
    <SafeAreaView className={`flex-1 ${PHASE_BG[p.kind]}`}>
      <View className="flex-1">
        <TimerFace
          kind={p.kind}
          round={p.round}
          rounds={t.setup.rounds}
          remainingSec={remainingSec(t, b.now)}
          progress={sessionProgress(t, b.now)}
          paused={!!t.paused}
        />
      </View>
    </SafeAreaView>
  );
}
