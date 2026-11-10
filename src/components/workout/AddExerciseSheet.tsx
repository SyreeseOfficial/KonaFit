import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  Pressable,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Switch,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Search, X, ChevronDown, ChevronLeft, Check } from "lucide-react-native";
import { searchExercises, createCustomExercise } from "../../db/workoutQueries";
import type { Exercise } from "../../types/workout";

export const MUSCLE_GROUPS = [
  "Chest", "Front Delts", "Mid Delts", "Rear Delts",
  "Biceps", "Forearms", "Triceps", "Lats", "Upper Back",
  "Lower Back", "Abs", "Neck", "Glutes", "Quads",
  "Hamstrings", "Adductors", "Abductors", "Calves",
  "Olympic", "Full Body", "Other",
];

const EQUIPMENT_TYPES = [
  "Barbell", "Dumbbell", "Kettlebell", "Bodyweight",
  "Cable", "Machine", "Smith Machine", "Safety Bar",
  "Weight Plates", "Resistance Bands", "Jump Rope", "Cardio",
  "Battle Rope", "Medicine Ball", "Suspension Trainer",
  "Gymnastic Rings", "Parallettes", "Foam Roller",
  "Boxes", "Collars", "Other",
];

const TARGET_TYPES = [
  { key: "reps",     label: "Reps" },
  { key: "time",     label: "Time" },
  { key: "distance", label: "Distance" },
  { key: "weight",   label: "Weight" },
  { key: "calories", label: "Calories" },
];

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function FilterPicker({
  label, options, value, onSelect,
}: {
  label: string; options: string[]; value: string; onSelect: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const { height: screenHeight } = useWindowDimensions();
  const active = value !== "";

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        className={`flex-1 flex-row items-center justify-center gap-1.5 py-2.5 rounded-xl border ${
          active
            ? "border-crimson dark:border-blue-500 bg-blue-50 dark:bg-blue-950"
            : "border-surface-3 dark:border-zinc-700 bg-surface-2 dark:bg-zinc-800"
        }`}
        activeOpacity={0.7}
      >
        <Text
          className={`font-montserrat-semibold text-xs ${
            active ? "text-crimson dark:text-blue-400" : "text-text-secondary dark:text-zinc-400"
          }`}
          numberOfLines={1}
        >
          {active ? value : label}
        </Text>
        <ChevronDown size={12} color={active ? "#2563EB" : "#94A3B8"} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 bg-black/70 justify-center px-6" onPress={() => setOpen(false)}>
          <Pressable>
            <View className="bg-surface dark:bg-zinc-900 rounded-2xl overflow-hidden">
              <View className="flex-row items-center justify-between px-4 py-4 border-b border-surface-2 dark:border-zinc-800">
                <Text className="font-montserrat-bold text-text-primary dark:text-white text-base">
                  {label}
                </Text>
                <TouchableOpacity onPress={() => setOpen(false)} hitSlop={8}>
                  <X size={16} color="#94A3B8" />
                </TouchableOpacity>
              </View>
              <ScrollView
                style={{ maxHeight: screenHeight * 0.55 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={true}
                bounces={false}
              >
                <TouchableOpacity
                  onPress={() => { onSelect(""); setOpen(false); }}
                  className="px-4 py-4 border-b border-surface-2 dark:border-zinc-800"
                  activeOpacity={0.7}
                >
                  <Text className={`font-montserrat text-sm ${value === "" ? "text-crimson dark:text-blue-400" : "text-text-muted dark:text-zinc-500"}`}>
                    All
                  </Text>
                </TouchableOpacity>
                {options.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    onPress={() => { onSelect(opt); setOpen(false); }}
                    className="px-4 py-4 border-b border-surface-2 dark:border-zinc-800"
                    activeOpacity={0.7}
                  >
                    <Text className={`font-montserrat text-sm ${value === opt ? "text-crimson dark:text-blue-400" : "text-text-primary dark:text-white"}`}>
                      {opt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function ExerciseRow({
  item, onPress, multiSelect, selected,
}: {
  item: Exercise; onPress: () => void; multiSelect?: boolean; selected?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`flex-row items-center px-4 py-3.5 border-b border-surface-2 dark:border-zinc-800 ${
        selected ? "bg-blue-50 dark:bg-blue-950" : ""
      }`}
      activeOpacity={0.7}
    >
      <View
        className={`w-11 h-11 rounded-xl items-center justify-center mr-3 flex-shrink-0 ${
          selected ? "bg-crimson dark:bg-blue-500" : "bg-surface-2 dark:bg-zinc-800"
        }`}
      >
        {selected ? (
          <Check size={16} color="#FFFFFF" strokeWidth={2.5} />
        ) : (
          <Text className="font-montserrat-bold text-text-secondary dark:text-zinc-400 text-xs">
            {getInitials(item.name)}
          </Text>
        )}
      </View>

      <View className="flex-1">
        <Text
          className={`font-montserrat-semibold text-base mb-0.5 ${
            selected ? "text-crimson dark:text-blue-400" : "text-text-primary dark:text-white"
          }`}
          numberOfLines={1}
        >
          {item.name}
        </Text>
        <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs">
          {item.muscle_group} · {item.equipment_type}{item.use_count > 0 ? ` · ${item.use_count}×` : ""}
        </Text>
      </View>

      {multiSelect && (
        <View
          style={{
            width: 22, height: 22, borderRadius: 11,
            borderWidth: 2,
            borderColor: selected ? "#2563EB" : "#CBD5E1",
            backgroundColor: selected ? "#2563EB" : "transparent",
            alignItems: "center", justifyContent: "center",
            marginLeft: 12,
          }}
        >
          {selected && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
        </View>
      )}
    </TouchableOpacity>
  );
}

type Mode = "search" | "create";

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (exercise: Exercise) => void;
  multiSelect?: boolean;
};

const FULL_WIDTH = { width: "100%" } as const;
const SPINNER = { marginTop: 32 } as const;
const EMPTY_BOX = { alignItems: "center", marginTop: 48, paddingHorizontal: 24 } as const;

export function AddExerciseSheet({ visible, onClose, onSelect, multiSelect = false }: Props) {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>("search");
  const [query, setQuery] = useState("");
  const [muscleFilter, setMuscleFilter] = useState("");
  const [equipFilter, setEquipFilter] = useState("");
  const [results, setResults] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<Exercise[]>([]);

  const [createName, setCreateName] = useState("");
  const [createMuscles, setCreateMuscles] = useState<string[]>([]);
  const [createEquipments, setCreateEquipments] = useState<string[]>([]);
  const [createTargetType, setCreateTargetType] = useState("reps");
  const [createPerHand, setCreatePerHand] = useState(false);
  const [creating, setCreating] = useState(false);

  const runSearch = useCallback(async (q: string, mg: string, eq: string) => {
    setLoading(true);
    try {
      setResults(await searchExercises(q, mg || undefined, eq || undefined));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    runSearch(query, muscleFilter, equipFilter);
  }, [query, muscleFilter, equipFilter, visible, runSearch]);

  useEffect(() => {
    if (visible) {
      setQuery(""); setMuscleFilter(""); setEquipFilter(""); setMode("search"); setPending([]);
    }
  }, [visible]);

  const openCreate = () => {
    setCreateName(query.trim()); setCreateMuscles([]); setCreateEquipments([]); setCreateTargetType("reps"); setCreatePerHand(false); setMode("create");
  };

  const toggleMuscle = (mg: string) =>
    setCreateMuscles((prev) => prev.includes(mg) ? prev.filter((m) => m !== mg) : [...prev, mg]);

  const toggleEquipment = (eq: string) =>
    setCreateEquipments((prev) => prev.includes(eq) ? prev.filter((e) => e !== eq) : [...prev, eq]);

  const handleRowPress = useCallback((item: Exercise) => {
    if (!multiSelect) { onSelect(item); onClose(); return; }
    setPending((prev) =>
      prev.some((e) => e.id === item.id) ? prev.filter((e) => e.id !== item.id) : [...prev, item]
    );
  }, [multiSelect, onSelect, onClose]);

  const handleAddAll = useCallback(async () => {
    const toAdd = [...pending];
    setPending([]);
    for (const ex of toAdd) await Promise.resolve(onSelect(ex));
    onClose();
  }, [pending, onSelect, onClose]);

  const handleCreate = async () => {
    if (!createName.trim() || createMuscles.length === 0 || createEquipments.length === 0 || creating) return;
    setCreating(true);
    try {
      const exercise = await createCustomExercise(createName, createMuscles, createEquipments, createTargetType, createPerHand);
      if (multiSelect) { setPending((prev) => [...prev, exercise]); setMode("search"); }
      else { onSelect(exercise); onClose(); }
    } catch (e) {
      Alert.alert("Can't create exercise", e instanceof Error ? e.message : String(e));
    } finally { setCreating(false); }
  };

  const canCreate = createName.trim().length > 0 && createMuscles.length > 0 && createEquipments.length > 0;
  const sectionLabel = query || muscleFilter || equipFilter ? "Results" : "Most Used";
  const { height: screenHeight } = useWindowDimensions();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/50 justify-end" onPress={onClose}>
        <Pressable style={FULL_WIDTH}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View className="bg-surface dark:bg-zinc-900 rounded-t-3xl overflow-hidden" style={{ height: screenHeight * 0.88 }}>

              {/* ── Search mode ─────────────────────────────── */}
              {mode === "search" && (
                <View className="flex-1">
                  <View className="flex-row items-center px-5 pt-5 pb-4 border-b border-surface-2 dark:border-zinc-800">
                    <TouchableOpacity onPress={onClose} hitSlop={10} className="w-8">
                      <X size={20} color="#94A3B8" />
                    </TouchableOpacity>
                    <Text className="flex-1 text-center font-montserrat-bold text-text-primary dark:text-white text-lg">
                      {multiSelect ? "Select Exercises" : "Exercises"}
                    </Text>
                    <TouchableOpacity onPress={openCreate} hitSlop={10} className="w-20 items-end">
                      <Text className="font-montserrat-semibold text-crimson dark:text-blue-400 text-sm">
                        + New
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Search bar */}
                  <View className="mx-5 mt-4 mb-3 flex-row items-center bg-surface-2 dark:bg-zinc-800 px-4 py-3 rounded-2xl border border-surface-3 dark:border-zinc-700">
                    <Search size={16} color="#94A3B8" />
                    <TextInput
                      className="flex-1 font-montserrat text-text-primary dark:text-white text-base mx-3"
                      placeholder="Search exercises…"
                      placeholderTextColor="#94A3B8"
                      value={query}
                      onChangeText={setQuery}
                      autoCorrect={false}
                      returnKeyType="search"
                    />
                    {query.length > 0 && (
                      <TouchableOpacity onPress={() => setQuery("")} hitSlop={8}>
                        <X size={14} color="#94A3B8" />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Filter row */}
                  <View className="flex-row gap-2 mx-5 mb-3">
                    <FilterPicker label="Muscle Group" options={MUSCLE_GROUPS} value={muscleFilter} onSelect={setMuscleFilter} />
                    <FilterPicker label="Equipment" options={EQUIPMENT_TYPES} value={equipFilter} onSelect={setEquipFilter} />
                  </View>

                  {/* Section header */}
                  <View className="px-5 py-3 bg-obsidian dark:bg-zinc-950 flex-row items-center justify-between">
                    <Text className="font-montserrat-semibold text-text-muted dark:text-zinc-500 text-xs uppercase tracking-widest">
                      {sectionLabel}
                    </Text>
                    {multiSelect && pending.length > 0 && (
                      <TouchableOpacity onPress={() => setPending([])} hitSlop={8}>
                        <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs">
                          {pending.length} selected · Clear
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <View className="flex-1">
                    {loading ? (
                      <ActivityIndicator color="#2563EB" style={SPINNER} />
                    ) : (
                      <FlatList
                        data={results}
                        keyExtractor={(item) => String(item.id)}
                        keyboardShouldPersistTaps="handled"
                        renderItem={({ item }) => (
                          <ExerciseRow
                            item={item}
                            onPress={() => handleRowPress(item)}
                            multiSelect={multiSelect}
                            selected={pending.some((e) => e.id === item.id)}
                          />
                        )}
                        ListEmptyComponent={
                          <View style={EMPTY_BOX}>
                            <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-sm text-center">
                              {query || muscleFilter || equipFilter
                                ? "No exercises match your search"
                                : "No exercises yet"}
                            </Text>
                            {query.trim() !== "" && (
                              <TouchableOpacity
                                onPress={openCreate}
                                className="mt-4 h-11 px-5 rounded-xl bg-crimson dark:bg-blue-500 items-center justify-center"
                                activeOpacity={0.85}
                              >
                                <Text className="font-montserrat-bold text-white text-sm" numberOfLines={1}>
                                  Create “{query.trim()}”
                                </Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        }
                      />
                    )}
                  </View>

                  {/* Bottom bar */}
                  <View
                    className="border-t border-surface-2 dark:border-zinc-800 bg-surface dark:bg-zinc-900"
                    style={{ paddingBottom: insets.bottom }}
                  >
                    {multiSelect ? (
                      <TouchableOpacity
                        onPress={pending.length > 0 ? handleAddAll : onClose}
                        className={`py-4 items-center justify-center mx-5 my-3 rounded-2xl ${
                          pending.length > 0 ? "bg-crimson dark:bg-blue-500" : "bg-surface-2 dark:bg-zinc-800"
                        }`}
                        activeOpacity={0.85}
                      >
                        <Text
                          className={`font-montserrat-bold text-sm ${
                            pending.length > 0 ? "text-white" : "text-text-muted dark:text-zinc-500"
                          }`}
                        >
                          {pending.length > 0
                            ? `Add ${pending.length} Exercise${pending.length !== 1 ? "s" : ""}`
                            : "Tap exercises to select"}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              )}

              {/* ── Create mode ──────────────────────────────── */}
              {mode === "create" && (
                <View className="flex-1">
                  <View className="flex-row items-center px-5 pt-5 pb-4 border-b border-surface-2 dark:border-zinc-800">
                    <TouchableOpacity onPress={() => setMode("search")} hitSlop={8} className="w-8">
                      <ChevronLeft size={22} color="#94A3B8" />
                    </TouchableOpacity>
                    <Text className="flex-1 text-center font-montserrat-bold text-text-primary dark:text-white text-lg">
                      New Exercise
                    </Text>
                    <TouchableOpacity
                      onPress={handleCreate}
                      disabled={!canCreate || creating}
                      hitSlop={10}
                      className="w-20 items-end"
                    >
                      <Text className={`font-montserrat-semibold text-sm ${canCreate ? "text-crimson dark:text-blue-400" : "text-text-muted dark:text-zinc-500"}`}>
                        {creating ? "Saving…" : multiSelect ? "Add & Back" : "Save"}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 20 }}>
                    <View>
                      <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs uppercase tracking-widest mb-2">
                        Exercise Name *
                      </Text>
                      <TextInput
                        className="bg-surface-2 dark:bg-zinc-800 px-4 py-3.5 font-montserrat text-text-primary dark:text-white text-base rounded-xl border border-surface-3 dark:border-zinc-700"
                        placeholder="e.g. Hack Squat"
                        placeholderTextColor="#94A3B8"
                        value={createName}
                        onChangeText={setCreateName}
                        autoFocus
                        returnKeyType="done"
                      />
                    </View>

                    <View>
                      <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs uppercase tracking-widest mb-2">
                        Target Type
                      </Text>
                      <View className="flex-row flex-wrap gap-2">
                        {TARGET_TYPES.map((t) => (
                          <TouchableOpacity
                            key={t.key}
                            onPress={() => setCreateTargetType(t.key)}
                            className={`px-4 py-2.5 rounded-full border ${
                              createTargetType === t.key
                                ? "bg-crimson dark:bg-blue-500 border-crimson dark:border-blue-500"
                                : "bg-surface-2 dark:bg-zinc-800 border-surface-3 dark:border-zinc-700"
                            }`}
                            activeOpacity={0.7}
                          >
                            <Text className={`font-montserrat-semibold text-sm ${createTargetType === t.key ? "text-white" : "text-text-secondary dark:text-zinc-400"}`}>
                              {t.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    <View>
                      <View className="flex-row items-center justify-between mb-2">
                        <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs uppercase tracking-widest">
                          Muscle Groups *
                        </Text>
                        {createMuscles.length > 0 && (
                          <Text className="font-mono text-crimson dark:text-blue-400 text-xs">{createMuscles.length} selected</Text>
                        )}
                      </View>
                      <View className="flex-row flex-wrap gap-2">
                        {MUSCLE_GROUPS.map((mg) => {
                          const selected = createMuscles.includes(mg);
                          return (
                            <TouchableOpacity
                              key={mg}
                              onPress={() => toggleMuscle(mg)}
                              className={`px-4 py-2.5 rounded-full border ${selected ? "bg-crimson dark:bg-blue-500 border-crimson dark:border-blue-500" : "bg-surface-2 dark:bg-zinc-800 border-surface-3 dark:border-zinc-700"}`}
                              activeOpacity={0.7}
                            >
                              <Text className={`font-montserrat-semibold text-sm ${selected ? "text-white" : "text-text-secondary dark:text-zinc-400"}`}>
                                {mg}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>

                    <View>
                      <View className="flex-row items-center justify-between mb-2">
                        <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs uppercase tracking-widest">
                          Equipment *
                        </Text>
                        {createEquipments.length > 0 && (
                          <Text className="font-mono text-crimson dark:text-blue-400 text-xs">{createEquipments.length} selected</Text>
                        )}
                      </View>
                      <View className="flex-row flex-wrap gap-2">
                        {EQUIPMENT_TYPES.map((eq) => {
                          const selected = createEquipments.includes(eq);
                          return (
                            <TouchableOpacity
                              key={eq}
                              onPress={() => toggleEquipment(eq)}
                              className={`px-4 py-2.5 rounded-full border ${selected ? "bg-crimson dark:bg-blue-500 border-crimson dark:border-blue-500" : "bg-surface-2 dark:bg-zinc-800 border-surface-3 dark:border-zinc-700"}`}
                              activeOpacity={0.7}
                            >
                              <Text className={`font-montserrat-semibold text-sm ${selected ? "text-white" : "text-text-secondary dark:text-zinc-400"}`}>
                                {eq}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>

                    <View className="flex-row items-center justify-between">
                      <View className="flex-1 mr-3">
                        <Text className="font-montserrat-semibold text-text-primary dark:text-white text-sm">Weight is per hand</Text>
                        <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-xs mt-0.5">Dumbbells, single-arm cable. Volume counts both hands.</Text>
                      </View>
                      <Switch value={createPerHand} onValueChange={setCreatePerHand} />
                    </View>
                  </ScrollView>
                </View>
              )}

            </View>
          </KeyboardAvoidingView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
