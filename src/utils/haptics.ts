import * as Haptics from "expo-haptics";
import { kvStore } from "./kvStore";

export const HAPTICS_KEY = "@konafit_haptics_enabled";

// In-memory copy of the setting so call sites stay synchronous. Loaded once at startup.
let enabled = true;

export async function loadHapticsSetting(): Promise<boolean> {
  enabled = (await kvStore.getItem(HAPTICS_KEY)) !== "0";
  return enabled;
}

export async function setHapticsEnabled(value: boolean): Promise<void> {
  enabled = value;
  await kvStore.setItem(HAPTICS_KEY, value ? "1" : "0");
}

export const haptics = {
  tap: () => { if (enabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); },
  warn: () => { if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); },
  heavy: () => { if (enabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy); },
  success: () => { if (enabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); },
};
