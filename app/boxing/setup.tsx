import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Stub: replaced by the real setup screen in Step 3.2.
export default function BoxingSetup() {
  return (
    <SafeAreaView className="flex-1 bg-obsidian dark:bg-zinc-950 items-center justify-center">
      <Text className="font-montserrat text-text-primary dark:text-white">Boxing setup</Text>
      <View />
    </SafeAreaView>
  );
}
