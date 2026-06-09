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
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Search, X, ChevronDown, ChevronLeft, Check } from "lucide-react-native";
import { searchExercises, createCustomExercise } from "../../db/workoutQueries";
import type { Exercise } from "../../types/workout";

// ─── Constants ────────────────────────────────────────────────────────────────

const MUSCLE_GROUPS = [
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

// ─── Filter Picker ────────────────────────────────────────────────────────────

function FilterPicker({
  label,
  options,
  value,
  onSelect,
}: {
  label: string;
  options: string[];
  value: string;
  onSelect: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const { height: screenHeight } = useWindowDimensions();
  const active = value !== "";

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        className={`flex-1 flex-row items-center justify-center gap-1.5 py-2 border ${
          active ? "border-crimson bg-surface-2" : "border-surface-3 bg-surface-2"
        }`}
        activeOpacity={0.7}
      >
        <Text
          className={`font-montserrat-semibold text-xs tracking-wider ${
            active ? "text-crimson" : "text-text-secondary"
          }`}
          numberOfLines={1}
        >
          {active ? value : label}
        </Text>
        <ChevronDown size={12} color={active ? "#FF0000" : "#A0A0A0"} />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable className="flex-1 bg-black/70 justify-center px-6" onPress={() => setOpen(false)}>
          <Pressable>
            <View className="bg-surface-2" style={{ borderRadius: 4 }}>
              {/* Header */}
              <View className="flex-row items-center justify-between px-4 py-3.5 border-b border-surface-3">
                <Text className="font-montserrat-bold text-white text-xs tracking-widest uppercase">
                  {label}
                </Text>
                <TouchableOpacity onPress={() => setOpen(false)} hitSlop={8}>
                  <X size={16} color="#606060" />
                </TouchableOpacity>
              </View>
              {/* Scrollable options */}
              <ScrollView
                style={{ maxHeight: screenHeight * 0.55 }}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={true}
                bounces={false}
              >
                <TouchableOpacity
                  onPress={() => { onSelect(""); setOpen(false); }}
                  className="px-4 py-3.5 border-b border-surface-3"
                  activeOpacity={0.7}
                >
                  <Text className={`font-montserrat text-sm ${value === "" ? "text-crimson" : "text-text-muted"}`}>
                    All
                  </Text>
                </TouchableOpacity>
                {options.map((opt) => (
                  <TouchableOpacity
                    key={opt}
                    onPress={() => { onSelect(opt); setOpen(false); }}
                    className="px-4 py-3.5 border-b border-surface-3"
                    activeOpacity={0.7}
                  >
                    <Text className={`font-montserrat text-sm ${value === opt ? "text-crimson" : "text-white"}`}>
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

// ─── Exercise Row ─────────────────────────────────────────────────────────────

function ExerciseRow({
  item,
  onPress,
  multiSelect,
  selected,
}: {
  item: Exercise;
  onPress: () => void;
  multiSelect?: boolean;
  selected?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`flex-row items-center px-4 py-3 border-b border-surface-2 ${
        selected ? "bg-surface-2" : ""
      }`}
      activeOpacity={0.7}
    >
      {/* Initials avatar */}
      <View
        className="w-12 h-12 items-center justify-center mr-3 flex-shrink-0"
        style={{ backgroundColor: selected ? "#CC2200" : "#2A2A2A" }}
      >
        {selected ? (
          <Check size={18} color="#FFFFFF" strokeWidth={2.5} />
        ) : (
          <Text className="font-montserrat-bold text-text-secondary text-sm">
            {getInitials(item.name)}
          </Text>
        )}
      </View>

      {/* Name + meta */}
      <View className="flex-1">
        <Text
          className={`font-montserrat-semibold text-sm mb-0.5 ${selected ? "text-white" : "text-white"}`}
          numberOfLines={1}
        >
          {item.name}
        </Text>
        <Text className="font-mono text-text-muted text-xs tracking-wider">
          {item.muscle_group} · {item.equipment_type}
        </Text>
      </View>

      {/* Right side */}
      {multiSelect ? (
        <View
          style={{
            width: 22, height: 22, borderRadius: 11,
            borderWidth: 2,
            borderColor: selected ? "#CC2200" : "#404040",
            backgroundColor: selected ? "#CC2200" : "transparent",
            alignItems: "center", justifyContent: "center",
            marginLeft: 12,
          }}
        >
          {selected && <Check size={12} color="#FFFFFF" strokeWidth={3} />}
        </View>
      ) : (
        item.use_count > 0 && (
          <View className="items-end ml-3">
            <Text className="font-mono text-text-muted text-xs">{item.use_count} times</Text>
          </View>
        )
      )}
    </TouchableOpacity>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type Mode = "search" | "create";

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (exercise: Exercise) => void;
  multiSelect?: boolean;
};

export function AddExerciseSheet({ visible, onClose, onSelect, multiSelect = false }: Props) {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>("search");
  const [query, setQuery] = useState("");
  const [muscleFilter, setMuscleFilter] = useState("");
  const [equipFilter, setEquipFilter] = useState("");
  const [results, setResults] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState<Exercise[]>([]);

  // Create form
  const [createName, setCreateName] = useState("");
  const [createMuscles, setCreateMuscles] = useState<string[]>([]);
  const [createEquipments, setCreateEquipments] = useState<string[]>([]);
  const [createTargetType, setCreateTargetType] = useState("reps");
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
      setQuery("");
      setMuscleFilter("");
      setEquipFilter("");
      setMode("search");
      setPending([]);
    }
  }, [visible]);

  const openCreate = () => {
    setCreateName(query.trim());
    setCreateMuscles([]);
    setCreateEquipments([]);
    setCreateTargetType("reps");
    setMode("create");
  };

  const toggleMuscle = (mg: string) =>
    setCreateMuscles((prev) =>
      prev.includes(mg) ? prev.filter((m) => m !== mg) : [...prev, mg]
    );

  const toggleEquipment = (eq: string) =>
    setCreateEquipments((prev) =>
      prev.includes(eq) ? prev.filter((e) => e !== eq) : [...prev, eq]
    );

  const handleRowPress = useCallback((item: Exercise) => {
    if (!multiSelect) {
      onSelect(item);
      onClose();
      return;
    }
    setPending((prev) =>
      prev.some((e) => e.id === item.id)
        ? prev.filter((e) => e.id !== item.id)
        : [...prev, item]
    );
  }, [multiSelect, onSelect, onClose]);

  const handleAddAll = useCallback(async () => {
    const toAdd = [...pending];
    setPending([]);
    for (const ex of toAdd) {
      await Promise.resolve(onSelect(ex));
    }
    onClose();
  }, [pending, onSelect, onClose]);

  const handleCreate = async () => {
    if (!createName.trim() || createMuscles.length === 0 || createEquipments.length === 0 || creating) return;
    setCreating(true);
    try {
      const exercise = await createCustomExercise(
        createName,
        createMuscles,
        createEquipments,
        createTargetType
      );
      if (multiSelect) {
        setPending((prev) => [...prev, exercise]);
        setMode("search");
      } else {
        onSelect(exercise);
        onClose();
      }
    } finally {
      setCreating(false);
    }
  };

  const canCreate =
    createName.trim().length > 0 &&
    createMuscles.length > 0 &&
    createEquipments.length > 0;
  const sectionLabel = query || muscleFilter || equipFilter ? "Results" : "All Exercises";
  const { height: screenHeight } = useWindowDimensions();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/50 justify-end" onPress={onClose}>
        <Pressable style={{ width: "100%" }}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View className="bg-surface" style={{ height: screenHeight * 0.88 }}>

              {/* ══ Search mode ══════════════════════════════════════ */}
              {mode === "search" && (
                <View className="flex-1">
                  {/* Header */}
                  <View className="flex-row items-center px-4 pt-4 pb-3">
                    <TouchableOpacity onPress={onClose} hitSlop={10} className="w-8">
                      <X size={20} color="#A0A0A0" />
                    </TouchableOpacity>
                    <Text className="flex-1 text-center font-anton text-white text-lg tracking-widest uppercase">
                      {multiSelect ? "Select Exercises" : "Exercises"}
                    </Text>
                    <TouchableOpacity onPress={openCreate} hitSlop={10} className="w-20 items-end">
                      <Text className="font-montserrat-semibold text-crimson text-sm">
                        Create New
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Search bar */}
                  <View className="mx-4 mb-3 flex-row items-center bg-surface-2 border border-surface-3 px-3 py-2.5" style={{ borderRadius: 24 }}>
                    <Search size={16} color="#606060" />
                    <TextInput
                      className="flex-1 font-montserrat text-white text-sm mx-2"
                      placeholder="Search exercise name"
                      placeholderTextColor="#606060"
                      value={query}
                      onChangeText={setQuery}
                      autoCorrect={false}
                      returnKeyType="search"
                    />
                    {query.length > 0 && (
                      <TouchableOpacity onPress={() => setQuery("")} hitSlop={8}>
                        <X size={14} color="#606060" />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Filter row */}
                  <View className="flex-row gap-2 mx-4 mb-1">
                    <FilterPicker
                      label="All Muscle Groups"
                      options={MUSCLE_GROUPS}
                      value={muscleFilter}
                      onSelect={setMuscleFilter}
                    />
                    <FilterPicker
                      label="All Equipment"
                      options={EQUIPMENT_TYPES}
                      value={equipFilter}
                      onSelect={setEquipFilter}
                    />
                  </View>

                  {/* Section label */}
                  <View className="px-4 py-2 bg-obsidian mt-2 flex-row items-center justify-between">
                    <Text className="font-montserrat-semibold text-text-muted text-xs tracking-widest uppercase">
                      {sectionLabel}
                    </Text>
                    {multiSelect && pending.length > 0 && (
                      <TouchableOpacity onPress={() => setPending([])} hitSlop={8}>
                        <Text className="font-mono text-text-muted text-xs">
                          {pending.length} selected · Clear
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Exercise list */}
                  <View className="flex-1">
                    {loading ? (
                      <ActivityIndicator color="#FF0000" style={{ marginTop: 32 }} />
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
                          <View style={{ alignItems: "center", marginTop: 48, paddingHorizontal: 24 }}>
                            <Text className="font-montserrat text-text-muted text-sm text-center">
                              {query || muscleFilter || equipFilter
                                ? "No exercises match your search"
                                : "No exercises yet"}
                            </Text>
                          </View>
                        }
                      />
                    )}
                  </View>

                  {/* Bottom bar — paddingBottom accounts for Android system nav bar */}
                  <View
                    className="border-t border-surface-2 bg-surface"
                    style={{ paddingBottom: insets.bottom }}
                  >
                    {multiSelect ? (
                      <TouchableOpacity
                        onPress={pending.length > 0 ? handleAddAll : onClose}
                        className={`py-4 items-center justify-center ${
                          pending.length > 0 ? "bg-crimson" : ""
                        }`}
                        activeOpacity={0.8}
                      >
                        <Text
                          className={`font-montserrat-bold text-sm tracking-wider ${
                            pending.length > 0 ? "text-white" : "text-text-muted"
                          }`}
                        >
                          {pending.length > 0
                            ? `Add ${pending.length} Exercise${pending.length !== 1 ? "s" : ""}`
                            : "Tap exercises to select"}
                        </Text>
                      </TouchableOpacity>
                    ) : (
                      <View className="flex-row">
                        <TouchableOpacity
                          className="flex-1 py-4 items-center justify-center border-r border-surface-2"
                          activeOpacity={0.7}
                        >
                          <Text className="font-montserrat-bold text-white text-sm tracking-wider">
                            Add as Superset
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          className="flex-1 py-4 items-center justify-center bg-crimson"
                          activeOpacity={0.8}
                          onPress={onClose}
                        >
                          <Text className="font-montserrat-bold text-white text-sm tracking-wider">
                            Done
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {/* ══ Create mode ══════════════════════════════════════ */}
              {mode === "create" && (
                <View className="flex-1">
                  {/* Header */}
                  <View className="flex-row items-center px-4 pt-4 pb-3 border-b border-surface-2">
                    <TouchableOpacity onPress={() => setMode("search")} hitSlop={8} className="w-8">
                      <ChevronLeft size={22} color="#A0A0A0" />
                    </TouchableOpacity>
                    <Text className="flex-1 text-center font-anton text-white text-lg tracking-widest uppercase">
                      New Exercise
                    </Text>
                    <TouchableOpacity
                      onPress={handleCreate}
                      disabled={!canCreate || creating}
                      hitSlop={10}
                      className="w-20 items-end"
                    >
                      <Text className={`font-montserrat-semibold text-sm ${canCreate ? "text-crimson" : "text-text-muted"}`}>
                        {creating ? "Saving…" : multiSelect ? "Add & Back" : "Save"}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 20 }}>
                    {/* Name */}
                    <View>
                      <Text className="font-mono text-text-muted text-xs tracking-widest uppercase mb-2">
                        Exercise Name *
                      </Text>
                      <TextInput
                        className="bg-surface-2 px-4 py-3 font-montserrat text-white text-sm border border-surface-3"
                        style={{ borderRadius: 8 }}
                        placeholder="e.g. Hack Squat"
                        placeholderTextColor="#606060"
                        value={createName}
                        onChangeText={setCreateName}
                        autoFocus
                        returnKeyType="done"
                      />
                    </View>

                    {/* Target Type */}
                    <View>
                      <Text className="font-mono text-text-muted text-xs tracking-widest uppercase mb-2">
                        Target Type
                      </Text>
                      <View className="flex-row flex-wrap gap-2">
                        {TARGET_TYPES.map((t) => (
                          <TouchableOpacity
                            key={t.key}
                            onPress={() => setCreateTargetType(t.key)}
                            className={`px-3 py-2 border ${
                              createTargetType === t.key
                                ? "bg-crimson border-crimson"
                                : "bg-surface-2 border-surface-3"
                            }`}
                            activeOpacity={0.7}
                          >
                            <Text className={`font-montserrat-semibold text-xs ${createTargetType === t.key ? "text-white" : "text-text-secondary"}`}>
                              {t.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    {/* Muscle Groups — multi-select */}
                    <View>
                      <View className="flex-row items-center justify-between mb-2">
                        <Text className="font-mono text-text-muted text-xs tracking-widest uppercase">
                          Muscle Groups *
                        </Text>
                        {createMuscles.length > 0 && (
                          <Text className="font-mono text-crimson text-xs">{createMuscles.length} selected</Text>
                        )}
                      </View>
                      <View className="flex-row flex-wrap gap-2">
                        {MUSCLE_GROUPS.map((mg) => {
                          const selected = createMuscles.includes(mg);
                          return (
                            <TouchableOpacity
                              key={mg}
                              onPress={() => toggleMuscle(mg)}
                              className={`px-3 py-2 border ${selected ? "bg-crimson border-crimson" : "bg-surface-2 border-surface-3"}`}
                              activeOpacity={0.7}
                            >
                              <Text className={`font-montserrat-semibold text-xs ${selected ? "text-white" : "text-text-secondary"}`}>
                                {mg}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>

                    {/* Equipment — multi-select */}
                    <View>
                      <View className="flex-row items-center justify-between mb-2">
                        <Text className="font-mono text-text-muted text-xs tracking-widest uppercase">
                          Equipment *
                        </Text>
                        {createEquipments.length > 0 && (
                          <Text className="font-mono text-crimson text-xs">{createEquipments.length} selected</Text>
                        )}
                      </View>
                      <View className="flex-row flex-wrap gap-2">
                        {EQUIPMENT_TYPES.map((eq) => {
                          const selected = createEquipments.includes(eq);
                          return (
                            <TouchableOpacity
                              key={eq}
                              onPress={() => toggleEquipment(eq)}
                              className={`px-3 py-2 border ${selected ? "bg-crimson border-crimson" : "bg-surface-2 border-surface-3"}`}
                              activeOpacity={0.7}
                            >
                              <Text className={`font-montserrat-semibold text-xs ${selected ? "text-white" : "text-text-secondary"}`}>
                                {eq}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
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
