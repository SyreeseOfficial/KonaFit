import { useEffect } from "react";
import { Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useBoxingSession } from "../../src/hooks/useBoxingSession";
import { setupFromParams } from "../../src/utils/boxingRoute";
import { currentPhase, remainingSec } from "../../src/utils/boxingTimer";

// Skeleton: debug readout. The real face arrives in Step 4.2.
export default function BoxingSessionScreen() {
  const params = useLocalSearchParams();
  const b = useBoxingSession(setupFromParams(params));

  useEffect(() => { if (b.status === "none") router.back(); }, [b.status]);
  if (!b.timer) return <SafeAreaView className="flex-1 bg-obsidian dark:bg-zinc-950" />;

  const p = currentPhase(b.timer);
  return (
    <SafeAreaView className="flex-1 bg-obsidian dark:bg-zinc-950 items-center justify-center">
      <Text className="font-montserrat text-text-primary dark:text-white">{p.kind} {p.round}</Text>
      <Text className="font-mono-medium text-text-primary dark:text-white text-4xl">{remainingSec(b.timer, b.now)}</Text>
      {b.timer.done && <Text className="font-montserrat text-text-primary dark:text-white">done</Text>}
    </SafeAreaView>
  );
}
