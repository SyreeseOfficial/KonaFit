import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MapPin, Plus, X } from "lucide-react-native";
import { getLocations, type Location } from "../../db/locationQueries";
import type { WorkoutFeel } from "../../db/workoutQueries";
import { confirm } from "../../utils/confirm";

/** "7.5" -> 7.5; blank or nonsense -> null; capped at 24 h. */
const parseSleepHours = (text: string): number | null => {
  const n = parseFloat(text.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.min(24, n) : null;
};

const LABEL = "font-montserrat-semibold text-text-muted dark:text-zinc-500 text-xs tracking-widest uppercase";

function ScorePicker({ label, low, high, value, onChange }: { label: string; low: string; high: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <View>
      <View className="flex-row items-center justify-between mb-2">
        <Text className="font-montserrat-semibold text-text-primary dark:text-white text-sm">{label}</Text>
        <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-xs">{value ? `${value} / 5` : `${low} to ${high}`}</Text>
      </View>
      <View className="flex-row" style={{ gap: 8 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <TouchableOpacity
            key={n}
            onPress={() => onChange(value === n ? null : n)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`${label} ${n} of 5`}
            accessibilityState={{ selected: value === n }}
            className={`flex-1 h-12 items-center justify-center rounded-xl ${value === n ? "bg-crimson dark:bg-blue-500" : "bg-surface-2 dark:bg-zinc-800"}`}
          >
            <Text className={`font-mono-medium text-base ${value === n ? "text-white" : "text-text-primary dark:text-white"}`}>{n}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

type Props = {
  visible: boolean;
  onSave: (location: string | null, feel: WorkoutFeel) => void;
  onDiscard: () => void;
  onCancel: () => void;
};

export function LocationSheet({ visible, onSave, onDiscard, onCancel }: Props) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [inputText, setInputText] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<string | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [sleep, setSleep] = useState("");

  useEffect(() => {
    if (visible) {
      setInputText("");
      setShowInput(false);
      setSelectedLocation(null);
      setRating(null);
      setEnergy(null);
      setSleep("");
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

  const handleDiscard = useCallback(async () => {
    if (await confirm({ title: "Discard Workout", message: "Delete this workout? This cannot be undone.", confirmText: "Discard", destructive: true })) onDiscard();
  }, [onDiscard]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <SafeAreaView className="flex-1 bg-surface dark:bg-zinc-900">
        <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View className="flex-1">
              {/* Header */}
              <View className="flex-row items-center justify-between px-5 pt-3 pb-5">
                <Text className="font-montserrat-bold text-text-primary dark:text-white text-2xl">Finish workout</Text>
                <TouchableOpacity onPress={onCancel} hitSlop={12} accessibilityLabel="Keep training">
                  <X size={22} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              <ScrollView className="flex-1" keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, gap: 28 }}>
                {/* Location */}
                <View>
                  <Text className={`${LABEL} mb-2`}>Where did you train?</Text>
                  <View style={{ gap: 8 }}>
                    {locations.map((loc) => {
                      const on = selectedLocation === loc.name;
                      return (
                        <TouchableOpacity
                          key={loc.id}
                          onPress={() => handleSelectSaved(loc.name)}
                          className={`flex-row items-center justify-between px-4 py-3.5 rounded-xl ${on ? "bg-crimson dark:bg-blue-500" : "bg-surface-2 dark:bg-zinc-800"}`}
                          activeOpacity={0.7}
                        >
                          <View className="flex-row items-center gap-3">
                            <MapPin size={16} color={on ? "#FFFFFF" : "#94A3B8"} />
                            <Text className={`font-montserrat-semibold text-base ${on ? "text-white" : "text-text-primary dark:text-white"}`}>{loc.name}</Text>
                          </View>
                          <Text className={`font-mono text-xs ${on ? "text-white/80" : "text-text-muted dark:text-zinc-500"}`}>{loc.use_count}×</Text>
                        </TouchableOpacity>
                      );
                    })}
                    {showInput ? (
                      <View className="flex-row items-center gap-2">
                        <TextInput
                          className="flex-1 h-12 bg-surface-2 dark:bg-zinc-800 px-4 font-montserrat text-text-primary dark:text-white text-base rounded-xl"
                          placeholder="Location name"
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
                          className={`h-12 px-5 items-center justify-center rounded-xl ${inputText.trim() ? "bg-crimson dark:bg-blue-500" : "bg-surface-2 dark:bg-zinc-800"}`}
                          activeOpacity={0.85}
                        >
                          <Text className={`font-montserrat-bold text-sm ${inputText.trim() ? "text-white" : "text-text-muted dark:text-zinc-500"}`}>Use</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity onPress={() => setShowInput(true)} className="flex-row items-center gap-3 px-4 py-3.5" activeOpacity={0.7}>
                        <Plus size={16} color="#94A3B8" />
                        <Text className="font-montserrat-semibold text-text-secondary dark:text-zinc-400 text-base">
                          {locations.length === 0 ? "Add a location" : "New location"}
                        </Text>
                      </TouchableOpacity>
                    )}
                    {selectedLocation && !locations.some((l) => l.name === selectedLocation) && (
                      <View className="flex-row items-center gap-3 px-4 py-3.5 rounded-xl bg-crimson dark:bg-blue-500">
                        <MapPin size={16} color="#FFFFFF" />
                        <Text className="font-montserrat-semibold text-base text-white">{selectedLocation}</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* How it felt (all optional) */}
                <View style={{ gap: 16 }}>
                  <Text className={LABEL}>How it felt (optional)</Text>
                  <ScorePicker label="Workout rating" low="rough" high="great" value={rating} onChange={setRating} />
                  <ScorePicker label="Energy" low="drained" high="charged" value={energy} onChange={setEnergy} />
                  <View className="flex-row items-center justify-between">
                    <Text className="font-montserrat-semibold text-text-primary dark:text-white text-sm">Sleep last night</Text>
                    <View className="flex-row items-center gap-2">
                      <TextInput
                        className="w-20 h-12 bg-surface-2 dark:bg-zinc-800 px-3 font-mono text-text-primary dark:text-white text-base rounded-xl text-center"
                        placeholder="7.5"
                        placeholderTextColor="#94A3B8"
                        value={sleep}
                        onChangeText={setSleep}
                        keyboardType="decimal-pad"
                        maxLength={4}
                      />
                      <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-sm">hours</Text>
                    </View>
                  </View>
                </View>
              </ScrollView>

              {/* Actions */}
              <View className="px-5 pt-3 pb-4" style={{ gap: 8 }}>
                <TouchableOpacity
                  onPress={() => onSave(selectedLocation, { rating, energy, sleepHours: parseSleepHours(sleep) })}
                  className="bg-crimson dark:bg-blue-500 py-4 items-center rounded-2xl"
                  activeOpacity={0.85}
                >
                  <Text className="font-montserrat-bold text-white text-base">Save workout</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleDiscard} className="py-3 items-center" activeOpacity={0.7}>
                  <Text className="font-montserrat-semibold text-rose-500 text-sm">Discard workout</Text>
                </TouchableOpacity>
              </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
