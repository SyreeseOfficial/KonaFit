import { useState, useCallback } from "react";
import { View, Text, FlatList, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { ChevronLeft, ArchiveRestore } from "lucide-react-native";
import { getDeletedExercises, restoreExercise } from "../src/db/workoutQueries";
import type { Exercise } from "../src/types/workout";

export default function DeletedExercisesScreen() {
  const [items, setItems] = useState<Exercise[]>([]);

  const load = useCallback(async () => setItems(await getDeletedExercises()), []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleRestore = async (ex: Exercise) => {
    try {
      await restoreExercise(ex.id);
      load();
    } catch (e) {
      Alert.alert("Can't restore", e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-obsidian dark:bg-zinc-950">
      <View className="flex-row items-center gap-3 px-5 pt-5 pb-5 border-b border-surface-2 dark:border-zinc-800">
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} activeOpacity={0.7}>
          <ChevronLeft size={22} color="#94A3B8" />
        </TouchableOpacity>
        <Text className="font-montserrat-bold text-text-primary dark:text-white text-2xl flex-1">
          Deleted Exercises
        </Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40, gap: 8 }}
        renderItem={({ item }) => (
          <View className="bg-surface dark:bg-zinc-900 rounded-2xl flex-row items-center px-5 py-5">
            <View className="flex-1">
              <Text className="font-montserrat-bold text-text-primary dark:text-white text-base">{item.name}</Text>
              <Text className="font-mono text-text-muted dark:text-zinc-500 text-sm mt-1">{item.muscle_group}</Text>
            </View>
            <TouchableOpacity onPress={() => handleRestore(item)} hitSlop={8} activeOpacity={0.7}>
              <ArchiveRestore size={20} color="#2563EB" />
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <View className="items-center mt-24 px-8">
            <Text className="font-montserrat-bold text-text-primary dark:text-white text-lg mb-2">No Deleted Exercises</Text>
            <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-base text-center">
              Deleted exercises stay here for 30 days (or forever if they have workout history).
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
