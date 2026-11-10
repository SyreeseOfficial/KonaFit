import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronDown, ChevronUp, Plus, X } from "lucide-react-native";
import { RpeRow } from "./RpeRow";
import { FocusChips } from "./FocusChips";
import { DateTimeFields } from "./DateTimeFields";
import { SESSION_TAGS, type BoxingRound, type BoxingSession, type FocusChip } from "../../types/boxing";
import { cleanClock } from "../../utils/numberInput";
import { initDateEdits, dateEditsToTimestamp, type InfoEdits } from "../../utils/dateEdit";
import { draftFromRound, draftToRound, newDraft, roundsDuration, type RoundDraft } from "../../utils/boxingEdit";
import { logError } from "../../utils/errors";

const label = "font-montserrat-semibold text-text-muted dark:text-zinc-500 text-xs tracking-widest uppercase mb-2";
const input = "bg-surface-2 dark:bg-zinc-800 px-4 py-3 font-montserrat text-text-primary dark:text-white text-base rounded-xl";
const timeInput = "bg-surface-2 dark:bg-zinc-800 px-3 py-2 font-mono-medium text-text-primary dark:text-white text-base rounded-lg text-center w-24";

type Props = {
  session: BoxingSession;
  /** Visible + hidden chips: hidden ones still show (and can be unselected) if a round uses them. */
  chips: FocusChip[];
  onCancel: () => void;
  onSave: (edited: BoxingSession) => Promise<void>;
};

/** Edit mode for a finished boxing session: info, overall RPE/tags/notes, and every round (RPE, focus, times, add/remove). */
export function BoxingEdit({ session, chips, onCancel, onSave }: Props) {
  const [name, setName] = useState(session.name);
  const [when, setWhen] = useState<InfoEdits>(() => initDateEdits(session.startedAt, 0));
  const [rpe, setRpe] = useState(session.rpe);
  const [tags, setTags] = useState(session.tags);
  const [notes, setNotes] = useState(session.notes ?? "");
  const [rounds, setRounds] = useState<RoundDraft[]>(() => session.rounds.map(draftFromRound));
  const [open, setOpen] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const patch = (i: number, p: Partial<RoundDraft>) => setRounds((rs) => rs.map((r, j) => (j === i ? { ...r, ...p } : r)));

  async function save() {
    const ts = dateEditsToTimestamp(when);
    if (!ts) return Alert.alert("Invalid date", "Please check the date and time.");
    const parsed = rounds.map((d, i) => draftToRound(d, i + 1));
    if (parsed.some((r) => r === null)) return Alert.alert("Invalid round time", "Use m:ss, like 3:00.");
    if (parsed.length === 0) return Alert.alert("No rounds", "A session needs at least one round. Delete the session instead.");
    const list = parsed as BoxingRound[];
    setSaving(true);
    try {
      await onSave({
        ...session, name: name.trim() || session.name, startedAt: ts.startedAt, durationSeconds: roundsDuration(list),
        rpe, tags, notes: notes.trim() || null, rounds: list,
      });
    } catch (e) {
      logError(e, "edit boxing session");
      setSaving(false);
      Alert.alert("Couldn't save", "Your edits are still here. Try again.");
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-obsidian dark:bg-zinc-950">
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View className="flex-row items-center gap-3 px-5 pt-5 pb-5 border-b border-surface-2 dark:border-zinc-800">
          <TouchableOpacity onPress={onCancel} hitSlop={8} activeOpacity={0.7}><X size={22} color="#94A3B8" /></TouchableOpacity>
          <Text className="font-montserrat-bold text-text-primary dark:text-white text-xl flex-1">Edit session</Text>
          <TouchableOpacity onPress={save} disabled={saving} className="bg-crimson dark:bg-blue-500 px-5 py-2.5 rounded-xl" activeOpacity={0.85}>
            <Text className="font-montserrat-bold text-white text-sm">{saving ? "Saving…" : "Save"}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, gap: 22 }} keyboardShouldPersistTaps="handled">
          <View><Text className={label}>Name</Text><TextInput className={input} value={name} onChangeText={setName} /></View>
          <View><Text className={label}>Started</Text><DateTimeFields value={when} onChange={setWhen} /></View>
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
          <View><Text className={label}>Notes</Text><TextInput className={`${input} min-h-16`} value={notes} onChangeText={setNotes} multiline placeholder="Optional" placeholderTextColor="#94A3B8" /></View>

          <View>
            <Text className={label}>Rounds</Text>
            <View style={{ gap: 8 }}>
              {rounds.map((r, i) => (
                <View key={i} className="bg-surface dark:bg-zinc-900 rounded-2xl overflow-hidden">
                  <View className="flex-row items-center px-4 py-3">
                    <TouchableOpacity onPress={() => setOpen(open === i ? null : i)} className="flex-1 flex-row items-center" activeOpacity={0.7}>
                      <Text className="font-montserrat-bold text-text-primary dark:text-white text-sm flex-1">
                        Round {i + 1}{r.rpe ? ` · RPE ${r.rpe}` : ""}
                      </Text>
                      {open === i ? <ChevronUp size={18} color="#94A3B8" /> : <ChevronDown size={18} color="#94A3B8" />}
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => { setRounds((rs) => rs.filter((_, j) => j !== i)); setOpen(null); }}
                      hitSlop={8} className="ml-4" accessibilityLabel={`Remove round ${i + 1}`} activeOpacity={0.7}
                    >
                      <X size={16} color="#F43F5E" />
                    </TouchableOpacity>
                  </View>
                  {open === i && (
                    <View className="px-4 pb-4" style={{ gap: 12 }}>
                      <RpeRow value={r.rpe} onChange={(v) => patch(i, { rpe: v })} />
                      <View className="flex-row items-center" style={{ gap: 10 }}>
                        <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-sm">Work</Text>
                        <TextInput className={timeInput} value={r.work} onChangeText={(v) => patch(i, { work: cleanClock(v) })} keyboardType="number-pad" />
                        <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-sm">Rest</Text>
                        <TextInput className={timeInput} value={r.rest} onChangeText={(v) => patch(i, { rest: cleanClock(v) })} keyboardType="number-pad" />
                      </View>
                      <FocusChips
                        chips={chips.filter((c) => !c.isHidden || r.focusTags.includes(c.id))}
                        selected={r.focusTags}
                        onToggle={(id) => patch(i, { focusTags: r.focusTags.includes(id) ? r.focusTags.filter((x) => x !== id) : [...r.focusTags, id] })}
                        note={r.focusNote}
                        onNoteChange={(v) => patch(i, { focusNote: v })}
                      />
                    </View>
                  )}
                </View>
              ))}
              <TouchableOpacity
                onPress={() => { setRounds((rs) => [...rs, newDraft(rs[rs.length - 1])]); setOpen(rounds.length); }}
                className="h-11 border border-surface-3 dark:border-zinc-700 rounded-xl items-center justify-center bg-surface dark:bg-zinc-900"
                accessibilityLabel="Add round" activeOpacity={0.7}
              >
                <Plus size={20} color="#64748B" />
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
