# KonaFit: Findings

Reviewed 2026-10-08. **Not repeated here:** everything already in `TODO_CODE_REVIEW.md` (38 items: discard bug, N+1 queries, missing indexes, debounce, a11y labels, onboarding, store readiness). Do those too; this list is what that audit missed. Tags: **[H]** high, **[M]** medium, **[L]** low. `[ ]` = open.

## Bugs: settings that do nothing (verified by grep)
- [ ] **[H]** Weight unit toggle is cosmetic. `getWeightUnit()` is defined in `app/settings.tsx:29` and used nowhere else. The DB column is `weight_lbs`, plates are lbs, exports say lbs, `formatVolume` says lbs. Either build kg support (store canonical kg or lbs, convert at the UI edge, kg plate set, 20 kg bar) or remove the toggle until it works.
- [ ] **[H]** "Default Rest Timer" setting is never read. `getDefaultRestSeconds()` is only called inside settings; `useRestTimer` hardcodes `DEFAULT_SECONDS = 90` (`src/hooks/useRestTimer.ts:4`). Load the setting into the hook on mount.
- [ ] **[H]** Rest timer never auto-starts. `handleSetComplete` only fires a haptic (`app/(tabs)/train.tsx:203-207`); `restTimer.start` is only called by the bar's manual button (`RestTimerBar.tsx:31`). The setting sublabel and README both promise auto-start. Call `restTimer.start()` when a non-warmup set is completed (optionally skip on the last set of the last exercise).
- [ ] **[M]** Rest timer end has no cue: no haptic, sound, or notification when it hits 0 (README promises vibration + crimson flash). Add `Haptics.notificationAsync(Success)` on completion; add `expo-notifications` local notification so it still fires with the screen locked.

## Bugs: data and logic
- [ ] **[H]** Streak is wrong east of UTC. `calculateStreak` builds keys with `toISOString()` (UTC) from local-midnight dates (`src/db/statsQueries.ts:105`) but compares against SQLite `DATE(..., 'localtime')` strings. In UTC+8 "today" becomes yesterday's date, so streak reads 0 or is off by one. Format with local `getFullYear/getMonth/getDate`. Also `- 86400_000` crosses DST wrongly; step with `setDate(d.getDate() - 1)`.
- [ ] **[H]** CSV export date has the same UTC bug: `d.toISOString().slice(0, 10)` (`src/db/historyQueries.ts:158`). An evening workout exports as the next/previous day.
- [ ] **[H]** Startup backfill silently undoes user edits. The `UPDATE logged_sets SET is_completed = 1 ...` migration (`src/db/database.ts:156`) runs on **every launch**, not once. If you un-check a set in a finished workout via the edit screen, it flips back to completed on next open. Gate with `PRAGMA user_version` / a kv flag, or delete it.
- [ ] **[M]** Migrations re-run all 13 `ALTER TABLE` statements every launch and swallow every error (`database.ts:165`). Replace with `PRAGMA user_version` + numbered migrations, run once, log real errors (also lets you ship future schema changes safely).
- [ ] **[M]** "Wipe All Data" is incomplete (`app/settings.tsx:156-165`): leaves `programs`, `program_days`, `program_exercises`, `locations`, custom exercises, and `use_count`s, while saying "all workouts, goals, and records". Also not in a transaction (partial wipe on failure), the Train/Stats screens are not refreshed afterwards, and the in-progress-workout kv entry is deleted but the in-memory session is not.
- [ ] **[M]** `exercises_fts` is dead weight: rows are inserted on create (`workoutQueries.ts:189`) but seeded exercises are never indexed and nothing runs `MATCH`. Search uses something else. Drop the virtual table and insert, or use it for search and rebuild it after seeding.
- [ ] **[M]** Strength score `categorizeExercise` mismatches (`src/utils/strengthScore.ts:82-86`): `row` matches "Upright Row" (delts); `fly` matches "Reverse Fly" (rear delts); `leg press` counts as squat (1RM is often 2-3x squat, inflating the score); `hip thrust`/`good morning` count as deadlift; `dip` also matches substrings. Use an explicit exercise-id/name map, or a `lift_category` column on `exercises`.
- [ ] **[M]** 1RM estimate uses Epley for any rep count (`statsQueries.ts:186,205`, `goalQueries.ts:86`). At 15+ reps it overstates badly. Cap input at 10 reps (ignore higher), or use Brzycki below 10.
- [ ] **[M]** Overall strength score averages only categories you have logged (`strengthScore.ts:141`), so one great lift = "Elite". Show overall as "N of 5 lifts tracked" or count missing lifts as 0.
- [ ] **[L]** Plate calculator: `BAR_OPTIONS` has `15 kg = 33` lb (`plateCalc.ts:275`) and no 20 kg bar; 45 lb bar != 20 kg. No 15 lb or 1.25 plate. Make plates and bar user-configurable per unit.
- [ ] **[L]** CSV formula injection: custom exercise/location names starting with `= + - @` run as formulas in Excel/Sheets (`exportUtils.ts:380`). Prefix with `'`.
- [ ] **[L]** Settings "Version 1.0.0" is hardcoded (`settings.tsx:288`). Read from `expo-constants` (already installed).

