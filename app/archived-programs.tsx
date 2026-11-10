import { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { ChevronLeft, ArchiveRestore, Trash2 } from "lucide-react-native";
import {
  getArchivedPrograms,
  unarchiveProgram,
  deleteProgram,
} from "../src/db/programQueries";
import type { ProgramSummary } from "../src/types/program";
import { confirm } from "../src/utils/confirm";

const TYPE_LABEL: Record<string, string> = {
  single: "Single",
  weekly: "Weekly",
  multi_week: "Multi-Week",
};

export default function ArchivedProgramsScreen() {
  const [programs, setPrograms] = useState<ProgramSummary[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      setPrograms(await getArchivedPrograms());
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleRestore = async (p: ProgramSummary) => {
    await unarchiveProgram(p.id);
    load();
  };

  const handleDelete = async (p: ProgramSummary) => {
    if (!(await confirm({ title: "Delete Program", message: `Permanently delete "${p.name}"? This cannot be undone.`, confirmText: "Delete", destructive: true }))) return;
    await deleteProgram(p.id);
    load();
  };

  return (
    <SafeAreaView className="flex-1 bg-obsidian dark:bg-zinc-950">
      <View className="flex-row items-center gap-3 px-5 pt-5 pb-5 border-b border-surface-2 dark:border-zinc-800">
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} activeOpacity={0.7}>
          <ChevronLeft size={22} color="#94A3B8" />
        </TouchableOpacity>
        <Text className="font-montserrat-bold text-text-primary dark:text-white text-2xl flex-1">
          Archived
        </Text>
      </View>

      <FlatList
        data={programs}
        keyExtractor={(item) => String(item.id)}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={load} tintColor="#2563EB" colors={["#2563EB"]} />
        }
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40, gap: 8 }}
        renderItem={({ item }) => (
          <View className="bg-surface dark:bg-zinc-900 rounded-2xl flex-row items-center px-5 py-5">
            <View className="flex-1">
              <View className="flex-row items-center gap-2 mb-1">
                <Text className="font-montserrat-bold text-text-primary dark:text-white text-base">
                  {item.name}
                </Text>
                <View className="bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded-full">
                  <Text className="font-montserrat-semibold text-crimson dark:text-blue-400 text-xs">
                    {TYPE_LABEL[item.programType] ?? item.programType}
                  </Text>
                </View>
              </View>
              {item.description ? (
                <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-sm mb-1" numberOfLines={1}>
                  {item.description}
                </Text>
              ) : null}
              <View className="flex-row" style={{ gap: 10 }}>
                <Text className="font-mono text-text-muted dark:text-zinc-500 text-sm">
                  {item.dayCount} {item.dayCount === 1 ? "day" : "days"}
                </Text>
                <Text className="font-mono text-text-muted dark:text-zinc-500 text-sm">
                  {item.exerciseCount} exercises
                </Text>
              </View>
            </View>
            <View className="flex-row items-center" style={{ gap: 16 }}>
              <TouchableOpacity onPress={() => handleRestore(item)} hitSlop={8} activeOpacity={0.7}>
                <ArchiveRestore size={20} color="#2563EB" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(item)} hitSlop={8} activeOpacity={0.7}>
                <Trash2 size={18} color="#94A3B8" />
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View className="items-center mt-24 px-8">
            <Text className="font-montserrat-bold text-text-primary dark:text-white text-lg mb-2">
              No Archived Programs
            </Text>
            <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-base text-center">
              Programs you archive from the Programs tab will appear here.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
