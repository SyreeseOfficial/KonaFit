import { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { ChevronLeft, Pencil, Trash2, X } from "lucide-react-native";
import {
  getCustomExercises,
  updateExercise,
  deleteExercise,
} from "../src/db/workoutQueries";
import type { Exercise } from "../src/types/workout";

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
  { key: "reps", label: "Reps" },
  { key: "time", label: "Time" },
  { key: "distance", label: "Distance" },
  { key: "weight", label: "Weight" },
  { key: "calories", label: "Calories" },
];

type SaveData = {
  name: string;
  muscleGroup: string;
  targetType: string;
  equipmentType: string;
};

function EditModal({
  exercise,
  onSave,
  onClose,
}: {
  exercise: Exercise | null;
  onSave: (id: number, data: SaveData) => Promise<void>;
  onClose: () => void;
}) {
  const { height: screenHeight } = useWindowDimensions();
  const [name, setName] = useState(exercise?.name ?? "");
  const [targetType, setTargetType] = useState(exercise?.target_type ?? "reps");
  const [muscleGroups, setMuscleGroups] = useState<string[]>(
    exercise?.muscle_group ? exercise.muscle_group.split(", ").filter(Boolean) : []
  );
  const [equipmentTypes, setEquipmentTypes] = useState<string[]>(
    exercise?.equipment_type ? exercise.equipment_type.split(", ").filter(Boolean) : []
  );
  const [saving, setSaving] = useState(false);

  if (!exercise) return null;

  const canSave = name.trim().length > 0 && muscleGroups.length > 0 && equipmentTypes.length > 0;

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await onSave(exercise.id, {
        name,
        muscleGroup: muscleGroups.join(", "),
        targetType,
        equipmentType: equipmentTypes.join(", "),
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleMuscle = (mg: string) =>
    setMuscleGroups((prev) =>
      prev.includes(mg) ? prev.filter((m) => m !== mg) : [...prev, mg]
    );

  const toggleEquipment = (eq: string) =>
    setEquipmentTypes((prev) =>
      prev.includes(eq) ? prev.filter((e) => e !== eq) : [...prev, eq]
    );

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <Pressable className="flex-1 bg-black/50 justify-end" onPress={onClose}>
          <Pressable>
            <View className="bg-surface dark:bg-zinc-900 rounded-t-3xl" style={{ maxHeight: screenHeight * 0.88 }}>
              <View className="flex-row items-center justify-between px-5 py-5 border-b border-surface-2 dark:border-zinc-800">
                <Text className="font-montserrat-bold text-text-primary dark:text-white text-lg">
                  Edit Exercise
                </Text>
                <TouchableOpacity onPress={onClose} hitSlop={8}>
                  <X size={20} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ padding: 20, paddingBottom: 8, gap: 20 }}
                style={{ flexShrink: 1 }}
              >
                <View>
                  <Text className="font-montserrat-semibold text-text-muted dark:text-zinc-500 text-xs tracking-widest uppercase mb-2">
                    Exercise Name
                  </Text>
                  <TextInput
                    className="bg-surface-2 dark:bg-zinc-800 px-4 py-3 font-montserrat text-text-primary dark:text-white text-base rounded-xl"
                    value={name}
                    onChangeText={setName}
                    autoFocus
                    returnKeyType="done"
                  />
                </View>

                <View>
                  <Text className="font-montserrat-semibold text-text-muted dark:text-zinc-500 text-xs tracking-widest uppercase mb-2">
                    Target Type
                  </Text>
                  <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                    {TARGET_TYPES.map((t) => (
                      <TouchableOpacity
                        key={t.key}
                        onPress={() => setTargetType(t.key)}
                        className={`px-3 py-2 rounded-full ${targetType === t.key ? "bg-crimson dark:bg-blue-500" : "bg-surface-2 dark:bg-zinc-800"}`}
                        activeOpacity={0.7}
                      >
                        <Text className={`font-montserrat-semibold text-sm ${targetType === t.key ? "text-white" : "text-text-secondary dark:text-zinc-400"}`}>{t.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View>
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="font-montserrat-semibold text-text-muted dark:text-zinc-500 text-xs tracking-widest uppercase">
                      Muscle Groups
                    </Text>
                    {muscleGroups.length > 0 && (
                      <Text className="font-montserrat text-crimson dark:text-blue-400 text-sm">
                        {muscleGroups.length} selected
                      </Text>
                    )}
                  </View>
                  <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                    {MUSCLE_GROUPS.map((mg) => (
                      <TouchableOpacity
                        key={mg}
                        onPress={() => toggleMuscle(mg)}
                        className={`px-3 py-2 rounded-full ${muscleGroups.includes(mg) ? "bg-crimson dark:bg-blue-500" : "bg-surface-2 dark:bg-zinc-800"}`}
                        activeOpacity={0.7}
                      >
                        <Text className={`font-montserrat-semibold text-sm ${muscleGroups.includes(mg) ? "text-white" : "text-text-secondary dark:text-zinc-400"}`}>{mg}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View>
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="font-montserrat-semibold text-text-muted dark:text-zinc-500 text-xs tracking-widest uppercase">
                      Equipment
                    </Text>
                    {equipmentTypes.length > 0 && (
                      <Text className="font-montserrat text-crimson dark:text-blue-400 text-sm">
                        {equipmentTypes.length} selected
                      </Text>
                    )}
                  </View>
                  <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                    {EQUIPMENT_TYPES.map((eq) => (
                      <TouchableOpacity
                        key={eq}
                        onPress={() => toggleEquipment(eq)}
                        className={`px-3 py-2 rounded-full ${equipmentTypes.includes(eq) ? "bg-crimson dark:bg-blue-500" : "bg-surface-2 dark:bg-zinc-800"}`}
                        activeOpacity={0.7}
                      >
                        <Text className={`font-montserrat-semibold text-sm ${equipmentTypes.includes(eq) ? "text-white" : "text-text-secondary dark:text-zinc-400"}`}>{eq}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </ScrollView>

              <View className="px-5 pb-10 pt-3 border-t border-surface-2 dark:border-zinc-800">
                <TouchableOpacity
                  onPress={handleSave}
                  disabled={!canSave || saving}
                  className={`py-4 items-center rounded-2xl ${canSave ? "bg-crimson dark:bg-blue-500" : "bg-surface-2 dark:bg-zinc-800"}`}
                  activeOpacity={0.8}
                >
                  <Text
                    className={`font-montserrat-bold text-base ${
                      canSave ? "text-white" : "text-text-muted dark:text-zinc-500"
                    }`}
                  >
                    {saving ? "Saving…" : "Save Changes"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function CustomExercisesScreen() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      setExercises(await getCustomExercises());
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleSave = async (id: number, data: SaveData) => {
    try {
      await updateExercise(id, {
        name: data.name,
        muscleGroup: data.muscleGroup,
        targetType: data.targetType,
        equipmentType: data.equipmentType,
      });
    } catch (e) {
      Alert.alert("Can't save exercise", e instanceof Error ? e.message : String(e));
      return;
    }
    setEditingExercise(null);
    load();
  };

  const handleDelete = (ex: Exercise) => {
    Alert.alert(
      "Delete Exercise",
      `Delete "${ex.name}"? It will be removed from the exercise list but existing workout history will keep the name.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => { await deleteExercise(ex.id); load(); },
        },
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-obsidian dark:bg-zinc-950">
      <View className="flex-row items-center gap-3 px-5 pt-5 pb-5 border-b border-surface-2 dark:border-zinc-800">
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} activeOpacity={0.7}>
          <ChevronLeft size={22} color="#94A3B8" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="font-montserrat-bold text-text-primary dark:text-white text-2xl">
            Custom Exercises
          </Text>
          <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-sm mt-0.5">
            Exercises you&apos;ve created
          </Text>
        </View>
      </View>

      <FlatList
        data={exercises}
        keyExtractor={(item) => String(item.id)}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={load} tintColor="#2563EB" colors={["#2563EB"]} />
        }
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40, gap: 8 }}
        renderItem={({ item }) => (
          <View className="bg-surface dark:bg-zinc-900 rounded-2xl flex-row items-center px-5 py-5">
            <View className="flex-1">
              <Text className="font-montserrat-semibold text-text-primary dark:text-white text-base">{item.name}</Text>
              <Text className="font-mono text-text-muted dark:text-zinc-500 text-sm mt-0.5">{item.muscle_group}</Text>
              {item.equipment_type ? (
                <Text className="font-mono text-text-muted dark:text-zinc-500 text-sm">{item.equipment_type}</Text>
              ) : null}
            </View>
            <View className="flex-row items-center" style={{ gap: 16 }}>
              <TouchableOpacity
                onPress={() => setEditingExercise(item)}
                hitSlop={8}
                activeOpacity={0.7}
              >
                <Pencil size={18} color="#64748B" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleDelete(item)}
                hitSlop={8}
                activeOpacity={0.7}
              >
                <Trash2 size={18} color="#94A3B8" />
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View className="items-center mt-24 px-8">
            <Text className="font-montserrat-bold text-text-primary dark:text-white text-lg mb-2">
              No Custom Exercises
            </Text>
            <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-base text-center">
              Custom exercises you create in the exercise picker will appear here for editing.
            </Text>
          </View>
        }
      />

      <EditModal
        key={editingExercise?.id ?? -1}
        exercise={editingExercise}
        onSave={handleSave}
        onClose={() => setEditingExercise(null)}
      />
    </SafeAreaView>
  );
}
