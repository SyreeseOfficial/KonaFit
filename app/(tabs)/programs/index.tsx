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
    <SafeAreaView className="flex-1 bg-obsidian">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 pt-4 pb-5">
        <Text className="font-anton text-white text-3xl tracking-widest uppercase">
          Programs
        </Text>
        <TouchableOpacity
          onPress={() => router.push("/programs/new" as never)}
          className="bg-crimson w-10 h-10 items-center justify-center"
          activeOpacity={0.8}
        >
          <Plus size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={programs}
        keyExtractor={(item) => String(item.id)}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={load} tintColor="#FF0000" colors={["#FF0000"]} />
        }
        contentContainerStyle={{ paddingBottom: 32 }}
        renderItem={({ item }) => (
          <View className="mx-4 mb-3 bg-surface">
            <TouchableOpacity
              onPress={() => router.push(`/programs/${item.id}` as never)}
              activeOpacity={0.8}
              className="flex-row items-center px-4 py-4"
            >
              <View className="flex-1">
                <View className="flex-row items-center gap-2 mb-0.5">
                  <Text className="font-montserrat-bold text-white text-sm tracking-wider uppercase">
                    {item.name}
                  </Text>
                  <View className="bg-surface-3 px-2 py-0.5">
                    <Text className="font-mono text-text-muted text-xs">
                      {TYPE_LABEL[item.programType] ?? item.programType}
                    </Text>
                  </View>
                </View>
                {item.description ? (
                  <Text className="font-montserrat text-text-muted text-xs mb-1.5" numberOfLines={1}>
                    {item.description}
                  </Text>
                ) : null}
                <View className="flex-row" style={{ gap: 12 }}>
                  <Text className="font-mono text-text-muted text-xs">
                    {item.dayCount} {item.dayCount === 1 ? "day" : "days"}
                  </Text>
                  <Text className="font-mono text-text-muted text-xs">
                    {item.exerciseCount} exercises
                  </Text>
                  {item.durationWeeks ? (
                    <Text className="font-mono text-text-muted text-xs">{item.durationWeeks}w</Text>
                  ) : null}
                  {item.difficulty ? (
                    <Text className="font-mono text-text-muted text-xs">{item.difficulty}</Text>
                  ) : null}
                </View>
              </View>
              <View className="flex-row items-center" style={{ gap: 12 }}>
                <TouchableOpacity
                  onPress={() => setMenuProgram(item)}
                  hitSlop={8}
                  activeOpacity={0.7}
                >
                  <MoreHorizontal size={18} color="#606060" />
                </TouchableOpacity>
                <ChevronRight size={16} color="#606060" />
              </View>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center mt-24 px-8">
            <Text className="font-montserrat-bold text-white text-base tracking-wider uppercase mb-2">
              No Programs Yet
            </Text>
            <Text className="font-montserrat text-text-muted text-sm text-center mb-6">
              Build reusable workout templates and launch them directly into the workspace.
            </Text>
            <TouchableOpacity
              onPress={() => router.push("/programs/new" as never)}
              className="bg-crimson px-8 py-3"
              activeOpacity={0.8}
            >
              <Text className="font-montserrat-bold text-white text-xs tracking-widest uppercase">
                Create Program
              </Text>
            </TouchableOpacity>
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
        <Pressable className="flex-1 bg-black/60 justify-end" onPress={() => setMenuProgram(null)}>
          <Pressable>
            <View className="bg-surface-2 pb-10">
              <View className="px-4 py-4 border-b border-surface-3">
                <Text className="font-montserrat-bold text-white text-sm tracking-wider uppercase" numberOfLines={1}>
                  {menuProgram?.name}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => menuProgram && handleClone(menuProgram)}
                className="flex-row items-center gap-3 px-4 py-4 border-b border-surface-3"
                activeOpacity={0.7}
              >
                <Copy size={16} color="#A0A0A0" />
                <Text className="font-montserrat-semibold text-white text-sm">Duplicate Program</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => menuProgram && handleArchive(menuProgram)}
                className="flex-row items-center gap-3 px-4 py-4 border-b border-surface-3"
                activeOpacity={0.7}
              >
                <Archive size={16} color="#A0A0A0" />
                <View className="flex-1">
                  <Text className="font-montserrat-semibold text-white text-sm">Archive Program</Text>
                  <Text className="font-mono text-text-muted text-xs mt-0.5">
                    Hidden from list, restore anytime in Settings
                  </Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => menuProgram && handleDelete(menuProgram)}
                className="flex-row items-center gap-3 px-4 py-4"
                activeOpacity={0.7}
              >
                <Trash2 size={16} color="#FF0000" />
                <Text className="font-montserrat-semibold text-crimson text-sm">Delete Permanently</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
