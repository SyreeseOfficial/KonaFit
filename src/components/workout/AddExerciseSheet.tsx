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
} from "react-native";
import { Search, X, Plus, ChevronLeft } from "lucide-react-native";
import { searchExercises, createCustomExercise } from "../../db/workoutQueries";
import type { Exercise } from "../../types/workout";

const MUSCLE_GROUPS = ["Chest", "Back", "Shoulders", "Arms", "Legs", "Core", "Glutes", "Full Body"];
const EQUIPMENT_TYPES = ["Barbell", "Dumbbell", "Cable", "Machine", "Bodyweight", "Kettlebell", "Bands", "Other"];

type Mode = "search" | "create";

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (exercise: Exercise) => void;
};

export function AddExerciseSheet({ visible, onClose, onSelect }: Props) {
  const [mode, setMode] = useState<Mode>("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(false);

  // Create form state
  const [createName, setCreateName] = useState("");
  const [createMuscle, setCreateMuscle] = useState("");
  const [createEquipment, setCreateEquipment] = useState("");
  const [creating, setCreating] = useState(false);

  const runSearch = useCallback(async (q: string) => {
    setLoading(true);
    try {
      setResults(await searchExercises(q));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    runSearch(query);
  }, [query, visible, runSearch]);

  useEffect(() => {
    if (visible) {
      setQuery("");
      setMode("search");
    }
  }, [visible]);

  const openCreate = () => {
    setCreateName(query.trim());
    setCreateMuscle("");
    setCreateEquipment("");
    setMode("create");
  };

  const handleCreate = async () => {
    if (!createName.trim() || !createMuscle || !createEquipment || creating) return;
    setCreating(true);
    try {
      const exercise = await createCustomExercise(
        createName,
        createMuscle,
        createEquipment.toLowerCase()
      );
      onSelect(exercise);
      onClose();
    } finally {
      setCreating(false);
    }
  };

  const canCreate = createName.trim().length > 0 && createMuscle !== "" && createEquipment !== "";

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/60 justify-end" onPress={onClose}>
        <Pressable>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View className="bg-surface-2 h-[75%]">

              {/* ── Search mode ──────────────────────────────────── */}
              {mode === "search" && (
                <>
                  {/* Header */}
                  <View className="flex-row items-center justify-between px-4 py-4 border-b border-surface-3">
                    <Text className="font-anton text-white text-lg tracking-widest uppercase">
                      Add Exercise
                    </Text>
                    <TouchableOpacity onPress={onClose} hitSlop={8}>
                      <X size={20} color="#606060" />
                    </TouchableOpacity>
                  </View>

                  {/* Search bar */}
                  <View className="flex-row items-center gap-2 px-4 py-3 border-b border-surface-3">
                    <Search size={16} color="#606060" />
                    <TextInput
                      className="flex-1 font-mono text-white text-sm"
                      placeholder="Search exercises..."
                      placeholderTextColor="#606060"
                      value={query}
                      onChangeText={setQuery}
                      autoFocus
                      autoCorrect={false}
                    />
                    {query.length > 0 && (
                      <TouchableOpacity onPress={() => setQuery("")} hitSlop={8}>
                        <X size={14} color="#606060" />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Results */}
                  <View className="flex-1">
                    {loading ? (
                      <ActivityIndicator color="#FF0000" className="mt-8" />
                    ) : (
                      <FlatList
                        data={results}
                        keyExtractor={(item) => String(item.id)}
                        keyboardShouldPersistTaps="handled"
                        renderItem={({ item }) => (
                          <TouchableOpacity
                            onPress={() => { onSelect(item); onClose(); }}
                            className="flex-row items-center justify-between px-4 py-3.5 border-b border-surface-3"
                            activeOpacity={0.7}
                          >
                            <View className="flex-1">
                              <Text className="font-montserrat-semibold text-white text-sm">
                                {item.name}
                              </Text>
                              <Text className="font-mono text-text-muted text-xs tracking-wider uppercase mt-0.5">
                                {item.muscle_group} · {item.equipment_type}
                              </Text>
                            </View>
                            {item.use_count > 0 && (
                              <View className="bg-surface-3 px-2 py-0.5 ml-2">
                                <Text className="font-mono text-text-muted text-xs">
                                  ×{item.use_count}
                                </Text>
                              </View>
                            )}
                          </TouchableOpacity>
                        )}
                        ListEmptyComponent={
                          <View className="items-center mt-10 px-6">
                            <Text className="font-montserrat text-text-muted text-sm text-center">
                              {query.length > 0 ? `No results for "${query}"` : "No exercises yet"}
                            </Text>
                          </View>
                        }
                      />
                    )}
                  </View>

                  {/* Create button — fixed at bottom, always visible */}
                  <TouchableOpacity
                    onPress={openCreate}
                    className="flex-row items-center justify-center gap-2 py-4 border-t border-surface-3 bg-surface-2"
                    activeOpacity={0.7}
                  >
                    <Plus size={15} color="#FF0000" />
                    <Text className="font-montserrat-semibold text-crimson text-sm tracking-wider">
                      {query.trim().length > 0
                        ? `Create "${query.trim()}"`
                        : "Create Custom Exercise"}
                    </Text>
                  </TouchableOpacity>
                </>
              )}

              {/* ── Create mode ──────────────────────────────────── */}
              {mode === "create" && (
                <>
                  {/* Header */}
                  <View className="flex-row items-center gap-3 px-4 py-4 border-b border-surface-3">
                    <TouchableOpacity onPress={() => setMode("search")} hitSlop={8}>
                      <ChevronLeft size={20} color="#A0A0A0" />
                    </TouchableOpacity>
                    <Text className="font-anton text-white text-lg tracking-widest uppercase flex-1">
                      New Exercise
                    </Text>
                    <TouchableOpacity
                      onPress={handleCreate}
                      disabled={!canCreate || creating}
                      className={`px-4 py-1.5 ${canCreate ? "bg-crimson" : "bg-surface-3"}`}
                      activeOpacity={0.8}
                    >
                      <Text className={`font-montserrat-bold text-xs tracking-widest uppercase ${canCreate ? "text-white" : "text-text-muted"}`}>
                        {creating ? "Saving…" : "Save"}
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
                        className="bg-surface-3 px-3 py-3 font-montserrat text-white text-sm"
                        placeholder="e.g. Hack Squat"
                        placeholderTextColor="#606060"
                        value={createName}
                        onChangeText={setCreateName}
                        autoFocus
                        returnKeyType="done"
                      />
                    </View>

                    {/* Muscle group */}
                    <View>
                      <Text className="font-mono text-text-muted text-xs tracking-widest uppercase mb-2">
                        Muscle Group *
                      </Text>
                      <View className="flex-row flex-wrap gap-2">
                        {MUSCLE_GROUPS.map((mg) => (
                          <TouchableOpacity
                            key={mg}
                            onPress={() => setCreateMuscle(mg)}
                            className={`px-3 py-2 ${createMuscle === mg ? "bg-crimson" : "bg-surface-3"}`}
                            activeOpacity={0.7}
                          >
                            <Text className={`font-montserrat-semibold text-xs ${createMuscle === mg ? "text-white" : "text-text-secondary"}`}>
                              {mg}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    {/* Equipment type */}
                    <View>
                      <Text className="font-mono text-text-muted text-xs tracking-widest uppercase mb-2">
                        Equipment *
                      </Text>
                      <View className="flex-row flex-wrap gap-2">
                        {EQUIPMENT_TYPES.map((eq) => (
                          <TouchableOpacity
                            key={eq}
                            onPress={() => setCreateEquipment(eq)}
                            className={`px-3 py-2 ${createEquipment === eq ? "bg-crimson" : "bg-surface-3"}`}
                            activeOpacity={0.7}
                          >
                            <Text className={`font-montserrat-semibold text-xs ${createEquipment === eq ? "text-white" : "text-text-secondary"}`}>
                              {eq}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </ScrollView>
                </>
              )}

            </View>
          </KeyboardAvoidingView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
