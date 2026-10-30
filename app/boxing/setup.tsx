import { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Pressable, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronLeft, Minus, Plus } from "lucide-react-native";
import { getLastSetup, getGetReadySec, setLastSetup, setGetReadySec } from "../../src/utils/boxingSettings";
import { validateSetup, parseClock, MIN_WORK_SEC, MAX_GET_READY_SEC, type TimerSetup } from "../../src/utils/boxingTimer";
import { cleanInt, cleanClock } from "../../src/utils/numberInput";
import { formatTime } from "../../src/utils/time";
import { sessionHref } from "../../src/utils/boxingRoute";
import { haptics } from "../../src/utils/haptics";

const MAX_ROUNDS = 99;
const MAX_CLOCK_SEC = 20 * 60;

/** "1:90" -> "2:30" once the field loses focus. */
const tidy = (t: string) => (Number.isFinite(parseClock(t)) ? formatTime(parseClock(t)) : t);

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const stepInt = (v: string, d: number, lo: number, hi: number) => String(clamp((parseInt(v, 10) || 0) + d, lo, hi));
const stepClock = (v: string, d: number, lo: number) => formatTime(clamp((Number.isFinite(parseClock(v)) ? parseClock(v) : 0) + d, lo, MAX_CLOCK_SEC));

/** Tap steps once; holding repeats, so 6 -> 12 rounds or 1:00 -> 3:00 doesn't take twenty taps. */
function StepButton({ onStep, label, size = 64, plus }: { onStep: () => void; label: string; size?: number; plus?: boolean }) {
  const hold = useRef<ReturnType<typeof setTimeout> | ReturnType<typeof setInterval> | null>(null);
  const stop = () => { if (hold.current) { clearTimeout(hold.current as never); clearInterval(hold.current as never); hold.current = null; } };
  useEffect(() => stop, []);
  const press = () => {
    haptics.tap();
    onStep();
    hold.current = setTimeout(() => {
      hold.current = setInterval(() => { haptics.tap(); onStep(); }, 90);
    }, 380);
  };
  const Icon = plus ? Plus : Minus;
  return (
    <Pressable
      onPressIn={press}
      onPressOut={stop}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{ width: size, height: size }}
      className="items-center justify-center rounded-2xl bg-surface-2 dark:bg-zinc-800 active:bg-surface-3 dark:active:bg-zinc-700"
    >
      <Icon size={size * 0.42} color="#94A3B8" strokeWidth={2.5} />
    </Pressable>
  );
}

type RowProps = {
  label: string;
  dot: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  onStep: (dir: 1 | -1) => void;
  decLabel: string;
  incLabel: string;
  unit?: string;
};

