import { useState } from "react";
import { View, Text, Modal, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { RpeRow } from "./RpeRow";
import { SESSION_TAGS } from "../../types/boxing";
import type { FinishInput } from "../../utils/boxingSave";

type Props = {
  visible: boolean;
  defaultName: string;
  roundCount: number;
  saving: boolean;
  initialTags: string[];
  onSave: (input: FinishInput) => void;
  onDiscard: () => void;
};

/** Shown when a session ends (naturally or early): overall effort, what it was, a note and a name. Everything is optional. */
export function FinishSheet({ visible, defaultName, roundCount, saving, initialTags, onSave, onDiscard }: Props) {
  const [name, setName] = useState(defaultName);
  const [rpe, setRpe] = useState<number | null>(null);
  const [tags, setTags] = useState<string[]>(initialTags);
  const [notes, setNotes] = useState("");
  const canSave = roundCount > 0 && !saving;
  const label = "font-montserrat-semibold text-text-muted dark:text-zinc-500 text-xs tracking-widest uppercase mb-2";

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => {}}>
      <KeyboardAvoidingView className="flex-1 justify-end bg-black/50" behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View className="bg-surface dark:bg-zinc-900 rounded-t-3xl" style={{ maxHeight: "90%" }}>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }} keyboardShouldPersistTaps="handled">
            <View>
              <Text className="font-montserrat-bold text-text-primary dark:text-white text-xl">Session done</Text>
              <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-sm mt-1">
                {roundCount === 0 ? "No rounds were completed." : `${roundCount} round${roundCount === 1 ? "" : "s"} logged.`}
              </Text>
            </View>
            {roundCount > 0 && (
              <>
                <View>
                  <Text className={label}>How did it feel overall? (RPE)</Text>
                  <RpeRow value={rpe} onChange={setRpe} />
                </View>
                <View>
                  <Text className={label}>What was it?</Text>
                  <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                    {SESSION_TAGS.map((t) => {
                      const on = tags.includes(t);
                      return (
                        <TouchableOpacity
                          key={t}
                          onPress={() => setTags(on ? tags.filter((x) => x !== t) : [...tags, t])}
                          className={`px-4 py-2.5 rounded-xl ${on ? "bg-crimson dark:bg-blue-500" : "bg-surface-2 dark:bg-zinc-800"}`}
                          activeOpacity={0.7}
                        >
                          <Text className={`font-montserrat-semibold text-sm ${on ? "text-white" : "text-text-primary dark:text-white"}`}>{t}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
                <View>
                  <Text className={label}>Name</Text>
                  <TextInput className="bg-surface-2 dark:bg-zinc-800 px-4 py-3 font-montserrat text-text-primary dark:text-white text-base rounded-xl" value={name} onChangeText={setName} />
                </View>
                <View>
                  <Text className={label}>Notes</Text>
                  <TextInput
                    className="bg-surface-2 dark:bg-zinc-800 px-4 py-3 font-montserrat text-text-primary dark:text-white text-base rounded-xl min-h-16"
                    placeholder="Optional" placeholderTextColor="#94A3B8" value={notes} onChangeText={setNotes} multiline
                  />
                </View>
              </>
            )}
            <View style={{ gap: 10 }}>
              {roundCount > 0 && (
                <TouchableOpacity
                  onPress={() => onSave({ name, rpe, tags, notes })}
                  disabled={!canSave}
                  className={`py-4 rounded-2xl items-center ${canSave ? "bg-crimson dark:bg-blue-500" : "bg-surface-2 dark:bg-zinc-800"}`}
                  activeOpacity={0.85}
                >
                  <Text className={`font-montserrat-bold text-base ${canSave ? "text-white" : "text-text-muted dark:text-zinc-500"}`}>{saving ? "Saving…" : "Save"}</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onDiscard} disabled={saving} className="py-3 items-center" activeOpacity={0.7}>
                <Text className="font-montserrat-semibold text-rose-500 text-sm">Discard session</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
