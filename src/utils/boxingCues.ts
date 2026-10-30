import { haptics } from "./haptics";
import { getBellEnabled, getWarningEnabled } from "./boxingSettings";

// In-memory copy of the cue settings so timer ticks stay synchronous. Call `loadCueSettings()` when a session starts
// (and after the settings screen changes them).
let bell = true;
let warning = true;

export async function loadCueSettings(): Promise<void> {
  [bell, warning] = await Promise.all([getBellEnabled(), getWarningEnabled()]);
}

/**
 * The one place a real bell/clapper sound plugs in. No audio dependency is installed (see docs/SPIKE_BOXING_SOUNDS.md,
 * decision D1 in docs/BOXING_BUILD_NOTES.md), so for now the haptic below is the only cue.
 */
// ponytail: no-op until an audio package is approved; then play one bundled tone per kind here.
function playSound(_kind: "bell" | "clapper"): void {}

export const cues = {
  roundStart: () => { if (!bell) return; playSound("bell"); haptics.heavy(); },
  roundEnd: () => { if (!bell) return; playSound("bell"); haptics.heavy(); },
  /** 10s left in a work round. */
  warning: () => { if (!warning) return; playSound("clapper"); haptics.warn(); },
};