## Data safety (biggest product risk)
- [ ] **[H]** No backup or restore. The app is local-only, so a lost/broken phone loses all history. Export is CSV only and cannot be imported back. Add: "Back up database" (copy `konafit.db` via `expo-file-system` + `expo-sharing` to Drive/Files) and "Restore from backup". JSON export of all tables is the portable alternative.
- [ ] **[H]** Android CSV export shares the whole file as a text message (`exportUtils.ts:416`), which fails for big histories (Binder size limit ~1 MB). Write the file to cache and share it with `expo-sharing` on both platforms.
- [ ] **[M]** Auto-backup a snapshot before "Wipe All Data" and before each DB migration.
- [ ] **[M]** README says CSV/**Excel** export and Markdown + PNG share. Only CSV and Markdown text are in `exportUtils.ts`; verify the PNG path (`WorkoutShareCard`) works, and fix README wording.

## Performance / efficiency
- [ ] **[M]** Stats runs ~10 separate aggregate queries on mount (`getTotalHours`, `getTotalPRCount`, `getTotalLifted`, `getWorkoutCount`, `getWorkoutDatesForStreak`, ...), several scanning `logged_sets` fully. Cache totals in `kv_store`, invalidate on workout finish/edit/delete, or run in one `Promise.all` + one CTE.
- [ ] **[M]** `getWorkoutDatesForStreak` loads every workout date ever to compute a streak. Limit to last 400 days, or compute incrementally.
- [ ] **[L]** `useWorkoutTimer`, `useElapsedTimer`, and `formatDuration` (`exportUtils.ts:290`) duplicate `formatTime` (`utils/time.ts`). One timer hook, one formatter.
- [ ] **[L]** `kvStore` opens `getDatabase()` and runs a query per call. Add an in-memory read-through cache for hot settings (unit, rest, profile).
- [ ] **[L]** Rest timer uses `setInterval` decrement, so it drifts and freezes in background (TODO has the fix). While there, tick every 250 ms against `endTime` so the display never skips a second.
- [ ] **[L]** `PRBadgeChip` uses core `Animated` while `react-native-reanimated` 4 is a dependency. Pick one animation system.

## UI / UX
- [ ] **[H]** Keep screen awake during an active workout (`expo-keep-awake`, not installed). The phone locks mid-set at the gym and the timer view disappears.
- [ ] **[M]** RPE is stored, exported, and used in goals (`statsQueries.ts:360`), but `SetRow` has no RPE input. Add an optional RPE chip row or drop the column from export. README claims "sets, reps, weight, and RPE", and per-set notes (SetRow has none; only exercise-level notes exist).
- [ ] **[M]** Accent color drift: docs mandate Crimson `#FF0000` + Obsidian, code uses `dark:bg-blue-500` for the primary state and `#2563EB` for focus (`SetRow.tsx:45,109`). Decide on one palette (the dark/light classes suggest blue is current) and update `UI_UX_SPEC.md`, or fix the code.

## New features
- [ ] **[H]** Progressive overload hints: on each exercise show "last time 135 x 8: try 140 x 8 or 135 x 9" using existing ghost data.
- [ ] **[M]** Weekly goal (e.g. 4 workouts/week) with a weekly streak. Daily streaks punish rest days (spec itself says "week or day"). Reuses the existing `workouts` table.
- [ ] **[M]** Per-exercise PR history screen (best weight, best reps, best est. 1RM, best volume) with dates. `getHistPRs` already computes most of it.
- [ ] **[M]** Body measurements beyond weight (waist, arms, etc.) and photo comparison side-by-side in `ProgressPhotoGallery`.
- [ ] **[M]** Starter programs bundled (PPL, Upper/Lower, 5x5). Already in TODO as onboarding; add 3-4 with proper rep ranges and RPE targets.
- [ ] **[L]** Deload / plateau detection ("no PR in 4 weeks on bench").
- [ ] **[L]** Apple Health / Health Connect sync for bodyweight and workouts.
- [ ] **[L]** Interval/timer mode for cardio and core exercises (`target_type` column already exists on `exercises`).
- [ ] **[L]** Home-screen widget or notification action to start a workout.

## Remove / clean up
- [ ] **[M]** Delete leftover Expo template files `App.tsx` and `index.ts` in the repo root. `package.json` `main` is `expo-router/entry`, so they are never used and say "Open up App.tsx to start working on your app!".
- [ ] **[M]** Remove unused `paths` aliases (`@/*`, `@db/*`) from `tsconfig.json`; no file imports them. Or adopt them and delete the `../../src/...` chains.
- [ ] **[L]** Docs rename: README title and `UPDATE_LOG.md` say "KINETIC", app is "KonaFit". Pick one.
- [ ] **[L]** 11 root-level `.md` files. Move specs to `docs/`; keep README + CLAUDE/AGENTS at root.
- [ ] **[L]** `eas-cli` as a devDependency; run it with `npx eas-cli` instead to keep installs light.
- [ ] **[L]** No tests. Highest value: `calculateStreak` (timezone cases), `calculatePlates`, `computeStrengthScore`, `buildCsv`. Pure functions; Jest + `ts-jest` setup is small.
- [ ] **[L]** No lint/CI. Add `tsc --noEmit` as an npm script and a GitHub Action running it.

## Completed
- [x] **[H]** Set-complete button is 32 px and set-number button 40 px (`SetRow.tsx:57,108`). Gym use with chalky/sweaty hands needs 44-48 px targets. Done: both are now 48 px hit areas, inputs 44 px, column headers realigned.
- [x] **[M]** Add +/- stepper (±2.5 / ±5) next to weight, and "repeat previous set" / "copy last set to all" action. Done: focusing a set shows a chip toolbar (-5 / -2.5 / +2.5 / +5 on weight, "Same as prev"); "Copy last set to all" is in the exercise ⋯ menu (`copyLastSetToAll` in `useWorkoutSession`).
- [x] **[M]** Completed sets are locked (`editable={!completed}`). Done: inputs stay editable after completion; blur re-runs the PR check via `recheckSetPR` (no haptics).
- [x] **[M]** Quick-start for returning users. Done: "Repeat Last Workout" button on Train (shown once a workout exists); `getLastWorkoutExercises` + `repeatLastWorkout`, sharing a new `launchFromExercises` with program-day launch. Ghost sets prefill the numbers.
- [x] **[L]** PR badge text is 8 px. Done: 11 px, labels "PR WT / PR REP / PR VOL", shown on their own line under the set so they fit.
- [x] **[L]** Haptics: success pattern on PR and workout finish; "Haptics" On/Off toggle in Settings. Done: all calls go through `src/utils/haptics.ts` (setting cached in memory, loaded at startup); wipe-data keeps the setting.
- [x] **[L]** Settings theme override, haptics toggle, weekly goal. Done: new "Preferences" section under Units with Haptics On/Off, Theme System/Light/Dark (`src/utils/theme.ts`, applied at startup via `Appearance.setColorScheme`), and Weekly Goal 1-7 (`getWeeklyGoal()`; nothing reads it yet, see the weekly-goal feature below). All three survive Wipe All Data.
- [x] **[L]** Rest timer presets. Done: 1m / 1m 30s / 2m / 3m chips under the rest bar (idle and running); tapping one starts or restarts the timer at that length. The +/-15 s steps remain.
