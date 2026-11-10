import { haptics } from "./haptics";
import { getBellEnabled, getWarningEnabled } from "./boxingSettings";

// In-memory copy of the cue settings so timer ticks stay synchronous. Call `loadCueSettings()` when a session starts
// (and after the settings screen changes them).
let bell = true;
let warning = true;

export async function loadCueSettings(): Promise<void> {
  [bell, warning] = await Promise.all([getBellEnabled(), getWarningEnabled()]);
}

// ponytail: haptics-only until an audio package is approved; play a bundled tone in these.
export const cues = {
  roundStart: () => { if (bell) haptics.heavy(); },
  roundEnd: () => { if (bell) haptics.heavy(); },
  /** 10s left in a work round. */
  warning: () => { if (warning) haptics.warn(); },
};
