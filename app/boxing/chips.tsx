import { useCallback, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { ChevronLeft, Eye, EyeOff, Pencil, Check } from "lucide-react-native";
import { getFocusChips, addFocusChip, renameFocusChip, setFocusChipHidden } from "../../src/db/boxingQueries";
import { BOXING_CHIP_GROUPS, type FocusChip } from "../../src/types/boxing";

const label = "font-montserrat-semibold text-text-muted dark:text-zinc-500 text-xs tracking-widest uppercase mb-2";

/** Add, rename and hide the focus chips used to tag rounds. Defaults can be hidden or renamed, never deleted. */
export default function ManageChipsScreen() {
  const [chips, setChips] = useState<FocusChip[]>([]);
  const [newName, setNewName] = useState("");
  const [newGroup, setNewGroup] = useState<string>(BOXING_CHIP_GROUPS[0]);
  const [editing, setEditing] = useState<{ id: number; text: string } | null>(null);

  const load = useCallback(() => { getFocusChips({ includeHidden: true }).then(setChips).catch(console.error); }, []);
  useFocusEffect(load);

  async function add() {
    const r = await addFocusChip(newName, newGroup);
    if (typeof r === "string") return Alert.alert("Can't add chip", r);
    setNewName("");
    load();
  }
  async function saveRename() {
    if (!editing) return;
    const err = await renameFocusChip(editing.id, editing.text);
    if (err) return Alert.alert("Can't rename", err);
    setEditing(null);
    load();
  }

  return (
    <SafeAreaView className="flex-1 bg-obsidian dark:bg-zinc-950">
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View className="flex-row items-center gap-3 px-5 pt-5 pb-5 border-b border-surface-2 dark:border-zinc-800">
          <TouchableOpacity onPress={() => router.back()} hitSlop={8} activeOpacity={0.7}><ChevronLeft size={22} color="#94A3B8" /></TouchableOpacity>
          <Text className="font-montserrat-bold text-text-primary dark:text-white text-xl flex-1">Focus chips</Text>
        </View>
        <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, gap: 24 }} keyboardShouldPersistTaps="handled">
          <View>
            <Text className={label}>New chip</Text>
            <TextInput
              className="bg-surface-2 dark:bg-zinc-800 px-4 py-3 font-montserrat text-text-primary dark:text-white text-base rounded-xl mb-3"
              placeholder="e.g. Slip" placeholderTextColor="#94A3B8" value={newName} onChangeText={setNewName} maxLength={24}
            />
            <View className="flex-row flex-wrap mb-3" style={{ gap: 8 }}>
              {BOXING_CHIP_GROUPS.map((g) => (
                <TouchableOpacity key={g} onPress={() => setNewGroup(g)} activeOpacity={0.7}
                  className={`px-4 py-2 rounded-full ${newGroup === g ? "bg-crimson dark:bg-blue-500" : "bg-surface-2 dark:bg-zinc-800"}`}>
                  <Text className={`font-montserrat-semibold text-sm ${newGroup === g ? "text-white" : "text-text-primary dark:text-white"}`}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity onPress={add} disabled={!newName.trim()} activeOpacity={0.85}
              className={`py-3.5 rounded-2xl items-center ${newName.trim() ? "bg-crimson dark:bg-blue-500" : "bg-surface-2 dark:bg-zinc-800"}`}>
              <Text className={`font-montserrat-bold text-base ${newName.trim() ? "text-white" : "text-text-muted dark:text-zinc-500"}`}>Add chip</Text>
            </TouchableOpacity>
          </View>

          {BOXING_CHIP_GROUPS.map((g) => (
            <View key={g}>
              <Text className={label}>{g}</Text>
              <View className="bg-surface dark:bg-zinc-900 rounded-2xl overflow-hidden">
                {chips.filter((c) => c.group === g).map((c, i) => (
                  <View key={c.id} className={`flex-row items-center px-4 py-3 ${i > 0 ? "border-t border-surface-2 dark:border-zinc-800" : ""}`}>
                    {editing?.id === c.id ? (
                      <>
                        <TextInput
                          className="flex-1 bg-surface-2 dark:bg-zinc-800 px-3 py-2 font-montserrat text-text-primary dark:text-white text-base rounded-lg"
                          value={editing.text} onChangeText={(text) => setEditing({ id: c.id, text })} autoFocus maxLength={24}
                        />
                        <TouchableOpacity onPress={saveRename} hitSlop={8} className="ml-4" accessibilityLabel="Save name"><Check size={18} color="#2563EB" /></TouchableOpacity>
                      </>
                    ) : (
                      <>
                        <Text className={`flex-1 font-montserrat-semibold text-base ${c.isHidden ? "text-text-muted dark:text-zinc-500 line-through" : "text-text-primary dark:text-white"}`}>{c.name}</Text>
                        <TouchableOpacity onPress={() => setEditing({ id: c.id, text: c.name })} hitSlop={8} className="ml-4" accessibilityLabel={`Rename ${c.name}`}><Pencil size={16} color="#94A3B8" /></TouchableOpacity>
                        <TouchableOpacity onPress={async () => { await setFocusChipHidden(c.id, !c.isHidden); load(); }} hitSlop={8} className="ml-4" accessibilityLabel={c.isHidden ? `Show ${c.name}` : `Hide ${c.name}`}>
                          {c.isHidden ? <EyeOff size={18} color="#94A3B8" /> : <Eye size={18} color="#64748B" />}
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                ))}
              </View>
            </View>
          ))}
          <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-sm">Hidden chips disappear from the picker but keep their name on rounds you already logged.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
