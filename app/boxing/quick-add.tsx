import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { RpeRow } from "../../src/components/boxing/RpeRow";
import { DateTimeFields } from "../../src/components/boxing/DateTimeFields";
import { SESSION_TAGS } from "../../src/types/boxing";
import { initDateEdits, dateEditsToTimestamp } from "../../src/utils/dateEdit";
import { parseClock } from "../../src/utils/boxingTimer";
import { buildQuickSession } from "../../src/utils/boxingQuickAdd";
import { saveBoxingSession } from "../../src/db/boxingQueries";
import { APP_VERSION } from "../../src/utils/appVersion";
import { cleanInt, cleanClock } from "../../src/utils/numberInput";

const label = "font-montserrat-semibold text-text-muted dark:text-zinc-500 text-xs tracking-widest uppercase mb-2";
const input = "bg-surface-2 dark:bg-zinc-800 px-4 py-3 font-mono-medium text-text-primary dark:text-white text-lg rounded-xl";

/** Log a boxing session that already happened: when, how many rounds, work/rest (or just total time), effort, what it was. */
export default function QuickAddBoxing() {
  const [when, setWhen] = useState(() => initDateEdits(Math.floor(Date.now() / 1000), 0));
  const [mode, setMode] = useState<"plan" | "total">("plan");
  const [rounds, setRounds] = useState("6");
  const [work, setWork] = useState("3:00");
  const [rest, setRest] = useState("1:00");
  const [totalMin, setTotalMin] = useState("");
  const [rpe, setRpe] = useState<number | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  async function save() {
    const ts = dateEditsToTimestamp(when);
    if (!ts) return Alert.alert("Invalid date", "Please check the date and time.");
    const built = buildQuickSession({
      startedAt: ts.startedAt, rounds: parseInt(rounds, 10), mode, workSec: parseClock(work), restSec: parseClock(rest),
      totalSec: (parseInt(totalMin, 10) || 0) * 60, rpe, tags,
    });
    if (typeof built === "string") return Alert.alert("Check the session", built);
    setSaving(true);
    try {
      const id = await saveBoxingSession(built, APP_VERSION);
      router.replace(`/workout/${id}` as never);
    } catch (e) {
      console.error(e);
      setSaving(false);
      Alert.alert("Couldn't save", "Nothing was lost. Try again.");
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-obsidian dark:bg-zinc-950">
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View className="flex-row items-center gap-3 px-5 pt-5 pb-5 border-b border-surface-2 dark:border-zinc-800">
          <TouchableOpacity onPress={() => router.back()} hitSlop={8} activeOpacity={0.7}><ChevronLeft size={22} color="#94A3B8" /></TouchableOpacity>
          <Text className="font-montserrat-bold text-text-primary dark:text-white text-xl flex-1">Log past boxing</Text>
          <TouchableOpacity onPress={save} disabled={saving} className="bg-crimson dark:bg-blue-500 px-5 py-2.5 rounded-xl" activeOpacity={0.85}>
            <Text className="font-montserrat-bold text-white text-sm">{saving ? "Saving…" : "Save"}</Text>
          </TouchableOpacity>
        </View>
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, gap: 22 }} keyboardShouldPersistTaps="handled">
          <View><Text className={label}>Started</Text><DateTimeFields value={when} onChange={setWhen} /></View>
          <View>
            <Text className={label}>Rounds</Text>
            <TextInput className={input} value={rounds} onChangeText={(v) => { const c = cleanInt(v, 99); if (c !== null) setRounds(c); }} keyboardType="number-pad" />
          </View>
          <View className="flex-row" style={{ gap: 8 }}>
            {([["plan", "Work / rest"], ["total", "Total time"]] as const).map(([m, t]) => (
              <TouchableOpacity key={m} onPress={() => setMode(m)} className={`px-4 py-2 rounded-full ${mode === m ? "bg-crimson dark:bg-blue-500" : "bg-surface-2 dark:bg-zinc-800"}`} activeOpacity={0.7}>
                <Text className={`font-montserrat-semibold text-sm ${mode === m ? "text-white" : "text-text-primary dark:text-white"}`}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {mode === "plan" ? (
            <View className="flex-row" style={{ gap: 12 }}>
              <View className="flex-1"><Text className={label}>Work (m:ss)</Text><TextInput className={input} value={work} onChangeText={(v) => setWork(cleanClock(v))} keyboardType="number-pad" /></View>
              <View className="flex-1"><Text className={label}>Rest (m:ss)</Text><TextInput className={input} value={rest} onChangeText={(v) => setRest(cleanClock(v))} keyboardType="number-pad" /></View>
            </View>
          ) : (
            <View><Text className={label}>Total minutes</Text><TextInput className={input} value={totalMin} onChangeText={(v) => { const c = cleanInt(v, 600); if (c !== null) setTotalMin(c); }} keyboardType="number-pad" placeholder="e.g. 30" placeholderTextColor="#94A3B8" /></View>
          )}
          <View><Text className={label}>Overall RPE</Text><RpeRow value={rpe} onChange={setRpe} /></View>
          <View>
            <Text className={label}>What was it?</Text>
            <View className="flex-row flex-wrap" style={{ gap: 8 }}>
              {SESSION_TAGS.map((t) => {
                const on = tags.includes(t);
                return (
                  <TouchableOpacity key={t} onPress={() => setTags(on ? tags.filter((x) => x !== t) : [...tags, t])} className={`px-4 py-2.5 rounded-xl ${on ? "bg-crimson dark:bg-blue-500" : "bg-surface-2 dark:bg-zinc-800"}`} activeOpacity={0.7}>
                    <Text className={`font-montserrat-semibold text-sm ${on ? "text-white" : "text-text-primary dark:text-white"}`}>{t}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
