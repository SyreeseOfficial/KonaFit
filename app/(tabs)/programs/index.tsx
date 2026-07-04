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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, router } from "expo-router";
import { Plus, ChevronRight, Copy, Trash2, Archive, MoreHorizontal } from "lucide-react-native";
import {
  getPrograms,
  deleteProgram,
  cloneProgram,
  archiveProgram,
} from "../../../src/db/programQueries";
import type { ProgramSummary } from "../../../src/types/program";

const TYPE_LABEL: Record<string, string> = {
  single: "Single",
  weekly: "Weekly",
  multi_week: "Multi-Week",
};

export default function ProgramsScreen() {
  const [programs, setPrograms] = useState<ProgramSummary[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [menuProgram, setMenuProgram] = useState<ProgramSummary | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      setPrograms(await getPrograms());
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleDelete = (p: ProgramSummary) => {
    setMenuProgram(null);
    Alert.alert(
      "Delete Program",
      `Permanently delete "${p.name}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => { await deleteProgram(p.id); load(); },
        },
      ]
    );
  };

  const handleArchive = async (p: ProgramSummary) => {
    setMenuProgram(null);
    await archiveProgram(p.id);
    load();
  };

  const handleClone = async (p: ProgramSummary) => {
    setMenuProgram(null);
    await cloneProgram(p.id);
    load();
  };

  return (
    <SafeAreaView className="flex-1 bg-obsidian dark:bg-zinc-950">
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 pt-6 pb-4">
        <Text className="font-montserrat-bold text-text-primary dark:text-white text-3xl">
          Programs
        </Text>
        <TouchableOpacity
          onPress={() => router.push("/programs/new" as never)}
          className="bg-crimson dark:bg-blue-500 w-10 h-10 items-center justify-center rounded-full"
          activeOpacity={0.85}
        >
          <Plus size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={programs}
        keyExtractor={(item) => String(item.id)}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={load} tintColor="#2563EB" colors={["#2563EB"]} />
        }
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32, gap: 12 }}
        renderItem={({ item }) => (
          <View className="bg-surface dark:bg-zinc-900 rounded-2xl overflow-hidden">
            <TouchableOpacity
              onPress={() => router.push(`/programs/${item.id}` as never)}
              activeOpacity={0.8}
              className="flex-row items-center px-5 py-5"
            >
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
                  <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-sm mb-2" numberOfLines={1}>
                    {item.description}
                  </Text>
                ) : null}
                <View className="flex-row" style={{ gap: 12 }}>
                  <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs">
                    {item.dayCount} {item.dayCount === 1 ? "day" : "days"}
                  </Text>
                  <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs">
                    {item.exerciseCount} exercises
                  </Text>
                  {item.durationWeeks ? (
                    <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs">{item.durationWeeks}w</Text>
                  ) : null}
                  {item.difficulty ? (
                    <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs">{item.difficulty}</Text>
                  ) : null}
                </View>
              </View>
              <View className="flex-row items-center" style={{ gap: 12 }}>
                <TouchableOpacity
                  onPress={() => setMenuProgram(item)}
                  hitSlop={8}
                  activeOpacity={0.7}
                >
                  <MoreHorizontal size={18} color="#94A3B8" />
                </TouchableOpacity>
                <ChevronRight size={16} color="#94A3B8" />
              </View>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center mt-24 px-8">
            <Text className="font-montserrat-bold text-text-primary dark:text-white text-lg mb-2">
              No Programs Yet
            </Text>
            <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-base text-center">
              Build reusable workout templates and launch them directly into the workspace.
            </Text>
          </View>
        }
      />

      {/* Per-program context menu */}
      <Modal
        visible={menuProgram !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setMenuProgram(null)}
      >
        <Pressable className="flex-1 bg-black/50 justify-end" onPress={() => setMenuProgram(null)}>
          <Pressable>
            <View className="bg-surface dark:bg-zinc-900 rounded-t-3xl pb-10">
              <View className="px-5 py-5 border-b border-surface-2 dark:border-zinc-800">
                <Text className="font-montserrat-bold text-text-primary dark:text-white text-base" numberOfLines={1}>
                  {menuProgram?.name}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => menuProgram && handleClone(menuProgram)}
                className="flex-row items-center gap-3 px-5 py-4 border-b border-surface-2 dark:border-zinc-800"
                activeOpacity={0.7}
              >
                <Copy size={18} color="#64748B" />
                <Text className="font-montserrat-semibold text-text-primary dark:text-white text-base">Duplicate Program</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => menuProgram && handleArchive(menuProgram)}
                className="flex-row items-center gap-3 px-5 py-4 border-b border-surface-2 dark:border-zinc-800"
                activeOpacity={0.7}
              >
                <Archive size={18} color="#64748B" />
                <View className="flex-1">
                  <Text className="font-montserrat-semibold text-text-primary dark:text-white text-base">Archive Program</Text>
                  <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-sm mt-0.5">
                    Hidden from list, restore anytime in Settings
                  </Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => menuProgram && handleDelete(menuProgram)}
                className="flex-row items-center gap-3 px-5 py-4"
                activeOpacity={0.7}
              >
                <Trash2 size={18} color="#EF4444" />
                <Text className="font-montserrat-semibold text-rose-500 text-base">Delete Permanently</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
