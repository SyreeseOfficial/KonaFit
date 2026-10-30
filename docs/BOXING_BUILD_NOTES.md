# Boxing build: issues and decisions log

Written during the unattended run of `BUILD_PLAN_BOXING.md`. Newest at the bottom of each list.

## Decisions needed from you
- **D1 Sound (blocks audible bell):** approve `expo-audio` + one bundled tone? Interim: haptics-only behind a no-op `playSound()` seam. See `SPIKE_BOXING_SOUNDS.md`.

## Issues / follow-ups
(none yet)

## Judgment calls I made
- Step 0.2 asks to stop and ask the user. User is away, so I took the plan's own fallback (haptics-only) and continued.
