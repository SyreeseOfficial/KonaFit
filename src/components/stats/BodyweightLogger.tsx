import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert } from "react-native";
import { Scale } from "lucide-react-native";
import { logBodyweight, getLatestBodyweight } from "../../db/statsQueries";
import { useEffect } from "react";

type Props = { onSaved: () => void };

export function BodyweightLogger({ onSaved }: Props) {
  const [weight, setWeight] = useState("");
  const [latest, setLatest] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getLatestBodyweight().then(setLatest);
  }, []);

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
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="bg-surface p-4">
      <View className="flex-row items-center gap-2 mb-3">
        <Scale size={14} color="#606060" />
        <Text className="font-montserrat-semibold text-text-secondary text-xs tracking-widest uppercase">
          Bodyweight
        </Text>
        {latest != null && (
          <Text className="font-mono text-text-muted text-xs ml-auto">
            Last: {latest} lbs
          </Text>
        )}
      </View>
      <View className="flex-row items-center gap-2">
        <TextInput
          className="flex-1 h-10 bg-surface-2 px-3 font-mono text-white text-sm"
          placeholder="lbs"
          placeholderTextColor="#606060"
          value={weight}
          onChangeText={setWeight}
          keyboardType="decimal-pad"
          returnKeyType="done"
          onSubmitEditing={handleLog}
        />
        <TouchableOpacity
          onPress={handleLog}
          disabled={saving || weight === ""}
          className={`px-5 h-10 items-center justify-center ${weight !== "" ? "bg-crimson" : "bg-surface-3"}`}
          activeOpacity={0.8}
        >
          <Text className={`font-montserrat-bold text-xs tracking-widest uppercase ${weight !== "" ? "text-white" : "text-text-muted"}`}>
            Log
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
