import { useState } from "react";
import { View, Text, TouchableOpacity, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { AddExerciseSheet } from "../src/components/workout/AddExerciseSheet";
import { mergeExercises } from "../src/db/workoutQueries";
import type { Exercise } from "../src/types/workout";
import { confirm } from "../src/utils/confirm";

/** Pick the duplicate and the exercise to keep; history, programs and goals move to the kept one. */
export default function MergeExercisesScreen() {
  const [from, setFrom] = useState<Exercise | null>(null);
  const [into, setInto] = useState<Exercise | null>(null);
  const [picking, setPicking] = useState<"from" | "into" | null>(null);

  const pick = (ex: Exercise) => (picking === "from" ? setFrom(ex) : setInto(ex));

  const handleMerge = async () => {
    if (!from || !into) return;
    if (!(await confirm({
      title: "Merge exercises?",
      message: `All history for "${from.name}" moves to "${into.name}". "${from.name}" goes to Deleted Exercises, where you can restore it.`,
      confirmText: "Merge",
      destructive: true,
    }))) return;
    try {
      await mergeExercises(from.id, into.id);
      Alert.alert("Merged", `"${from.name}" is now part of "${into.name}".`);
      setFrom(null);
      setInto(null);
    } catch (e) {
      Alert.alert("Couldn't merge", e instanceof Error ? e.message : String(e));
    }
  };

  const slot = (label: string, ex: Exercise | null, which: "from" | "into") => (
    <TouchableOpacity
      onPress={() => setPicking(which)}
      className="bg-surface dark:bg-zinc-900 rounded-2xl px-5 py-5 mb-3"
      activeOpacity={0.7}
    >
      <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs uppercase tracking-widest mb-1">{label}</Text>
      <Text className="font-montserrat-bold text-text-primary dark:text-white text-base">{ex ? ex.name : "Tap to choose"}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-obsidian dark:bg-zinc-950">
      <View className="flex-row items-center gap-3 px-5 pt-5 pb-5 border-b border-surface-2 dark:border-zinc-800">
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} activeOpacity={0.7}>
          <ChevronLeft size={22} color="#94A3B8" />
        </TouchableOpacity>
        <Text className="font-montserrat-bold text-text-primary dark:text-white text-2xl flex-1">Merge Exercises</Text>
      </View>
      <View className="px-5 pt-5">
        {slot("Duplicate (goes away)", from, "from")}
        {slot("Keep this one", into, "into")}
        <TouchableOpacity
          onPress={handleMerge}
          disabled={!from || !into}
          className={`py-4 items-center rounded-2xl mt-2 ${from && into ? "bg-crimson dark:bg-blue-500" : "bg-surface-2 dark:bg-zinc-800"}`}
          activeOpacity={0.85}
        >
          <Text className={`font-montserrat-bold text-base ${from && into ? "text-white" : "text-text-muted dark:text-zinc-500"}`}>Merge</Text>
        </TouchableOpacity>
      </View>
      <AddExerciseSheet visible={picking !== null} onClose={() => setPicking(null)} onSelect={pick} />
    </SafeAreaView>
  );
}
