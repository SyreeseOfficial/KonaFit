import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { createProgram } from "../../../src/db/programQueries";

export default function NewProgramScreen() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [weeks, setWeeks] = useState("");
  const [saving, setSaving] = useState(false);

  const canSave = name.trim().length > 0;

  const handleCreate = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const durationWeeks = weeks !== "" ? parseInt(weeks, 10) : undefined;
      const id = await createProgram(
        name,
        description || undefined,
        isNaN(durationWeeks!) ? undefined : durationWeeks
      );
      router.replace(`/programs/${id}` as never);
    } finally {
      setSaving(false);
    }
  };

  const labelClass = "font-mono text-text-muted text-xs tracking-widest uppercase mb-2";
  const inputClass = "bg-surface-2 px-3 py-3 font-montserrat text-white text-sm";

  return (
    <SafeAreaView className="flex-1 bg-obsidian">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View className="flex-row items-center gap-3 px-4 pt-4 pb-5 border-b border-surface-2">
          <TouchableOpacity onPress={() => router.back()} hitSlop={8} activeOpacity={0.7}>
            <ChevronLeft size={22} color="#A0A0A0" />
          </TouchableOpacity>
          <Text className="font-anton text-white text-xl tracking-widest uppercase flex-1">
            New Program
          </Text>
          <TouchableOpacity
            onPress={handleCreate}
            disabled={!canSave || saving}
            className={`px-4 py-2 ${canSave ? "bg-crimson" : "bg-surface-3"}`}
            activeOpacity={0.8}
          >
            <Text
              className={`font-montserrat-bold text-xs tracking-widest uppercase ${
                canSave ? "text-white" : "text-text-muted"
              }`}
            >
              {saving ? "Saving…" : "Create"}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1" contentContainerStyle={{ padding: 16, gap: 20 }}>
          <View>
            <Text className={labelClass}>Program Name *</Text>
            <TextInput
              className={inputClass}
              placeholder="e.g. Upper / Lower Split"
              placeholderTextColor="#606060"
              value={name}
              onChangeText={setName}
              autoFocus
              returnKeyType="next"
            />
          </View>

          <View>
            <Text className={labelClass}>Description</Text>
            <TextInput
              className={`${inputClass} min-h-16`}
              placeholder="Optional notes about this program…"
              placeholderTextColor="#606060"
              value={description}
              onChangeText={setDescription}
              multiline
            />
          </View>

          <View>
            <Text className={labelClass}>Duration (weeks)</Text>
            <TextInput
              className={inputClass}
              placeholder="e.g. 8"
              placeholderTextColor="#606060"
              value={weeks}
              onChangeText={setWeeks}
              keyboardType="number-pad"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
