import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Alert } from "react-native";
import { Droplets, Zap, MapPin, Scale } from "lucide-react-native";
import { logBodyweight, logLifestyle } from "../../db/statsQueries";

type Props = { onSaved: () => void };

export function LifestyleLogger({ onSaved }: Props) {
  const [bodyweight, setBodyweight] = useState("");
  const [hydration, setHydration] = useState("");
  const [preWorkout, setPreWorkout] = useState(false);
  const [location, setLocation] = useState("");
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
    } finally {
      setSaving(false);
    }
  };

  const handleSaveLifestyle = async () => {
    const hydOz = hydration !== "" ? parseFloat(hydration) : undefined;
    setSaving(true);
    try {
      await logLifestyle({
        hydrationOz: isNaN(hydOz!) ? undefined : hydOz,
        preWorkout,
        location: location.trim() || undefined,
      });
      setHydration("");
      setLocation("");
      setPreWorkout(false);
      onSaved();
      Alert.alert("Logged", "Lifestyle data saved.");
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "flex-1 h-10 bg-surface-2 px-3 font-mono text-white text-sm";

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
            className={`px-4 h-10 items-center justify-center ${bwSaved ? "bg-surface-2" : bodyweight !== "" ? "bg-crimson" : "bg-surface-3"}`}
            activeOpacity={0.8}
            disabled={saving || bodyweight === ""}
          >
            <Text className={`font-montserrat-bold text-xs tracking-widest uppercase ${bwSaved ? "text-crimson" : "text-white"}`}>
              {bwSaved ? "Saved ✓" : "Log"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Daily lifestyle */}
      <View className="bg-surface p-4">
        <Text className="font-montserrat-semibold text-text-secondary text-xs tracking-widest uppercase mb-3">
          Daily Log
        </Text>

        {/* Hydration */}
        <View className="flex-row items-center gap-2 mb-2.5">
          <Droplets size={14} color="#606060" />
          <Text className="font-mono text-text-muted text-xs w-20 tracking-wider">
            Hydration
          </Text>
          <TextInput
            className={inputClass}
            placeholder="oz"
            placeholderTextColor="#606060"
            value={hydration}
            onChangeText={setHydration}
            keyboardType="decimal-pad"
          />
        </View>

        {/* Pre-workout */}
        <TouchableOpacity
          onPress={() => setPreWorkout((p) => !p)}
          className="flex-row items-center gap-2 mb-2.5"
          activeOpacity={0.7}
        >
          <Zap size={14} color={preWorkout ? "#FF0000" : "#606060"} />
          <Text className="font-mono text-text-muted text-xs w-20 tracking-wider">
            Pre-workout
          </Text>
          <View
            className={`flex-1 h-10 items-center justify-center ${
              preWorkout ? "bg-crimson" : "bg-surface-2"
            }`}
          >
            <Text
              className={`font-montserrat-bold text-xs tracking-widest uppercase ${
                preWorkout ? "text-white" : "text-text-muted"
              }`}
            >
              {preWorkout ? "Yes" : "No"}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Location */}
        <View className="flex-row items-center gap-2 mb-4">
          <MapPin size={14} color="#606060" />
          <Text className="font-mono text-text-muted text-xs w-20 tracking-wider">
            Location
          </Text>
          <TextInput
            className={inputClass}
            placeholder="gym, home, etc."
            placeholderTextColor="#606060"
            value={location}
            onChangeText={setLocation}
            autoCorrect={false}
          />
        </View>

        <TouchableOpacity
          onPress={handleSaveLifestyle}
          className="bg-surface-2 py-2.5 items-center"
          activeOpacity={0.8}
          disabled={saving}
        >
          <Text className="font-montserrat-bold text-text-secondary text-xs tracking-widest uppercase">
            Save Daily Log
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
