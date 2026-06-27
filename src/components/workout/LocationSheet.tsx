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
          className="flex-1 bg-black/60 justify-end"
          onPress={onCancel}
        >
          <Pressable>
            <View className="bg-surface-2">
              {/* Header */}
              <View className="flex-row items-center justify-between px-4 py-4 border-b border-surface-3">
                <View>
                  <Text className="font-anton text-white text-lg tracking-widest uppercase">
                    Finish Workout
                  </Text>
                  {selectedLocation ? (
                    <View className="flex-row items-center gap-1 mt-0.5">
                      <MapPin size={10} color="#FF0000" />
                      <Text className="font-mono text-crimson text-xs">{selectedLocation}</Text>
                    </View>
                  ) : null}
                </View>
                <TouchableOpacity onPress={onCancel} hitSlop={8}>
                  <X size={18} color="#606060" />
                </TouchableOpacity>
              </View>

              {/* Location label */}
              <View className="px-4 pt-3 pb-1">
                <Text className="font-mono text-text-muted text-xs tracking-widest uppercase">
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
                      className={`flex-row items-center justify-between px-4 py-3.5 border-b border-surface-3 ${
                        selectedLocation === loc.name ? "bg-surface-3" : ""
                      }`}
                      activeOpacity={0.7}
                    >
                      <View className="flex-row items-center gap-3">
                        <MapPin
                          size={14}
                          color={selectedLocation === loc.name ? "#FF0000" : "#A0A0A0"}
                        />
                        <Text
                          className={`font-montserrat-semibold text-sm ${
                            selectedLocation === loc.name ? "text-crimson" : "text-white"
                          }`}
                        >
                          {loc.name}
                        </Text>
                      </View>
                      <View className="bg-surface-3 px-2 py-0.5">
                        <Text className="font-mono text-text-muted text-xs">
                          {loc.use_count}×
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              {/* New location input */}
              {showInput ? (
                <View className="px-4 pt-2 pb-1">
                  <View className="flex-row items-center gap-2">
                    <TextInput
                      className="flex-1 h-11 bg-surface-3 px-3 font-montserrat text-white text-sm"
                      placeholder="Type location name..."
                      placeholderTextColor="#606060"
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
                      className={`h-11 px-4 items-center justify-center ${
                        inputText.trim() ? "bg-crimson" : "bg-surface-3"
                      }`}
                      activeOpacity={0.8}
                    >
                      <Text className="font-montserrat-bold text-white text-xs tracking-widest uppercase">
                        Use
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => setShowInput(true)}
                  className="flex-row items-center gap-3 px-4 py-3.5 border-b border-surface-3"
                  activeOpacity={0.7}
                >
                  <Plus size={14} color="#A0A0A0" />
                  <Text className="font-montserrat-semibold text-text-secondary text-sm">
                    {locations.length === 0 ? "Add a location" : "New location..."}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Actions */}
              <View className="px-4 pt-4 pb-10" style={{ gap: 8 }}>
                <TouchableOpacity
                  onPress={() => onSave(selectedLocation)}
                  className="bg-crimson py-4 items-center"
                  activeOpacity={0.8}
                >
                  <Text className="font-montserrat-bold text-white text-sm tracking-widest uppercase">
                    Save Workout
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleDiscard}
                  className="py-3 items-center"
                  activeOpacity={0.7}
                >
                  <Text className="font-montserrat text-text-muted text-sm">
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