/** One setting: a big tappable number between − and +. Tap the number to type an exact value. */
function SettingRow({ label, dot, value, onChange, onBlur, onStep, decLabel, incLabel, unit }: RowProps) {
  return (
    <View className="flex-1 justify-center" style={{ minHeight: 112 }}>
      <View className="flex-row items-center mb-2" style={{ gap: 8 }}>
        <View className={`w-2.5 h-2.5 rounded-full ${dot}`} />
        <Text className="font-montserrat-semibold text-text-secondary dark:text-zinc-400 text-sm tracking-widest uppercase">{label}</Text>
      </View>
      <View className="flex-row items-center justify-between">
        <StepButton onStep={() => onStep(-1)} label={decLabel} />
        <View className="flex-1 flex-row items-baseline justify-center">
          <TextInput
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            keyboardType="number-pad"
            selectTextOnFocus
            accessibilityLabel={`${label}, tap to type`}
            className="font-mono-medium text-text-primary dark:text-white text-center"
            style={{ fontSize: 56, lineHeight: 68, minWidth: 130, paddingVertical: 0 }}
            maxLength={5}
          />
          {unit ? <Text className="font-montserrat-medium text-text-muted dark:text-zinc-500 text-base">{unit}</Text> : null}
        </View>
        <StepButton onStep={() => onStep(1)} label={incLabel} plus />
      </View>
    </View>
  );
}

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
    router.replace(sessionHref(setup));
  }

  const divider = "border-b border-surface-2 dark:border-zinc-800";

  return (
    <SafeAreaView className="flex-1 bg-obsidian dark:bg-zinc-950">
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View className={`flex-row items-center gap-3 px-5 pt-5 pb-5 ${divider}`}>
          <TouchableOpacity onPress={() => router.back()} hitSlop={8} activeOpacity={0.7} accessibilityLabel="Back">
            <ChevronLeft size={22} color="#94A3B8" />
          </TouchableOpacity>
          <Text className="font-montserrat-bold text-text-primary dark:text-white text-xl flex-1">Boxing</Text>
        </View>

        <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20 }} keyboardShouldPersistTaps="handled">
          <View className={divider} style={{ flex: 1 }}>
            <SettingRow
              label="Rounds" dot="bg-text-primary dark:bg-white"
              value={rounds}
              onChange={(v) => { const c = cleanInt(v, MAX_ROUNDS); if (c !== null) setRounds(c); }}
              onStep={(d) => setRounds((p) => stepInt(p, d, 1, MAX_ROUNDS))}
              decLabel="Fewer rounds" incLabel="More rounds"
            />
          </View>
          <View className={divider} style={{ flex: 1 }}>
            <SettingRow
              label="Work" dot="bg-crimson dark:bg-blue-500"
              value={work}
              onChange={(v) => setWork(cleanClock(v))} onBlur={() => setWork(tidy(work))}
              onStep={(d) => setWork((p) => stepClock(p, d * 5, MIN_WORK_SEC))}
              decLabel="Shorter work" incLabel="Longer work"
            />
          </View>
          <View className={divider} style={{ flex: 1 }}>
            <SettingRow
              label="Rest" dot="bg-surface-4 dark:bg-zinc-600"
              value={rest}
              onChange={(v) => setRest(cleanClock(v))} onBlur={() => setRest(tidy(rest))}
              onStep={(d) => setRest((p) => stepClock(p, d * 5, 0))}
              decLabel="Shorter rest" incLabel="Longer rest"
            />
          </View>
          <View className="flex-row items-center justify-between py-4">
            <View className="flex-row items-center" style={{ gap: 8 }}>
              <View className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <Text className="font-montserrat-semibold text-text-secondary dark:text-zinc-400 text-sm tracking-widest uppercase">Get ready</Text>
            </View>
            <View className="flex-row items-center" style={{ gap: 8 }}>
              <StepButton size={48} onStep={() => setReady((p) => stepInt(p, -5, 0, MAX_GET_READY_SEC))} label="Shorter get ready" />
              <View className="flex-row items-baseline justify-center" style={{ minWidth: 76 }}>
                <TextInput
                  value={ready}
                  onChangeText={(v) => { const c = cleanInt(v, MAX_GET_READY_SEC); if (c !== null) setReady(c); }}
                  keyboardType="number-pad"
                  selectTextOnFocus
                  accessibilityLabel="Get ready seconds, tap to type"
                  className="font-mono-medium text-text-primary dark:text-white text-2xl text-center"
                  style={{ paddingVertical: 0 }}
                  maxLength={2}
                />
                <Text className="font-montserrat-medium text-text-muted dark:text-zinc-500 text-sm">s</Text>
              </View>
              <StepButton size={48} plus onStep={() => setReady((p) => stepInt(p, 5, 0, MAX_GET_READY_SEC))} label="Longer get ready" />
            </View>
          </View>
        </ScrollView>

        <View className="flex-row items-center px-5 pb-6 pt-3" style={{ gap: 16 }}>
          <View>
            <Text className={`font-mono-medium text-3xl ${error ? "text-text-muted dark:text-zinc-500" : "text-text-primary dark:text-white"}`}>
              {total === null ? "--:--" : formatTime(total)}
            </Text>
            <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-xs">total</Text>
          </View>
          <TouchableOpacity
            onPress={start}
            disabled={!!error}
            accessibilityRole="button"
            accessibilityLabel={error ? `Can't start: ${error}` : "Start boxing"}
            className={`flex-1 py-4 rounded-2xl items-center ${error ? "bg-surface-2 dark:bg-zinc-800" : "bg-crimson dark:bg-blue-500"}`}
            activeOpacity={0.85}
          >
            <Text className={`font-montserrat-bold text-lg ${error ? "text-rose-500" : "text-white"}`} numberOfLines={1}>{error ?? "Start"}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
