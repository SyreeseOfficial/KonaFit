import "../global.css";
import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { Anton_400Regular } from "@expo-google-fonts/anton";
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
import { View } from "react-native";

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    anton: Anton_400Regular,
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
    return <View className="flex-1 bg-obsidian" />;
  }

  return (
    <>
      <StatusBar style="light" backgroundColor="#0A0A0A" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="tools" options={{ presentation: "modal" }} />
      </Stack>
    </>
  );
}
