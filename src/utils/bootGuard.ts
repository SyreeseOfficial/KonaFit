import * as FileSystem from "expo-file-system/legacy";
import { saveToStorage } from "./sessionCache";
import { clearSnapshot } from "./boxingSnapshot";

// A plain file (not the database) counts launches that never got stable, so it still works when the database is what crashes.
const FILE = () => `${FileSystem.documentDirectory}konafit_boot_attempts`;
export const CRASH_LIMIT = 2;
const STABLE_AFTER_MS = 10_000;

/** Counts this launch and returns how many earlier launches never reached "stable" (crashed or hung). */
export async function registerLaunch(): Promise<number> {
  let before = 0;
  try {
    before = parseInt(await FileSystem.readAsStringAsync(FILE()), 10) || 0;
  } catch { /* first launch */ }
  await FileSystem.writeAsStringAsync(FILE(), String(before + 1)).catch(() => {});
  return before;
}

/** Call when the first screen is showing; after 10 quiet seconds the launch counts as healthy. Returns a cancel function. */
export function markStableSoon(): () => void {
  const t = setTimeout(() => FileSystem.writeAsStringAsync(FILE(), "0").catch(() => {}), STABLE_AFTER_MS);
  return () => clearTimeout(t);
}

/** Drops saved screen state (the resumable workout/boxing draft) that may be what crashes on load. Workouts, sets and settings are untouched. */
export async function resetUiCache(): Promise<void> {
  await saveToStorage(null);
  await clearSnapshot();
  await FileSystem.writeAsStringAsync(FILE(), "0");
}
