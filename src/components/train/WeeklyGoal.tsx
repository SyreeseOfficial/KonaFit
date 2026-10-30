import { useState, useCallback } from "react";
import { View, Text } from "react-native";
import { useFocusEffect } from "expo-router";
import { getWorkoutsThisWeek } from "../../db/statsQueries";
import { getWeeklyGoal } from "../../utils/settings";

/** "2 / 4 this week" with a progress bar; the goal itself is set in Settings. */
export function WeeklyGoal() {
  const [week, setWeek] = useState<{ done: number; goal: number } | null>(null);

  useFocusEffect(useCallback(() => {
    Promise.all([getWorkoutsThisWeek(), getWeeklyGoal()])
      .then(([done, goal]) => setWeek({ done, goal }))
      .catch(console.error);
  }, []));

  if (!week) return null;
  return (
    <View className="mx-5 mb-4">
      <Text className="font-mono text-text-secondary dark:text-zinc-400 text-xs">
        {week.done} / {week.goal} this week
      </Text>
      <View className="h-1 bg-surface-2 dark:bg-zinc-800 mt-2 rounded-full overflow-hidden">
        <View
          className="h-1 bg-crimson dark:bg-blue-500 rounded-full"
          style={{ width: `${Math.min(1, week.done / week.goal) * 100}%` }}
        />
      </View>
    </View>
  );
}
