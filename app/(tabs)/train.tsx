import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function TrainScreen() {
  return (
    <SafeAreaView className="flex-1 bg-obsidian">
      <View className="flex-1 px-4 pt-4">
        <Text className="font-anton text-white text-3xl tracking-widest uppercase mb-1">
          The Workspace
        </Text>
        <Text className="font-montserrat text-text-muted text-xs tracking-widest uppercase mb-8">
          Train
        </Text>

        <View className="flex-1 items-center justify-center">
          <Text className="font-montserrat text-text-secondary text-sm text-center">
            Your workout logger lives here.{"\n"}Phase 2 incoming.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
