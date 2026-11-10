import "../global.css";
import { useEffect, useState } from "react";
import { Stack, type ErrorBoundaryProps } from "expo-router";
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
import { Platform, UIManager } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { RecoveryScreen } from "../src/components/RecoveryScreen";
import { CRASH_LIMIT, markStableSoon, registerLaunch, resetUiCache } from "../src/utils/bootGuard";
import { logError } from "../src/utils/errors";

if (Platform.OS === "android") {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

SplashScreen.preventAutoHideAsync().catch(() => {}); // keep the native splash up until fonts and the database are ready

type Boot = { status: "loading" } | { status: "recovery" } | { status: "ready" } | { status: "error"; message: string };

// Everything the first screen reads (database, theme, haptics) must be ready before it renders.
async function boot() {
  await initializeDatabase();
  // Unfinished workouts are leftovers from crashes or failed starts, except the one a saved session can still resume.
  const cached = await loadCachedSession();
  await deleteUnfinishedWorkouts(cached?.workoutId ?? null).catch(logError);
  await purgeDeletedExercises().catch(logError);
  await removeOrphanPhotos().catch(logError);
  await Promise.all([loadHapticsSetting(), loadTheme()]);
}

// Counted once per app launch (not per render): how many earlier launches never got stable.
const earlierCrashes = registerLaunch().catch(() => 0);

/** Shown by expo-router when a screen throws while rendering. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => { logError(error, "render"); }, [error]);
  return (
    <RecoveryScreen
      title="Something broke"
      message="Your workouts are safe. Try again; if it keeps happening, reset the saved screen state."
      detail={error.message}
      onRetry={retry}
      onResetCache={async () => { await resetUiCache().catch(logError); await retry(); }}
    />
  );
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
    (async () => {
      // After repeated crashes, ask before running anything that might be the cause (attempt 0 only; "Open KonaFit" bumps it).
      if (attempt === 0 && (await earlierCrashes) >= CRASH_LIMIT) {
        if (!cancelled) setState({ status: "recovery" });
        return;
      }
      await boot();
      if (!cancelled) setState({ status: "ready" });
    })().catch((e) => {
      logError(e, "startup");
      if (!cancelled) setState({ status: "error", message: String(e?.message ?? e) });
    });
    return () => { cancelled = true; };
  }, [attempt]);

  const ready = fontsLoaded && state.status === "ready";
  useEffect(() => {
    if (ready || state.status === "error" || state.status === "recovery") SplashScreen.hide();
  }, [ready, state.status]);
  useEffect(() => (ready ? markStableSoon() : undefined), [ready]);

  const retry = () => { setState({ status: "loading" }); setAttempt((a) => a + 1); };

  if (state.status === "recovery") {
    return (
      <RecoveryScreen
        title="KonaFit didn't start last time"
        message="Your workouts are safe. Open normally, or reset the saved screen state (a half-finished workout draft) first. Nothing else is deleted."
        retryLabel="Open KonaFit"
        onRetry={retry}
        onResetCache={async () => { await resetUiCache().catch(logError); retry(); }}
      />
    );
  }

  if (state.status === "error") {
    return (
      <RecoveryScreen
        title="Couldn't open your data"
        message="Nothing was changed. Try again; if it keeps failing, send the error so it can be fixed."
        detail={state.message}
        onRetry={retry}
        onResetCache={async () => { await resetUiCache().catch(logError); retry(); }}
      />
    );
  }

  if (!ready) return null; // the splash is still showing

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="tools" options={{ presentation: "modal" }} />
        <Stack.Screen name="workout/[id]" />
      </Stack>
    </SafeAreaProvider>
  );
}
