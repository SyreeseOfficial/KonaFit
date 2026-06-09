import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Pressable,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronLeft, ChevronDown, Check } from "lucide-react-native";
import { createProgram } from "../../../src/db/programQueries";
import type { ProgramType } from "../../../src/types/program";

const PROGRAM_TYPES: { key: ProgramType; label: string; desc: string }[] = [
  { key: "single",     label: "Single Workout", desc: "One-off session template" },
  { key: "weekly",     label: "Weekly Program",  desc: "Repeating weekly schedule" },
  { key: "multi_week", label: "Multi-Week",       desc: "Progressive multi-week plan" },
];

const FOCUS_OPTIONS = [
  "Strength", "Hypertrophy", "Athletics", "Powerlifting",
  "Olympic Weightlifting", "Bodyweight Fitness", "Cardio", "Mobility", "Other",
];

const EQUIPMENT_OPTIONS = [
  "Full Gym", "Garage Gym", "Home Gym",
  "Dumbbells Only", "Bodyweight Only", "Resistance Bands",
];

const DIFFICULTY_OPTIONS = ["Beginner", "Intermediate", "Advanced", "Elite"];

const DURATION_OPTIONS = [
  ...Array.from({ length: 18 }, (_, i) => ({
    value: (i + 1) * 10,
    label: `${(i + 1) * 10} min`,
  })),
  { value: 210, label: "3.5 hrs" },
  { value: 240, label: "4+ hrs" },
];

