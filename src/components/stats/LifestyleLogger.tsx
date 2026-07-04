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
    } finally { setSaving(false); }
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
    } finally { setSaving(false); }
  };

  const inputClass = "flex-1 h-11 bg-surface-2 dark:bg-zinc-800 px-4 font-mono text-text-primary dark:text-white text-base rounded-xl";

  return (
    <View className="gap-3">
      {/* Bodyweight */}
      <View className="bg-surface dark:bg-zinc-900 p-5 rounded-2xl">
        <View className="flex-row items-center gap-2 mb-4">
          <Scale size={14} color="#94A3B8" />
          <Text className="font-montserrat-semibold text-text-secondary dark:text-zinc-400 text-sm uppercase tracking-widest">
            Bodyweight
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <TextInput
            className={inputClass}
            placeholder="lbs"
            placeholderTextColor="#94A3B8"
            value={bodyweight}
            onChangeText={setBodyweight}
            keyboardType="decimal-pad"
            returnKeyType="done"
            onSubmitEditing={handleSaveBodyweight}
          />
          <TouchableOpacity
            onPress={handleSaveBodyweight}
            disabled={saving || bodyweight === ""}
            className={`h-11 px-5 items-center justify-center rounded-xl ${
              bwSaved ? "bg-emerald-50 dark:bg-emerald-950" : bodyweight !== "" ? "bg-crimson dark:bg-blue-500" : "bg-surface-2 dark:bg-zinc-800"
            }`}
            activeOpacity={0.85}
          >
            <Text className={`font-montserrat-bold text-sm ${bwSaved ? "text-emerald-600 dark:text-emerald-400" : "text-white"}`}>
              {bwSaved ? "Saved ✓" : "Log"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Caffeine */}
      <View className="bg-surface dark:bg-zinc-900 p-5 rounded-2xl">
        <View className="flex-row items-center gap-2 mb-4">
          <Zap size={14} color="#94A3B8" />
          <Text className="font-montserrat-semibold text-text-secondary dark:text-zinc-400 text-sm uppercase tracking-widest">
            Pre-Workout
          </Text>
          <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs ml-1">caffeine mg</Text>
        </View>

        <View className="flex-row gap-2 mb-3">
          {CAFFEINE_PRESETS.map((mg) => (
            <TouchableOpacity
              key={mg}
              onPress={() => setCaffeineMg(String(mg))}
              className={`flex-1 py-2.5 items-center rounded-full border ${
                caffeineMg === String(mg)
                  ? "bg-crimson dark:bg-blue-500 border-crimson dark:border-blue-500"
                  : "bg-surface-2 dark:bg-zinc-800 border-surface-3 dark:border-zinc-700"
              }`}
              activeOpacity={0.7}
            >
              <Text className={`font-mono text-xs ${caffeineMg === String(mg) ? "text-white" : "text-text-muted dark:text-zinc-500"}`}>
                {mg}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View className="flex-row items-center gap-2">
          <TextInput
            className={inputClass}
            placeholder="0 mg (skip)"
            placeholderTextColor="#94A3B8"
            value={caffeineMg}
            onChangeText={setCaffeineMg}
            keyboardType="number-pad"
            returnKeyType="done"
            onSubmitEditing={handleSaveCaffeine}
          />
          <TouchableOpacity
            onPress={handleSaveCaffeine}
            disabled={saving}
            className={`h-11 px-5 items-center justify-center rounded-xl ${
              caffSaved
                ? "bg-emerald-50 dark:bg-emerald-950"
                : caffeineMg !== ""
                ? "bg-crimson dark:bg-blue-500"
                : "bg-surface-2 dark:bg-zinc-800"
            }`}
            activeOpacity={0.85}
          >
            <Text className={`font-montserrat-bold text-sm ${caffSaved ? "text-emerald-600 dark:text-emerald-400" : caffeineMg !== "" ? "text-white" : "text-text-muted dark:text-zinc-500"}`}>
              {caffSaved ? "Saved ✓" : "Log"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
