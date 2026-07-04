import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { MapPin, Plus, X } from "lucide-react-native";
import { getLocations, type Location } from "../../db/locationQueries";

type Props = {
  visible: boolean;
  onSave: (location: string | null) => void;
  onDiscard: () => void;
  onCancel: () => void;
};

export function LocationSheet({ visible, onSave, onDiscard, onCancel }: Props) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [inputText, setInputText] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setInputText("");
      setShowInput(false);
      setSelectedLocation(null);
      getLocations().then(setLocations);
    }
  }, [visible]);

  const handleSelectSaved = useCallback((name: string) => {
    setSelectedLocation((prev) => (prev === name ? null : name));
    setShowInput(false);
    setInputText("");
  }, []);

  const handleConfirmNew = useCallback(() => {
    const trimmed = inputText.trim();
    if (!trimmed) return;
    setSelectedLocation(trimmed);
    setInputText("");
    setShowInput(false);
  }, [inputText]);

  const handleDiscard = useCallback(() => {
    Alert.alert(
      "Discard Workout",
      "Delete this workout? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Discard", style: "destructive", onPress: onDiscard },
      ]
    );
  }, [onDiscard]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <Pressable
          className="flex-1 bg-black/50 justify-end"
          onPress={onCancel}
        >
          <Pressable>
            <View className="bg-surface dark:bg-zinc-900 rounded-t-3xl">
              {/* Header */}
              <View className="flex-row items-center justify-between px-5 py-5 border-b border-surface-2 dark:border-zinc-800">
                <View>
                  <Text className="font-montserrat-bold text-text-primary dark:text-white text-xl">
                    Finish Workout
                  </Text>
                  {selectedLocation ? (
                    <View className="flex-row items-center gap-1 mt-1">
                      <MapPin size={11} color="#2563EB" />
                      <Text className="font-montserrat text-crimson dark:text-blue-400 text-sm">{selectedLocation}</Text>
                    </View>
                  ) : null}
                </View>
                <TouchableOpacity onPress={onCancel} hitSlop={8}>
                  <X size={20} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              {/* Location label */}
              <View className="px-5 pt-4 pb-1">
                <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-sm">
                  Where did you train? (optional)
                </Text>
              </View>

              {/* Saved locations */}
              {locations.length > 0 && (
                <ScrollView
                  style={{ maxHeight: 200 }}
                  keyboardShouldPersistTaps="handled"
                >
                  {locations.map((loc) => (
                    <TouchableOpacity
                      key={loc.id}
                      onPress={() => handleSelectSaved(loc.name)}
                      className={`flex-row items-center justify-between px-5 py-4 border-b border-surface-2 dark:border-zinc-800 ${
                        selectedLocation === loc.name ? "bg-blue-50 dark:bg-blue-950" : ""
                      }`}
                      activeOpacity={0.7}
                    >
                      <View className="flex-row items-center gap-3">
                        <MapPin
                          size={15}
                          color={selectedLocation === loc.name ? "#2563EB" : "#94A3B8"}
                        />
                        <Text
                          className={`font-montserrat-semibold text-base ${
                            selectedLocation === loc.name ? "text-crimson dark:text-blue-400" : "text-text-primary dark:text-white"
                          }`}
                        >
                          {loc.name}
                        </Text>
                      </View>
                      <View className="bg-surface-2 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                        <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs">
                          {loc.use_count}×
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              {/* New location input */}
              {showInput ? (
                <View className="px-5 pt-2 pb-1">
                  <View className="flex-row items-center gap-2">
                    <TextInput
                      className="flex-1 h-12 bg-surface-2 dark:bg-zinc-800 px-4 font-montserrat text-text-primary dark:text-white text-base rounded-xl"
                      placeholder="Type location name…"
                      placeholderTextColor="#94A3B8"
                      value={inputText}
                      onChangeText={setInputText}
                      autoFocus
                      returnKeyType="done"
                      onSubmitEditing={handleConfirmNew}
                      autoCorrect={false}
                    />
                    <TouchableOpacity
                      onPress={handleConfirmNew}
                      disabled={inputText.trim() === ""}
                      className={`h-12 px-5 items-center justify-center rounded-xl ${
                        inputText.trim() ? "bg-crimson dark:bg-blue-500" : "bg-surface-2 dark:bg-zinc-800"
                      }`}
                      activeOpacity={0.85}
                    >
                      <Text className="font-montserrat-bold text-white text-sm">
                        Use
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => setShowInput(true)}
                  className="flex-row items-center gap-3 px-5 py-4 border-b border-surface-2 dark:border-zinc-800"
                  activeOpacity={0.7}
                >
                  <Plus size={15} color="#94A3B8" />
                  <Text className="font-montserrat-semibold text-text-secondary dark:text-zinc-400 text-base">
                    {locations.length === 0 ? "Add a location" : "New location…"}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Actions */}
              <View className="px-5 pt-4 pb-10" style={{ gap: 8 }}>
                <TouchableOpacity
                  onPress={() => onSave(selectedLocation)}
                  className="bg-crimson dark:bg-blue-500 py-4 items-center rounded-2xl"
                  activeOpacity={0.85}
                >
                  <Text className="font-montserrat-bold text-white text-base">
                    Save Workout
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleDiscard}
                  className="py-3 items-center"
                  activeOpacity={0.7}
                >
                  <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-base">
                    Discard Workout
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
