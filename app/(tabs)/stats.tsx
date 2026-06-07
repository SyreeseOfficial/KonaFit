import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function StatsScreen() {
  return (
    <SafeAreaView className="flex-1 bg-obsidian">
      <View className="flex-1 px-4 pt-4">
        <Text className="font-anton text-white text-3xl tracking-widest uppercase mb-1">
          Command Center
        </Text>
        <Text className="font-montserrat text-text-muted text-xs tracking-widest uppercase mb-8">
          Stats
        </Text>

        <View className="flex-1 items-center justify-center">
          <Text className="font-montserrat text-text-secondary text-sm text-center">
            Analytics and performance insights live here.{"\n"}Phase 4 incoming.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
