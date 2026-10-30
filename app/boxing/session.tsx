import { useEffect } from "react";
import { View, Text, Alert, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useBoxingSession } from "../../src/hooks/useBoxingSession";
import { setupFromParams } from "../../src/utils/boxingRoute";
import { currentPhase, remainingSec, sessionProgress } from "../../src/utils/boxingTimer";
import { TimerControls } from "../../src/components/boxing/TimerControls";
import { TimerFace, PHASE_BG } from "../../src/components/boxing/TimerFace";

export default function BoxingSessionScreen() {
  const params = useLocalSearchParams();
  const b = useBoxingSession(setupFromParams(params));

  useEffect(() => { if (b.status === "none") router.back(); }, [b.status]);
  if (!b.timer) return <SafeAreaView className="flex-1 bg-obsidian dark:bg-zinc-950" />;

  const t = b.timer;
  const p = currentPhase(t);

  // TODO(Step 6.1): replace this stand-in with the finish sheet + save; right now ended sessions are just dropped.
  const leave = async () => { await b.clear(); router.back(); };
  const confirmEnd = () =>
    Alert.alert("End session?", "Rounds finished so far are kept.", [
      { text: "Keep Going", style: "cancel" },
      { text: "End", style: "destructive", onPress: () => b.endEarly() },
    ]);

  if (t.done) {
    return (
      <SafeAreaView className="flex-1 bg-obsidian dark:bg-zinc-950 items-center justify-center px-8">
        <Text className="font-montserrat-bold text-text-primary dark:text-white text-2xl mb-6">{t.endedEarly ? "Session ended" : "Session complete"}</Text>
        <TouchableOpacity onPress={leave} className="bg-crimson dark:bg-blue-500 py-4 px-10 rounded-2xl" activeOpacity={0.85}>
          <Text className="font-montserrat-bold text-white text-base">Close</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

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
      <TimerControls
        kind={p.kind}
        paused={!!t.paused}
        onPauseToggle={t.paused ? b.resume : b.pause}
        onSkipRest={b.skipRest}
        onAddThirty={b.addThirty}
        onEnd={confirmEnd}
      />
    </SafeAreaView>
  );
}
