import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { Scale, Zap } from "lucide-react-native";
import { logBodyweight, logLifestyle } from "../../db/statsQueries";

type Props = { onSaved: () => void };

const CAFFEINE_PRESETS = [100, 150, 200, 300];

export function LifestyleLogger({ onSaved }: Props) {
  const [bodyweight, setBodyweight] = useState("");
  const [caffeineMg, setCaffeineMg] = useState("");
  const [saving, setSaving] = useState(false);
  const [bwSaved, setBwSaved] = useState(false);
  const [caffSaved, setCaffSaved] = useState(false);

  const handleSaveBodyweight = async () => {
    const val = parseFloat(bodyweight);
    if (isNaN(val) || val <= 0) return;
    setSaving(true);
    try {
      await logBodyweight(val);
      setBodyweight("");
      setBwSaved(true);
      setTimeout(() => setBwSaved(false), 2000);
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCaffeine = async () => {
    const mg = caffeineMg === "" ? 0 : parseInt(caffeineMg, 10);
    if (isNaN(mg) || mg < 0) return;
    setSaving(true);
    try {
      await logLifestyle({ caffeineM: mg });
      setCaffeineMg("");
      setCaffSaved(true);
      setTimeout(() => setCaffSaved(false), 2000);
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "flex-1 h-10 bg-surface-2 px-3 font-mono text-white text-sm";

  return (
    <View className="gap-3">
      {/* Bodyweight */}
      <View className="bg-surface p-4">
        <View className="flex-row items-center gap-2 mb-3">
          <Scale size={14} color="#606060" />
          <Text className="font-montserrat-semibold text-text-secondary text-xs tracking-widest uppercase">
            Bodyweight
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <TextInput
            className={inputClass}
            placeholder="lbs"
            placeholderTextColor="#606060"
            value={bodyweight}
            onChangeText={setBodyweight}
            keyboardType="decimal-pad"
            returnKeyType="done"
            onSubmitEditing={handleSaveBodyweight}
          />
          <TouchableOpacity
            onPress={handleSaveBodyweight}
            disabled={saving || bodyweight === ""}
            className={`px-4 h-10 items-center justify-center ${
              bwSaved ? "bg-surface-2" : bodyweight !== "" ? "bg-crimson" : "bg-surface-3"
            }`}
            activeOpacity={0.8}
          >
            <Text className={`font-montserrat-bold text-xs tracking-widest uppercase ${bwSaved ? "text-crimson" : "text-white"}`}>
              {bwSaved ? "Saved ✓" : "Log"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Pre-workout / Caffeine */}
      <View className="bg-surface p-4">
        <View className="flex-row items-center gap-2 mb-3">
          <Zap size={14} color="#606060" />
          <Text className="font-montserrat-semibold text-text-secondary text-xs tracking-widest uppercase">
            Pre-Workout
          </Text>
          <Text className="font-mono text-text-muted text-xs ml-1">caffeine mg</Text>
        </View>

        {/* Quick presets */}
        <View className="flex-row gap-2 mb-3">
          {CAFFEINE_PRESETS.map((mg) => (
            <TouchableOpacity
              key={mg}
              onPress={() => setCaffeineMg(String(mg))}
              className={`flex-1 py-2 items-center ${caffeineMg === String(mg) ? "bg-crimson" : "bg-surface-2"}`}
              activeOpacity={0.7}
            >
              <Text className={`font-mono text-xs ${caffeineMg === String(mg) ? "text-white" : "text-text-muted"}`}>
                {mg}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View className="flex-row items-center gap-2">
          <TextInput
            className={inputClass}
            placeholder="0 mg (skip)"
            placeholderTextColor="#606060"
            value={caffeineMg}
            onChangeText={setCaffeineMg}
            keyboardType="number-pad"
            returnKeyType="done"
            onSubmitEditing={handleSaveCaffeine}
          />
          <TouchableOpacity
            onPress={handleSaveCaffeine}
            disabled={saving}
            className={`px-4 h-10 items-center justify-center ${
              caffSaved ? "bg-surface-2" : "bg-surface-3"
            }`}
            activeOpacity={0.8}
          >
            <Text className={`font-montserrat-bold text-xs tracking-widest uppercase ${caffSaved ? "text-crimson" : "text-text-secondary"}`}>
              {caffSaved ? "Saved ✓" : "Log"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
