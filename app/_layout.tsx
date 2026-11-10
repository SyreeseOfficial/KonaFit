import "../global.css";
import { useEffect, useState } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
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
import { deleteUnfinishedWorkouts, purgeDeletedExercises } from "../src/db/workoutQueries";
import { removeOrphanPhotos } from "../src/utils/photoFiles";
import { loadCachedSession } from "../src/utils/sessionCache";
import { loadHapticsSetting } from "../src/utils/haptics";
import { loadTheme } from "../src/utils/theme";
import { Platform, UIManager, View, Text, TouchableOpacity, Share } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

if (Platform.OS === "android") {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

SplashScreen.preventAutoHideAsync().catch(() => {}); // keep the native splash up until fonts and the database are ready

type Boot = { status: "loading" } | { status: "ready" } | { status: "error"; message: string };

// Everything the first screen reads (database, theme, haptics) must be ready before it renders.
async function boot() {
  await initializeDatabase();
  // Unfinished workouts are leftovers from crashes or failed starts, except the one a saved session can still resume.
  const cached = await loadCachedSession();
  await deleteUnfinishedWorkouts(cached?.workoutId ?? null).catch(console.error);
  await purgeDeletedExercises().catch(console.error);
  await removeOrphanPhotos().catch(console.error);
  await Promise.all([loadHapticsSetting(), loadTheme()]);
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
  const [state, setState] = useState<Boot>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    boot()
      .then(() => { if (!cancelled) setState({ status: "ready" }); })
      .catch((e) => {
        console.error("Startup failed", e);
        if (!cancelled) setState({ status: "error", message: String(e?.message ?? e) });
      });
    return () => { cancelled = true; };
  }, [attempt]);

  const ready = fontsLoaded && state.status === "ready";
  useEffect(() => {
    if (ready || state.status === "error") SplashScreen.hide();
  }, [ready, state.status]);

  if (state.status === "error") {
    return (
      <SafeAreaProvider>
        <View className="flex-1 items-center justify-center px-8 bg-obsidian dark:bg-zinc-950">
          <Text className="font-montserrat-bold text-text-primary dark:text-white text-2xl mb-2">Couldn&apos;t open your data</Text>
          <Text className="font-montserrat text-text-secondary dark:text-zinc-400 text-sm text-center mb-6">
            Nothing was changed. Try again; if it keeps failing, send the error so it can be fixed.
          </Text>
          <TouchableOpacity
            onPress={() => { setState({ status: "loading" }); setAttempt((a) => a + 1); }}
            className="bg-crimson dark:bg-blue-500 py-4 px-10 rounded-xl mb-3"
            activeOpacity={0.8}
          >
            <Text className="font-montserrat-bold text-white text-sm">Try again</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => Share.share({ message: `KonaFit startup error: ${state.message}` })}
            className="py-3 px-10"
            activeOpacity={0.7}
          >
            <Text className="font-montserrat-semibold text-text-secondary dark:text-zinc-400 text-sm">Share error</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaProvider>
    );
  }

  if (!ready) return null; // the splash is still showing

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
