import { View, Text, Share } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Button } from "./Button";

/** Full-screen "something went wrong" page: explains, and offers the safe ways forward. Never touches workout data on its own. */
export function RecoveryScreen({ title, message, detail, onRetry, retryLabel = "Try again", onResetCache }: {
  title: string;
  message: string;
  detail?: string;
  onRetry: () => void;
  retryLabel?: string;
  onResetCache?: () => void;
}) {
  return (
    <SafeAreaProvider>
      <View className="flex-1 items-center justify-center px-8 bg-obsidian dark:bg-zinc-950" style={{ gap: 12 }}>
        <Text className="font-montserrat-bold text-text-primary dark:text-white text-2xl text-center">{title}</Text>
        <Text className="font-montserrat text-text-secondary dark:text-zinc-400 text-sm text-center mb-3">{message}</Text>
        <Button label={retryLabel} onPress={onRetry} className="self-stretch" />
        {onResetCache && <Button label="Reset UI cache" variant="secondary" onPress={onResetCache} className="self-stretch" />}
        {detail && <Button label="Share error" variant="ghost" onPress={() => Share.share({ message: `KonaFit error: ${detail}` })} />}
      </View>
    </SafeAreaProvider>
  );
}