export default function NewProgramScreen() {
  const [programType, setProgramType] = useState<ProgramType>("weekly");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [weeks, setWeeks] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [duration, setDuration] = useState<number | null>(null);
  const [focusTags, setFocusTags] = useState<string[]>([]);
  const [equipment, setEquipment] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<string | null>(null);
  const [durationPickerOpen, setDurationPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const canSave = name.trim().length > 0;

  const handleCreate = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      const parsedWeeks = weeks !== "" ? parseInt(weeks, 10) : undefined;
      const id = await createProgram(name, {
        description: description.trim() || undefined,
        durationWeeks: programType === "multi_week" && parsedWeeks && !isNaN(parsedWeeks) ? parsedWeeks : undefined,
        programType,
        workoutDurationMin: duration ?? undefined,
        focusTags: focusTags.length > 0 ? focusTags : undefined,
        equipment: equipment ?? undefined,
        difficulty: difficulty ?? undefined,
      });
      router.replace(`/programs/${id}` as never);
    } finally {
      setSaving(false);
    }
  };

  const toggleFocus = (tag: string) =>
    setFocusTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );

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

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 20, gap: 28 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Program Type */}
          <View>
            <Text className={labelClass}>Program Type</Text>
            <View style={{ gap: 8 }}>
              {PROGRAM_TYPES.map((pt) => (
                <TouchableOpacity
                  key={pt.key}
                  onPress={() => setProgramType(pt.key)}
                  className={`flex-row items-center px-4 py-3.5 border ${
                    programType === pt.key
                      ? "border-crimson bg-surface-2"
                      : "border-surface-3 bg-surface"
                  }`}
                  activeOpacity={0.7}
                >
                  <View
                    style={{
                      width: 16, height: 16, borderRadius: 8,
                      borderWidth: 2,
                      borderColor: programType === pt.key ? "#CC2200" : "#404040",
                      marginRight: 12,
                      alignItems: "center", justifyContent: "center",
                    }}
                  >
                    {programType === pt.key && (
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#CC2200" }} />
                    )}
                  </View>
                  <View className="flex-1">
                    <Text
                      className={`font-montserrat-bold text-sm ${
                        programType === pt.key ? "text-white" : "text-text-secondary"
                      }`}
                    >
                      {pt.label}
                    </Text>
                    <Text className="font-montserrat text-text-muted text-xs mt-0.5">{pt.desc}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Name */}
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

          {/* Description */}
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

          {/* Weeks — only for multi_week */}
          {programType === "multi_week" && (
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
          )}

          {/* Advanced toggle */}
          <TouchableOpacity
            onPress={() => setShowAdvanced((v) => !v)}
            className="flex-row items-center gap-2"
            activeOpacity={0.7}
          >
            <ChevronDown
              size={16}
              color="#A0A0A0"
              style={{ transform: [{ rotate: showAdvanced ? "180deg" : "0deg" }] }}
            />
            <Text className="font-montserrat-semibold text-text-secondary text-sm tracking-wider">
              Advanced Settings
            </Text>
            {(duration || focusTags.length > 0 || equipment || difficulty) ? (
              <View className="w-1.5 h-1.5 bg-crimson rounded-full ml-1" />
            ) : null}
          </TouchableOpacity>

          {showAdvanced && (
            <>
              {/* Workout Duration */}
              <View>
                <Text className={labelClass}>Workout Duration</Text>
                <TouchableOpacity
                  onPress={() => setDurationPickerOpen(true)}
                  className="bg-surface-2 px-3 py-3 flex-row items-center justify-between"
                  activeOpacity={0.7}
                >
                  <Text
                    className={`font-montserrat text-sm ${
                      duration ? "text-white" : "text-text-muted"
                    }`}
                  >
                    {duration
                      ? DURATION_OPTIONS.find((d) => d.value === duration)?.label ?? `${duration} min`
                      : "Select duration…"}
                  </Text>
                  <ChevronDown size={16} color="#606060" />
                </TouchableOpacity>
              </View>

              {/* Training Focus (multi-select) */}
              <View>
                <Text className={labelClass}>Training Focus</Text>
                <Text className="font-montserrat text-text-muted text-xs mb-2.5">
                  Select all that apply
                </Text>
                <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                  {FOCUS_OPTIONS.map((tag) => (
                    <TouchableOpacity
                      key={tag}
                      onPress={() => toggleFocus(tag)}
                      className={`px-3 py-2 ${
                        focusTags.includes(tag) ? "bg-crimson" : "bg-surface-2"
                      }`}
                      activeOpacity={0.7}
                    >
                      <Text
                        className={`font-mono text-xs ${
                          focusTags.includes(tag) ? "text-white" : "text-text-secondary"
                        }`}
                      >
                        {tag}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Equipment Required (single select) */}
              <View>
                <Text className={labelClass}>Equipment Required</Text>
                <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                  {EQUIPMENT_OPTIONS.map((eq) => (
                    <TouchableOpacity
                      key={eq}
                      onPress={() => setEquipment(equipment === eq ? null : eq)}
                      className={`px-3 py-2 ${
                        equipment === eq ? "bg-crimson" : "bg-surface-2"
                      }`}
                      activeOpacity={0.7}
                    >
                      <Text
                        className={`font-mono text-xs ${
                          equipment === eq ? "text-white" : "text-text-secondary"
                        }`}
                      >
                        {eq}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Difficulty (single select) */}
              <View>
                <Text className={labelClass}>Difficulty</Text>
                <View className="flex-row" style={{ gap: 8 }}>
                  {DIFFICULTY_OPTIONS.map((diff) => (
                    <TouchableOpacity
                      key={diff}
                      onPress={() => setDifficulty(difficulty === diff ? null : diff)}
                      style={{ flex: 1 }}
                      className={`py-2.5 items-center ${
                        difficulty === diff ? "bg-crimson" : "bg-surface-2"
                      }`}
                      activeOpacity={0.7}
                    >
                      <Text
                        className={`font-mono text-xs ${
                          difficulty === diff ? "text-white" : "text-text-secondary"
                        }`}
                      >
                        {diff}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </>
          )}

          <View style={{ height: 16 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Duration picker modal */}
      <Modal
        visible={durationPickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setDurationPickerOpen(false)}
      >
        <Pressable
          className="flex-1 bg-black/60 justify-end"
          onPress={() => setDurationPickerOpen(false)}
        >
          <Pressable>
            <View className="bg-surface-2 pb-10">
              <View className="flex-row items-center justify-between px-4 py-4 border-b border-surface-3">
                <Text className="font-anton text-white text-base tracking-widest uppercase">
                  Workout Duration
                </Text>
                <TouchableOpacity
                  onPress={() => { setDuration(null); setDurationPickerOpen(false); }}
                  hitSlop={8}
                >
                  <Text className="font-mono text-text-muted text-xs tracking-widest">CLEAR</Text>
                </TouchableOpacity>
              </View>
              <FlatList
                data={DURATION_OPTIONS}
                keyExtractor={(item) => String(item.value)}
                style={{ maxHeight: 300 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => { setDuration(item.value); setDurationPickerOpen(false); }}
                    className={`flex-row items-center justify-between px-4 py-4 border-b border-surface-3 ${
                      duration === item.value ? "bg-surface-3" : ""
                    }`}
                    activeOpacity={0.7}
                  >
                    <Text
                      className={`font-montserrat text-sm ${
                        duration === item.value ? "text-white" : "text-text-secondary"
                      }`}
                    >
                      {item.label}
                    </Text>
                    {duration === item.value && <Check size={16} color="#CC2200" />}
                  </TouchableOpacity>
                )}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
