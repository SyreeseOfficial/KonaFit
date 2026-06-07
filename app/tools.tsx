import { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { X } from "lucide-react-native";
import { PlateCalculator } from "../src/components/tools/PlateCalculator";
import { PercentageCalculator } from "../src/components/tools/PercentageCalculator";

type Tab = "plates" | "percent";

export default function ToolsScreen() {
  const { tab: initialTab, oneRM: oneRMParam } = useLocalSearchParams<{
    tab?: Tab;
    oneRM?: string;
  }>();

  const [activeTab, setActiveTab] = useState<Tab>(initialTab ?? "plates");
  const [plateWeight, setPlateWeight] = useState<number | undefined>(undefined);

  const oneRM = oneRMParam ? parseFloat(oneRMParam) : undefined;

  const handleSelectWeight = (weight: number) => {
    setPlateWeight(weight);
    setActiveTab("plates");
  };

  return (
    <SafeAreaView className="flex-1 bg-obsidian" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 pt-3 pb-4 border-b border-surface-2">
        <Text className="font-anton text-white text-2xl tracking-widest uppercase">
          Tactical Tools
        </Text>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} activeOpacity={0.7}>
          <X size={22} color="#A0A0A0" />
        </TouchableOpacity>
      </View>

      {/* Tab switcher */}
      <View className="flex-row border-b border-surface-2">
        {([
          { key: "plates" as Tab, label: "Plate Calc" },
          { key: "percent" as Tab, label: "% Calc" },
        ]).map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            onPress={() => setActiveTab(key)}
            className={`flex-1 py-3 items-center border-b-2 ${
              activeTab === key ? "border-crimson" : "border-transparent"
            }`}
            activeOpacity={0.7}
          >
            <Text
              className={`font-montserrat-bold text-xs tracking-widest uppercase ${
                activeTab === key ? "text-white" : "text-text-muted"
              }`}
            >
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
      >
        {activeTab === "plates" ? (
          <PlateCalculator key={plateWeight} initialWeight={plateWeight} />
        ) : (
          <PercentageCalculator
            initialOneRM={oneRM}
            onSelectWeight={handleSelectWeight}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
