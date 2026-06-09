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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { ChevronLeft, Pencil, Trash2, X, Check } from "lucide-react-native";
import {
  getCustomExercises,
  updateExercise,
  deleteExercise,
} from "../src/db/workoutQueries";
import type { Exercise } from "../src/types/workout";

function EditModal({
  exercise,
  onSave,
  onClose,
}: {
  exercise: Exercise | null;
  onSave: (id: number, name: string, muscleGroup: string) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(exercise?.name ?? "");
  const [muscleGroup, setMuscleGroup] = useState(exercise?.muscle_group ?? "");
  const [saving, setSaving] = useState(false);

  if (!exercise) return null;

  const canSave = name.trim().length > 0 && muscleGroup.trim().length > 0;

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await onSave(exercise.id, name, muscleGroup);
    } finally {
      setSaving(false);
    }
  };

  const labelClass = "font-mono text-text-muted text-xs tracking-widest uppercase mb-1.5";
  const inputClass = "bg-surface-3 px-3 py-3 font-montserrat text-white text-sm";

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/70 justify-end" onPress={onClose}>
        <Pressable>
          <View className="bg-surface-2 pb-10">
            <View className="flex-row items-center justify-between px-4 py-4 border-b border-surface-3">
              <Text className="font-anton text-white text-base tracking-widest uppercase">
                Edit Exercise
              </Text>
              <TouchableOpacity onPress={onClose} hitSlop={8}>
                <X size={18} color="#606060" />
              </TouchableOpacity>
            </View>
            <View className="px-4 py-4" style={{ gap: 16 }}>
              <View>
                <Text className={labelClass}>Exercise Name</Text>
                <TextInput
                  className={inputClass}
                  value={name}
                  onChangeText={setName}
                  autoFocus
                  returnKeyType="next"
                />
              </View>
              <View>
                <Text className={labelClass}>Muscle Group</Text>
                <TextInput
                  className={inputClass}
                  value={muscleGroup}
                  onChangeText={setMuscleGroup}
                  placeholder="e.g. Chest, Front Delts"
                  placeholderTextColor="#606060"
                  returnKeyType="done"
                  onSubmitEditing={handleSave}
                />
              </View>
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

  const handleSave = async (id: number, name: string, muscleGroup: string) => {
    await updateExercise(id, { name, muscleGroup });
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

      <EditModal
        exercise={editingExercise}
        onSave={handleSave}
        onClose={() => setEditingExercise(null)}
      />
    </SafeAreaView>
  );
}
