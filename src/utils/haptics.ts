import * as Haptics from "expo-haptics";
import { kvStore } from "./kvStore";

export const HAPTICS_KEY = "@konafit_haptics_enabled";

// In-memory copy of the setting so call sites stay synchronous. Loaded once at startup. Stored as "0" (off) / "1" (on).
let enabled = true;

export async function loadHapticsSetting(): Promise<boolean> {
  enabled = (await kvStore.getItem(HAPTICS_KEY)) !== "0";
  return enabled;
}

export async function setHapticsEnabled(value: boolean): Promise<void> {
  enabled = value;
  await kvStore.setItem(HAPTICS_KEY, value ? "1" : "0");
}

const { ImpactFeedbackStyle: Impact, NotificationFeedbackType: Notify } = Haptics;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ponytail: iOS can't read the system "reduce haptics" switch from JS, so the in-app switch is the only control.
const impact = (style: Haptics.ImpactFeedbackStyle) => { if (enabled) Haptics.impactAsync(style); };
const notify = (type: Haptics.NotificationFeedbackType) => { if (enabled) Haptics.notificationAsync(type); };

export const haptics = {
  tap: () => impact(Impact.Light),
  heavy: () => impact(Impact.Heavy),
  warn: () => notify(Notify.Warning),
  success: () => notify(Notify.Success),
  /** Set ticked: one firm click. */
  setDone: () => impact(Impact.Medium),
  /** New PR: success buzz, delayed a beat so it doesn't merge with the set-done click. */
  pr: () => { wait(150).then(() => notify(Notify.Success)); },
  /** Rest over: two heavy thumps. */
  restEnd: () => { impact(Impact.Heavy); wait(140).then(() => impact(Impact.Heavy)); },
};
