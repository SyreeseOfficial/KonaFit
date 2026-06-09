import { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
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

  const handleDelete = (p: ProgramSummary) => {
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

  return (
    <SafeAreaView className="flex-1 bg-obsidian">
      <View className="flex-row items-center gap-3 px-4 pt-4 pb-4 border-b border-surface-2">
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} activeOpacity={0.7}>
          <ChevronLeft size={22} color="#A0A0A0" />
        </TouchableOpacity>
        <Text className="font-anton text-white text-2xl tracking-widest uppercase flex-1">
          Archived
        </Text>
      </View>

      <FlatList
        data={programs}
        keyExtractor={(item) => String(item.id)}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={load} tintColor="#FF0000" colors={["#FF0000"]} />
        }
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => (
          <View className="mx-4 mt-3 bg-surface flex-row items-center px-4 py-4">
            <View className="flex-1">
              <View className="flex-row items-center gap-2 mb-0.5">
                <Text className="font-montserrat-bold text-text-secondary text-sm tracking-wider uppercase">
                  {item.name}
                </Text>
                <View className="bg-surface-3 px-2 py-0.5">
                  <Text className="font-mono text-text-muted text-xs">
                    {TYPE_LABEL[item.programType] ?? item.programType}
                  </Text>
                </View>
              </View>
              {item.description ? (
                <Text className="font-montserrat text-text-muted text-xs mb-1" numberOfLines={1}>
                  {item.description}
                </Text>
              ) : null}
              <View className="flex-row" style={{ gap: 10 }}>
                <Text className="font-mono text-text-muted text-xs">
                  {item.dayCount} {item.dayCount === 1 ? "day" : "days"}
                </Text>
                <Text className="font-mono text-text-muted text-xs">
                  {item.exerciseCount} exercises
                </Text>
              </View>
            </View>
            <View className="flex-row items-center" style={{ gap: 16 }}>
              <TouchableOpacity onPress={() => handleRestore(item)} hitSlop={8} activeOpacity={0.7}>
                <ArchiveRestore size={18} color="#A0A0A0" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(item)} hitSlop={8} activeOpacity={0.7}>
                <Trash2 size={16} color="#606060" />
              </TouchableOpacity>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View className="items-center mt-24 px-8">
            <Text className="font-montserrat-bold text-white text-base tracking-wider uppercase mb-2">
              No Archived Programs
            </Text>
            <Text className="font-montserrat text-text-muted text-sm text-center">
              Programs you archive from the Programs tab will appear here.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}
