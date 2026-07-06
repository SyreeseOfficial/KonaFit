import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { Scale } from "lucide-react-native";
import { logBodyweight } from "../../db/statsQueries";

type Props = { onSaved: () => void };

export function LifestyleLogger({ onSaved }: Props) {
  const [bodyweight, setBodyweight] = useState("");
  const [saving, setSaving] = useState(false);
  const [bwSaved, setBwSaved] = useState(false);

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

  return (
    <View className="bg-surface dark:bg-zinc-900 p-5 rounded-2xl">
      <View className="flex-row items-center gap-2 mb-4">
        <Scale size={14} color="#94A3B8" />
        <Text className="font-montserrat-semibold text-text-secondary dark:text-zinc-400 text-sm uppercase tracking-widest">
          Bodyweight
        </Text>
      </View>
      <View className="flex-row items-center gap-2">
        <TextInput
          className="flex-1 h-11 bg-surface-2 dark:bg-zinc-800 px-4 font-mono text-text-primary dark:text-white text-base rounded-xl"
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
  );
}
