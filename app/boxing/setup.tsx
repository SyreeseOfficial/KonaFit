import { useEffect, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { getLastSetup, getGetReadySec, setLastSetup, setGetReadySec } from "../../src/utils/boxingSettings";
import { validateSetup, parseClock, type TimerSetup } from "../../src/utils/boxingTimer";
import { cleanInt } from "../../src/utils/numberInput";
import { formatTime } from "../../src/utils/time";
import { haptics } from "../../src/utils/haptics";

// [work, rest] in seconds
const PRESETS: [number, number][] = [[180, 60], [120, 30], [180, 30], [120, 60], [60, 30]];

const labelClass = "font-montserrat-semibold text-text-muted dark:text-zinc-500 text-xs tracking-widest uppercase mb-2";
const inputClass = "bg-surface-2 dark:bg-zinc-800 px-4 py-3 font-mono-medium text-text-primary dark:text-white text-lg rounded-xl";

export default function BoxingSetupScreen() {
  const [rounds, setRounds] = useState("6");
  const [work, setWork] = useState("3:00");
  const [rest, setRest] = useState("1:00");
  const [ready, setReady] = useState("10");

  // Start from what was used last time.
  useEffect(() => {
    Promise.all([getLastSetup(), getGetReadySec()]).then(([p, g]) => {
      setRounds(String(p.rounds));
      setWork(formatTime(p.workSec));
      setRest(formatTime(p.restSec));
      setReady(String(g));
    });
  }, []);

  const setup: TimerSetup = {
    rounds: parseInt(rounds, 10), workSec: parseClock(work), restSec: parseClock(rest), getReadySec: parseInt(ready, 10),
  };
  const error = validateSetup(setup);
  const total = error ? null : setup.rounds * setup.workSec + (setup.rounds - 1) * setup.restSec;

  async function start() {
    if (error) return;
    haptics.tap();
    await Promise.all([setLastSetup({ rounds: setup.rounds, workSec: setup.workSec, restSec: setup.restSec }), setGetReadySec(setup.getReadySec)]);
    router.replace({
      pathname: "/boxing/session",
      params: { rounds, workSec: String(setup.workSec), restSec: String(setup.restSec), getReadySec: ready },
    } as never);
  }

  return (
    <SafeAreaView className="flex-1 bg-obsidian dark:bg-zinc-950">
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View className="flex-row items-center gap-3 px-5 pt-5 pb-5 border-b border-surface-2 dark:border-zinc-800">
          <TouchableOpacity onPress={() => router.back()} hitSlop={8} activeOpacity={0.7}>
            <ChevronLeft size={22} color="#94A3B8" />
          </TouchableOpacity>
          <Text className="font-montserrat-bold text-text-primary dark:text-white text-xl flex-1">Boxing</Text>
        </View>

        <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, gap: 24 }} keyboardShouldPersistTaps="handled">
          <View>
            <Text className={labelClass}>Presets</Text>
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {PRESETS.map(([w, r]) => {
                const active = parseClock(work) === w && parseClock(rest) === r;
                return (
                  <TouchableOpacity
                    key={`${w}/${r}`}
                    onPress={() => { setWork(formatTime(w)); setRest(formatTime(r)); }}
                    className={`px-4 py-3 rounded-xl border ${active ? "border-crimson dark:border-blue-500 bg-blue-50 dark:bg-blue-950" : "border-surface-3 dark:border-zinc-700 bg-surface dark:bg-zinc-900"}`}
                    activeOpacity={0.7}
                  >
                    <Text className={`font-mono-medium text-sm ${active ? "text-crimson dark:text-blue-400" : "text-text-primary dark:text-white"}`}>
                      {formatTime(w)} / {formatTime(r)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View>
            <Text className={labelClass}>Rounds</Text>
            <TextInput className={inputClass} value={rounds} onChangeText={(v) => { const c = cleanInt(v, 99); if (c !== null) setRounds(c); }} keyboardType="number-pad" />
          </View>
          <View className="flex-row" style={{ gap: 12 }}>
            <View className="flex-1">
              <Text className={labelClass}>Work (m:ss)</Text>
              <TextInput className={inputClass} value={work} onChangeText={setWork} keyboardType="numbers-and-punctuation" />
            </View>
            <View className="flex-1">
              <Text className={labelClass}>Rest (m:ss)</Text>
              <TextInput className={inputClass} value={rest} onChangeText={setRest} keyboardType="numbers-and-punctuation" />
            </View>
          </View>
          <View>
            <Text className={labelClass}>Get ready (seconds, 0 to 60)</Text>
            <TextInput className={inputClass} value={ready} onChangeText={(v) => { const c = cleanInt(v, 999); if (c !== null) setReady(c); }} keyboardType="number-pad" />
          </View>

          <Text className={`font-montserrat text-sm ${error ? "text-rose-500" : "text-text-muted dark:text-zinc-500"}`}>
            {error ?? `${setup.rounds} rounds · ${formatTime(total!)} of boxing`}
          </Text>
        </ScrollView>

        <View className="px-5 pb-6 pt-3">
          <TouchableOpacity
            onPress={start}
            disabled={!!error}
            className={`py-4 rounded-2xl items-center ${error ? "bg-surface-2 dark:bg-zinc-800" : "bg-crimson dark:bg-blue-500"}`}
            activeOpacity={0.85}
          >
            <Text className={`font-montserrat-bold text-base ${error ? "text-text-muted dark:text-zinc-500" : "text-white"}`}>Start</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
