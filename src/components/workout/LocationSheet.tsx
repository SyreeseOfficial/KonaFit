import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Modal,
  Pressable,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from "react-native";
import { MapPin, Plus, X } from "lucide-react-native";
import { getLocations, type Location } from "../../db/locationQueries";

type Props = {
  visible: boolean;
  onSelect: (location: string | null) => void; // null = skip
};

export function LocationSheet({ visible, onSelect }: Props) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [inputText, setInputText] = useState("");
  const [showInput, setShowInput] = useState(false);

  useEffect(() => {
    if (visible) {
      setInputText("");
      setShowInput(false);
      getLocations().then(setLocations);
    }
  }, [visible]);

  const handleSelect = useCallback(
    (name: string) => {
      setInputText("");
      onSelect(name);
    },
    [onSelect]
  );

  const handleConfirmNew = useCallback(() => {
    const trimmed = inputText.trim();
    if (!trimmed) return;
    onSelect(trimmed);
  }, [inputText, onSelect]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => onSelect(null)}
    >
      <Pressable
        className="flex-1 bg-black/60 justify-end"
        onPress={() => onSelect(null)}
      >
        <Pressable>
          <View className="bg-surface-2 pb-10">
            {/* Header */}
            <View className="flex-row items-center justify-between px-4 py-4 border-b border-surface-3">
              <View className="flex-row items-center gap-2">
                <MapPin size={16} color="#606060" />
                <Text className="font-anton text-white text-lg tracking-widest uppercase">
                  Where did you train?
                </Text>
              </View>
              <TouchableOpacity onPress={() => onSelect(null)} hitSlop={8}>
                <X size={18} color="#606060" />
              </TouchableOpacity>
            </View>

            {/* Saved locations */}
            {locations.length > 0 && (
              <ScrollView
                style={{ maxHeight: 280 }}
                keyboardShouldPersistTaps="handled"
              >
                {locations.map((loc) => (
                  <TouchableOpacity
                    key={loc.id}
                    onPress={() => handleSelect(loc.name)}
                    className="flex-row items-center justify-between px-4 py-4 border-b border-surface-3"
                    activeOpacity={0.7}
                  >
                    <View className="flex-row items-center gap-3">
                      <MapPin size={14} color="#A0A0A0" />
                      <Text className="font-montserrat-semibold text-white text-sm">
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
              <View className="px-4 pt-3 pb-1">
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
                    className={`h-11 px-4 items-center justify-center ${inputText.trim() ? "bg-crimson" : "bg-surface-3"}`}
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
                className="flex-row items-center gap-3 px-4 py-4 border-b border-surface-3"
                activeOpacity={0.7}
              >
                <Plus size={14} color="#A0A0A0" />
                <Text className="font-montserrat-semibold text-text-secondary text-sm">
                  {locations.length === 0 ? "Add a location" : "New location..."}
                </Text>
              </TouchableOpacity>
            )}

            {/* Skip */}
            <TouchableOpacity
              onPress={() => onSelect(null)}
              className="mx-4 mt-3 py-3 items-center"
              activeOpacity={0.7}
            >
              <Text className="font-montserrat text-text-muted text-sm">
                Skip
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
