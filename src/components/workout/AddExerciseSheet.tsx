import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  Pressable,
  ActivityIndicator,
} from "react-native";
import { Search, X } from "lucide-react-native";
import { searchExercises } from "../../db/workoutQueries";
import type { Exercise } from "../../types/workout";

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (exercise: Exercise) => void;
};

export function AddExerciseSheet({ visible, onClose, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(false);

  const runSearch = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const rows = await searchExercises(q);
      setResults(rows);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    runSearch(query);
  }, [query, visible, runSearch]);

  useEffect(() => {
    if (visible) {
      setQuery("");
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/60 justify-end" onPress={onClose}>
        <Pressable>
          <View className="bg-surface-2 h-[70%]">
            {/* Header */}
            <View className="flex-row items-center justify-between px-4 py-4 border-b border-surface-3">
              <Text className="font-anton text-white text-lg tracking-widest uppercase">
                Add Exercise
              </Text>
              <TouchableOpacity onPress={onClose} hitSlop={8}>
                <X size={20} color="#606060" />
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View className="flex-row items-center gap-2 px-4 py-3 border-b border-surface-3">
              <Search size={16} color="#606060" />
              <TextInput
                className="flex-1 font-mono text-white text-sm"
                placeholder="Search exercises..."
                placeholderTextColor="#606060"
                value={query}
                onChangeText={setQuery}
                autoFocus
                autoCorrect={false}
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => setQuery("")} hitSlop={8}>
                  <X size={14} color="#606060" />
                </TouchableOpacity>
              )}
            </View>

            {/* Results */}
            {loading ? (
              <ActivityIndicator color="#FF0000" className="mt-8" />
            ) : (
              <FlatList
                data={results}
                keyExtractor={(item) => String(item.id)}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => {
                      onSelect(item);
                      onClose();
                    }}
                    className="flex-row items-center justify-between px-4 py-3.5 border-b border-surface-3"
                    activeOpacity={0.7}
                  >
                    <View className="flex-1">
                      <Text className="font-montserrat-semibold text-white text-sm">
                        {item.name}
                      </Text>
                      <Text className="font-mono text-text-muted text-xs tracking-wider uppercase mt-0.5">
                        {item.muscle_group} · {item.equipment_type}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View className="items-center mt-12">
                    <Text className="font-montserrat text-text-muted text-sm">
                      No exercises found
                    </Text>
                  </View>
                }
              />
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
