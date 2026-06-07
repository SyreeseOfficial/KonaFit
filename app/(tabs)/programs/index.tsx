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
import { useFocusEffect, router } from "expo-router";
import { Plus, ChevronRight, Copy, Trash2 } from "lucide-react-native";
import { getPrograms, deleteProgram, cloneProgram } from "../../../src/db/programQueries";
import type { ProgramSummary } from "../../../src/types/program";

export default function ProgramsScreen() {
  const [programs, setPrograms] = useState<ProgramSummary[]>([]);
  const [refreshing, setRefreshing] = useState(false);

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
    Alert.alert(
      "Delete Program",
      `Delete "${p.name}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteProgram(p.id);
            load();
          },
        },
      ]
    );
  };

  const handleClone = async (p: ProgramSummary) => {
    await cloneProgram(p.id);
    load();
  };

  return (
    <SafeAreaView className="flex-1 bg-obsidian">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 pt-4 pb-5">
        <View>
          <Text className="font-anton text-white text-3xl tracking-widest uppercase">
            Programs
          </Text>
        </View>
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
                <Text className="font-montserrat-bold text-white text-sm tracking-wider uppercase mb-1">
                  {item.name}
                </Text>
                {item.description ? (
                  <Text className="font-montserrat text-text-muted text-xs mb-1.5" numberOfLines={1}>
                    {item.description}
                  </Text>
                ) : null}
                <View className="flex-row gap-3">
                  <Text className="font-mono text-text-muted text-xs">
                    {item.dayCount} {item.dayCount === 1 ? "day" : "days"}
                  </Text>
                  <Text className="font-mono text-text-muted text-xs">
                    {item.exerciseCount} exercises
                  </Text>
                  {item.durationWeeks ? (
                    <Text className="font-mono text-text-muted text-xs">
                      {item.durationWeeks}w
                    </Text>
                  ) : null}
                </View>
              </View>
              <View className="flex-row items-center gap-3">
                <TouchableOpacity
                  onPress={() => handleClone(item)}
                  hitSlop={8}
                  activeOpacity={0.7}
                >
                  <Copy size={15} color="#606060" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDelete(item)}
                  hitSlop={8}
                  activeOpacity={0.7}
                >
                  <Trash2 size={15} color="#606060" />
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
    </SafeAreaView>
  );
}
