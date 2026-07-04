import { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { Scale } from "lucide-react-native";
import { logBodyweight, getLatestBodyweight } from "../../db/statsQueries";

type Props = { onSaved: () => void };

export function BodyweightLogger({ onSaved }: Props) {
  const [weight, setWeight] = useState("");
  const [latest, setLatest] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { getLatestBodyweight().then(setLatest); }, []);

  const handleLog = async () => {
    const val = parseFloat(weight);
    if (isNaN(val) || val <= 0) return;
    setSaving(true);
    try {
      await logBodyweight(val);
      setWeight("");
      const updated = await getLatestBodyweight();
      setLatest(updated);
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
        {latest != null && (
          <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs ml-auto">
            Last: {latest} lbs
          </Text>
        )}
      </View>
      <View className="flex-row items-center gap-2">
        <TextInput
          className="flex-1 h-11 bg-surface-2 dark:bg-zinc-800 px-4 font-mono text-text-primary dark:text-white text-base rounded-xl"
          placeholder="lbs"
          placeholderTextColor="#94A3B8"
          value={weight}
          onChangeText={setWeight}
          keyboardType="decimal-pad"
          returnKeyType="done"
          onSubmitEditing={handleLog}
        />
        <TouchableOpacity
          onPress={handleLog}
          disabled={saving || weight === ""}
          className={`h-11 px-5 items-center justify-center rounded-xl ${weight !== "" ? "bg-crimson dark:bg-blue-500" : "bg-surface-2 dark:bg-zinc-800"}`}
          activeOpacity={0.85}
        >
          <Text className={`font-montserrat-bold text-sm ${weight !== "" ? "text-white" : "text-text-muted dark:text-zinc-500"}`}>
            Log
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
