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
    <SafeAreaView className="flex-1 bg-obsidian dark:bg-zinc-950" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 pt-5 pb-5 border-b border-surface-2 dark:border-zinc-800">
        <Text className="font-montserrat-bold text-text-primary dark:text-white text-2xl">
          Tools
        </Text>
        <TouchableOpacity onPress={() => router.back()} hitSlop={8} activeOpacity={0.7}>
          <X size={22} color="#94A3B8" />
        </TouchableOpacity>
      </View>

      {/* Tab switcher */}
      <View className="flex-row border-b border-surface-2 dark:border-zinc-800 bg-surface dark:bg-zinc-900">
        {([
          { key: "plates" as Tab, label: "Plate Calc" },
          { key: "percent" as Tab, label: "% Calc" },
        ]).map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            onPress={() => setActiveTab(key)}
            className={`flex-1 py-4 items-center border-b-2 ${
              activeTab === key ? "border-crimson dark:border-blue-400" : "border-transparent"
            }`}
            activeOpacity={0.7}
          >
            <Text
              className={`font-montserrat-semibold text-sm ${
                activeTab === key ? "text-crimson dark:text-blue-400" : "text-text-muted dark:text-zinc-500"
              }`}
            >
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 20, paddingBottom: 64 }}
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
