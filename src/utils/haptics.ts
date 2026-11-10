import * as Haptics from "expo-haptics";
import { kvStore } from "./kvStore";

export const HAPTICS_KEY = "@konafit_haptics_enabled";

export type HapticLevel = "off" | "normal" | "strong";

// In-memory copy of the setting so call sites stay synchronous. Loaded once at startup.
// Stored as "0" (off) / "1" (normal) / "2" (strong); the old on/off value "1" still reads as normal.
let level: HapticLevel = "normal";

export async function loadHapticsSetting(): Promise<HapticLevel> {
  const raw = await kvStore.getItem(HAPTICS_KEY);
  level = raw === "0" ? "off" : raw === "2" ? "strong" : "normal";
  return level;
}

export async function setHapticsLevel(value: HapticLevel): Promise<void> {
  level = value;
  await kvStore.setItem(HAPTICS_KEY, value === "off" ? "0" : value === "strong" ? "2" : "1");
}

const { ImpactFeedbackStyle: Impact, NotificationFeedbackType: Notify } = Haptics;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ponytail: iOS can't read the system "reduce haptics" switch from JS, so the in-app level is the only control.
const impact = (normal: Haptics.ImpactFeedbackStyle, strong: Haptics.ImpactFeedbackStyle) => {
  if (level !== "off") Haptics.impactAsync(level === "strong" ? strong : normal);
};
// Notification buzzes have one strength, so "strong" adds a heavy thump after them.
const notify = (type: Haptics.NotificationFeedbackType) => {
  if (level === "off") return;
  Haptics.notificationAsync(type);
  if (level === "strong") wait(120).then(() => Haptics.impactAsync(Impact.Heavy));
};

export const haptics = {
  tap: () => impact(Impact.Light, Impact.Medium),
  heavy: () => impact(Impact.Heavy, Impact.Heavy),
  warn: () => notify(Notify.Warning),
  success: () => notify(Notify.Success),
  /** Set ticked: one firm click. */
  setDone: () => impact(Impact.Medium, Impact.Heavy),
  /** New PR: success buzz, delayed a beat so it doesn't merge with the set-done click. */
  pr: () => { if (level !== "off") wait(150).then(() => notify(Notify.Success)); },
  /** Rest over: two heavy thumps. */
  restEnd: () => { if (level !== "off") { Haptics.impactAsync(Impact.Heavy); wait(140).then(() => Haptics.impactAsync(Impact.Heavy)); } },
  /** Countdown tick in the last seconds of rest. */
  tick: () => impact(Impact.Light, Impact.Medium),
};
