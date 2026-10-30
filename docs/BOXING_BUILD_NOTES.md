# Boxing build: issues and decisions log

Written during the unattended run of `BUILD_PLAN_BOXING.md`. Newest at the bottom of each list.

## Decisions needed from you
- **D1 Sound (blocks audible bell):** approve `expo-audio` + one bundled tone? Interim: haptics-only behind a no-op `playSound()` seam. See `SPIKE_BOXING_SOUNDS.md`.

## Issues / follow-ups
- **I1 (info, Step 1.7):** In-progress lift detection is the kv snapshot (`@konafit_active_session_v1`) plus an unfinished `workouts` row. Boxing writes its row only at finish, so `deleteUnfinishedWorkouts` can never touch it. Confirmed by test.
- **I2 (handled in 7.1):** `train.tsx` "recent workouts" uses `getWorkoutHistory(3)` with no type filter, so boxing rows appear there as lift-shaped rows until Step 7.1 gives them a boxing row.
- **I3 (handled in 7.4):** `getWorkoutsThisWeek` and `getWorkoutDatesForStreak` still require a ticked lift set, so boxing is excluded from the weekly goal and streak until Step 7.4.
- **I4 (info):** CSV export is lift sets only by design; boxing goes out through the JSON export (Step 1.8).

## Judgment calls I made
- Step 0.2 asks to stop and ask the user. User is away, so I took the plan's own fallback (haptics-only) and continued.
