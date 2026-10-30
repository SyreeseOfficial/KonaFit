# Spike: boxing bell and warning sounds in SDK 56

**Decision: PENDING (user away). Interim: haptics-only, no new dependency. Needs your call, see `docs/BOXING_BUILD_NOTES.md` D1.**

## Findings (Expo SDK 56 docs)
- `expo-haptics`: single-shot impact/notification/selection only. No sound, no patterns.
- `expo-audio` (not installed): plays a bundled asset, a URI, or `{assetId}`. Docs expose **no OS system-sound IDs**. Needs a native rebuild of the dev client once added. `playsInSilentMode` defaults to true.
- Nothing else in the installed Expo packages plays a sound. A local notification sound would need `expo-notifications` plus permissions, which is heavy and works badly for a foreground timer.

## Options
| Option | Pros | Cons |
|---|---|---|
| A. Haptics-only | zero deps, ships now | no bell; PRD wants audible bell |
| B. `expo-audio` + 1 small bell tone file | real bell, works across the room, one dep | one new dep + dev-client rebuild; contradicts "no assets" preference (but 1 tiny file) |
| C. Local notification sound | system sound | permissions, delay, overkill |

## Recommendation
**B**, with one tiny generated bell/clapper tone (a few KB). Until you approve it, Step 2.3 builds the cue util behind a single `playSound()` seam that is a no-op, so adding B later is a one-file change.
