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

// ─── Constants (mirrors AddExerciseSheet) ────────────────────────────────────

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

// ─── Edit Modal ───────────────────────────────────────────────────────────────

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

  const labelClass = "font-mono text-text-muted text-xs tracking-widest uppercase mb-2";
  const chip = (active: boolean) =>
    `px-3 py-2 border ${active ? "bg-crimson border-crimson" : "bg-surface-3 border-surface-3"}`;
  const chipText = (active: boolean) =>
    `font-montserrat-semibold text-xs ${active ? "text-white" : "text-text-secondary"}`;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <Pressable className="flex-1 bg-black/70 justify-end" onPress={onClose}>
          <Pressable>
            <View className="bg-surface-2" style={{ maxHeight: screenHeight * 0.88 }}>
              {/* Header */}
              <View className="flex-row items-center justify-between px-4 py-4 border-b border-surface-3">
                <Text className="font-anton text-white text-base tracking-widest uppercase">
                  Edit Exercise
                </Text>
                <TouchableOpacity onPress={onClose} hitSlop={8}>
                  <X size={18} color="#606060" />
                </TouchableOpacity>
              </View>

              {/* Scrollable form */}
              <ScrollView
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={{ padding: 16, paddingBottom: 8, gap: 20 }}
                style={{ flexShrink: 1 }}
              >
                {/* Name */}
                <View>
                  <Text className={labelClass}>Exercise Name *</Text>
                  <TextInput
                    className="bg-surface-3 px-3 py-3 font-montserrat text-white text-sm"
                    value={name}
                    onChangeText={setName}
                    autoFocus
                    returnKeyType="done"
                  />
                </View>

                {/* Target Type */}
                <View>
                  <Text className={labelClass}>Target Type</Text>
                  <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                    {TARGET_TYPES.map((t) => (
                      <TouchableOpacity
                        key={t.key}
                        onPress={() => setTargetType(t.key)}
                        className={chip(targetType === t.key)}
                        activeOpacity={0.7}
                      >
                        <Text className={chipText(targetType === t.key)}>{t.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Muscle Groups */}
                <View>
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="font-mono text-text-muted text-xs tracking-widest uppercase">
                      Muscle Groups *
                    </Text>
                    {muscleGroups.length > 0 && (
                      <Text className="font-mono text-crimson text-xs">
                        {muscleGroups.length} selected
                      </Text>
                    )}
                  </View>
                  <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                    {MUSCLE_GROUPS.map((mg) => (
                      <TouchableOpacity
                        key={mg}
                        onPress={() => toggleMuscle(mg)}
                        className={chip(muscleGroups.includes(mg))}
                        activeOpacity={0.7}
                      >
                        <Text className={chipText(muscleGroups.includes(mg))}>{mg}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Equipment */}
                <View>
                  <View className="flex-row items-center justify-between mb-2">
                    <Text className="font-mono text-text-muted text-xs tracking-widest uppercase">
                      Equipment *
                    </Text>
                    {equipmentTypes.length > 0 && (
                      <Text className="font-mono text-crimson text-xs">
                        {equipmentTypes.length} selected
                      </Text>
                    )}
                  </View>
                  <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                    {EQUIPMENT_TYPES.map((eq) => (
                      <TouchableOpacity
                        key={eq}
                        onPress={() => toggleEquipment(eq)}
                        className={chip(equipmentTypes.includes(eq))}
                        activeOpacity={0.7}
                      >
                        <Text className={chipText(equipmentTypes.includes(eq))}>{eq}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </ScrollView>

              {/* Sticky Save button */}
              <View className="px-4 pb-10 pt-3 border-t border-surface-3">
                <TouchableOpacity
                  onPress={handleSave}
                  disabled={!canSave || saving}
                  className={`py-3 items-center ${canSave ? "bg-crimson" : "bg-surface-3"}`}
                  activeOpacity={0.8}
                >
                  <Text
                    className={`font-montserrat-bold text-xs tracking-widest uppercase ${
                      canSave ? "text-white" : "text-text-muted"
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

// ─── Screen ───────────────────────────────────────────────────────────────────

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
    await updateExercise(id, {
      name: data.name,
      muscleGroup: data.muscleGroup,
      targetType: data.targetType,
      equipmentType: data.equipmentType,
    });
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
    <SafeAreaView className="flex-1 bg-obsidian">
      <View className="flex-row items-center gap-3 px-4 pt-5 pb-5 border-b border-surface-2">
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} activeOpacity={0.7}>
          <ChevronLeft size={22} color="#A0A0A0" />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="font-anton text-white text-2xl tracking-widest uppercase">
            Custom Exercises
          </Text>
          <Text className="font-mono text-text-muted text-xs mt-0.5">
            Exercises you've created
          </Text>
        </View>
      </View>

      <FlatList
        data={exercises}
        keyExtractor={(item) => String(item.id)}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={load} tintColor="#FF0000" colors={["#FF0000"]} />
        }
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => (
          <View className="mx-4 mt-4 bg-surface flex-row items-center px-4 py-5">
            <View className="flex-1">
              <Text className="font-montserrat-semibold text-white text-sm">{item.name}</Text>
              <Text className="font-mono text-text-muted text-xs mt-0.5">{item.muscle_group}</Text>
              {item.equipment_type ? (
                <Text className="font-mono text-text-muted text-xs">{item.equipment_type}</Text>
              ) : null}
            </View>
            <View className="flex-row items-center" style={{ gap: 16 }}>
              <TouchableOpacity
                onPress={() => setEditingExercise(item)}
                hitSlop={8}
                activeOpacity={0.7}
              >
                <Pencil size={16} color="#A0A0A0" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleDelete(item)}
                hitSlop={8}
                activeOpacity={0.7}
              >
                <Trash2 size={16} color="#606060" />
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View className="items-center mt-24 px-8">
            <Text className="font-montserrat-bold text-white text-base tracking-wider uppercase mb-2">
              No Custom Exercises
            </Text>
            <Text className="font-montserrat text-text-muted text-sm text-center">
              Custom exercises you create in the exercise picker will appear here for editing.
            </Text>
          </View>
        }
      />

      {/* key forces remount so useState re-initializes with fresh exercise data */}
      <EditModal
        key={editingExercise?.id ?? -1}
        exercise={editingExercise}
        onSave={handleSave}
        onClose={() => setEditingExercise(null)}
      />
    </SafeAreaView>
  );
}
