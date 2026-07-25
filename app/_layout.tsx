import "../global.css";
import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import {
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
  Montserrat_700Bold,
} from "@expo-google-fonts/montserrat";
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
} from "@expo-google-fonts/jetbrains-mono";
import { initializeDatabase } from "../src/db/database";
import { Platform, UIManager, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

if (Platform.OS === "android") {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    montserrat: Montserrat_400Regular,
    "montserrat-medium": Montserrat_500Medium,
    "montserrat-semibold": Montserrat_600SemiBold,
    "montserrat-bold": Montserrat_700Bold,
    mono: JetBrainsMono_400Regular,
    "mono-medium": JetBrainsMono_500Medium,
  });

  useEffect(() => {
    initializeDatabase().catch(console.error);
  }, []);

  if (!fontsLoaded) {
    return (
      <SafeAreaProvider>
        <View className="flex-1 bg-obsidian dark:bg-zinc-950" />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="tools" options={{ presentation: "modal" }} />
        <Stack.Screen name="workout/[id]" />
      </Stack>
    </SafeAreaProvider>
  );
}
