# KonaFit To-Do List

A plain-English list of things to fix and build. Checked against commit `76e3e5f`.

> **How to read this:** Pick a category. Each line is one job. Jobs marked ⭐ matter most.
> Same jobs that were listed twice are now merged into one.

---

## Cheat sheet

**How long a job takes**

| Tag | Time |
|-----|------|
| ⚡ | under 5 min |
| 🟡 | about 15 min |
| 🟠 | about 1 hour |
| 🔴 | about half a day |
| ❓ | nobody guessed yet |

**Jump to a category**

| | Category | What's in it |
|---|----------|--------------|
| 1 | [🐛 Bugs](#-bugs) | Things that are broken or give wrong answers |
| 2 | [🗄️ Data](#️-data) | How we save things in the database |
| 3 | [✨ Features](#-features) | New things to build |
| 4 | [🎨 Look & feel](#-look--feel) | Make the app nicer to use |
| 5 | [♿ Accessibility](#-accessibility) | Make it work for everyone |
| 6 | [⚡ Speed](#-speed) | Make it faster |
| 7 | [🎯 Code quality & tests](#-code-quality--tests) | Keep the code healthy |
| 8 | [🔒 Privacy & security](#-privacy--security) | Keep user data safe |
| 9 | [🚀 Release](#-release) | Get the app into the stores |
| 10 | [📖 Docs](#-docs) | Fix the writing |
| 11 | [🧹 Cleanup](#-cleanup) | Small tidy-up jobs |
| 12 | [⏸️ Skipped for now](#️-skipped-for-now) | Parked on purpose |
| 13 | [✅ Done](#-done) | Finished work |

---

## ⭐ Start here

If you only have a short time, do these first.

1. 🟡 **Bug: the 1RM math is copied in many places.** The formula can say a 30-rep set is a 2× max. Put it in one spot and cap reps at 10–12.
2. 🟡 **Data: add database indexes.** Right now every history search reads the whole table. Add 4 indexes in one new migration.
3. 🟡 **Data: photos are saved with full file paths.** These break after an update. Save only the file name.
4. 🟡 **Data: old session key name.** It still says `kinetic` (the old app name). Move it to a new key.
5. ❓ **Bug: app draws screens before the database is ready.** First launch can crash or show empty data.
6. ❓ **Bug: "Copy to all sets" + "Finish" counts sets you never did.** This ruins your volume and PRs.
7. 🟡 **Bug: rest timer is silent when the phone locks.** Send a notification when it ends.
8. 🟡 **Quality: no tests for the main flow.** Add Maestro tests (start → log → finish → history → undo).

---

## 🐛 Bugs

Things that are broken or give wrong answers.

### Can lose or ruin your data
- ⭐ ❓ **Database not ready at startup.** `app/_layout.tsx` shows screens before `initializeDatabase()` finishes. Wait for it. If it fails, show a "Try again / export / report" screen, not a white screen.
- ⭐ ❓ **"Copy last set to all" + Finish.** Finish marks every filled set as done, even ones you never ticked. Only count ticked sets, or ask at Finish.
- ❓ **"Save as program" can make an exercise with 0 sets.** Use at least 1 set.
- ❓ **Starting a workout isn't all-or-nothing.** If it fails halfway, you get a half-built workout. Wrap it in one transaction. Delete leftover unfinished workouts on startup.
- ❓ **Finishing a workout has no error handling.** If saving fails, the sheet closes and nothing tells you.
- ❓ **Swapping an exercise leaves old PR badges and counts behind.** Ask before swapping if sets exist. Reset the badges.
- ❓ **"Repeat last workout" is not a true repeat.** It counts unticked sets, and it drops warm-ups and supersets.
- 🟡 **Settings numbers can become `NaN`.** A bad saved value shows `NaN:NaN` on the timer. Fall back to the default.
- 🟡 **App-wide cache can go stale after "Wipe All Data".** Check every raw `DELETE FROM kv_store` clears the cache. Add a test.
- 🟡 **Typing in a set writes to the database on every key.** Save on blur and debounce.
- 🟡 **Local ids could clash after restart.** Use a real random id (`crypto.randomUUID()`).
- 🟡 **Check `PRAGMA foreign_keys` is on after startup.** Add a test.

### Wrong numbers
- ⭐ 🟡 **1RM formula copied in many places.** See "Start here." Put it in `sqlFragments.ts` and unit-test it.
- 🟡 **"Volume" means four different things.** Some totals count warm-ups and unfinished workouts. Make one shared rule (working sets, finished only). Test that every screen agrees.
- 🟡 **Workout time includes idle time.** Leave the app open over lunch and you "worked out" for hours. Save a `completed_at` for each set. Default the end time to "last set + 2 min" and let the user edit it.
- ⚡ **PR count gets inflated by typos.** A weight of 2250 instead of 225 counts forever. Ignore anything over 3× your last best.
- 🟡 **PR count and PR badges don't match.** They use different rules. Save PR events in a `pr_events` table and count from that.
- 🟡 **Bodyweight exercises never get a volume PR.** Weight is 0, so volume is 0. Use reps (plus added load).
- 🟡 **First-set PR badge may use an unfinished workout.** Make live badges and history PRs follow the same rules.
- 🟡 **Streak uses the start time.** A workout that crosses midnight counts for the wrong day. Use the finish time and write down the rule.
- 🟡 **Streak ignores planned rest days.** Add a "rest days" setting.
- 🟡 **Goals have gaps.** "Custom" goals show no progress. Bodyweight goals don't know if you're cutting or bulking. Save a start value and a direction.
- 🟡 **Achieved date uses "now."** Use the workout's finish time instead.
- 🟡 **`formatVolume` shows "1.00M" for 999,999.9.** Round first, then pick the unit.
- 🟡 **Weekly goal is saved but never shown.** Show "2 / 4 this week" on Train and Stats, or remove the setting. Check it stays between 1 and 7.
- 🟡 **Plate calculator hides when it can't hit the target.** Return the leftover and show "closest loadable: 135 lb."
- 🟡 **Plate calculator only knows one bar.** Add named bars (women's, trap, EZ, dumbbell handle). Remember the choice per exercise.
- 🟡 **Percent chart (100% = 1 rep) is a rough guess.** Label it as an estimate. Let users pick Epley, Brzycki or Lombardi.

### Timer
- 🟡 **Rest timer `+/-` works even when the timer isn't running.** Make the step a setting. Cap the total at 20 min.
- 🟡 **Rest timer ends with no buzz.** Add a haptic. Also recompute the time when the app comes back to the foreground.

### Duplicates
- ❓ **Fresh installs get duplicate exercises.** `Stiff-Leg Deadlift`, `Good Morning` and `Reverse Curl` each appear twice, so they get two separate histories. Near-duplicates exist too (`Band Pull-Apart` / `Banded Pull-Apart`, `Hyperextension` / `Back Extension`). Fix the list, merge old duplicates in a migration, add a unique index on `LOWER(name)`, and block duplicate custom exercises.
- 🟡 **Muscle groups are one comma string** (`"Chest, Triceps"`). A stray comma gives an empty group. Clean it on save, or make a proper many-to-many table.

### Look and theme
- 🟡 **Wrong theme flashes on launch.** The saved theme loads after the first paint. Load it before the first screen.

### Export and share
- 🟡 **Does the share-as-PNG card work on Android?** The needed library isn't in `package.json`. Add it, or remove the README claim.

### Setup and project
- ⚡ **Unused database table `lifestyle_logs`.** The screens are gone. Drop the table or document it. Remove `caffeine_mg` from the migration test.
- ⚡ **Unused font package `@expo-google-fonts/anton`.** Remove it. Run `knip` or `depcheck` in CI.

---

## 🗄️ Data

How the database and files are saved.

- ⭐ 🟡 **Add indexes** — `idx_le_exercise`, `idx_le_workout`, `idx_ls_exercise`, `idx_workouts_finished`. They make history, PR and ghost-set queries much faster.
- ⭐ 🟡 **Photos: save the file name only** (`photo_<ts>.jpg`) and build the full path when reading. Delete the file when its row is deleted. On launch and on wipe, remove orphan photo files. Also: don't ask for media-library permission just to use the camera.
- ⭐ 🟡 **Session key rename.** Move `@kinetic_active_session` to a versioned key. Store a `schemaVersion` inside, so old saves are rejected, not crashed on.
- 🟡 **Auto-backup before each migration.** Use `VACUUM INTO`, keep the last 3. Also add a `schema_version` row.
- 🟡 **Save `app_version` and `created_at` on workouts.** Helps bug reports.
- 🟡 **Purge old soft-deleted exercises** that have no history. Add a "Deleted exercises" list with Restore.
- 🟡 **Workout rating, energy and sleep fields.** Show them on the finish sheet and chart them.
- 🟡 **Save `completed_at` and `rest_seconds` for each set**, plus a `session_events` log (start, pause, resume). Gives true duration and rest times.
- 🟡 **Exercise notes timeline.** See your cues for one exercise over time.

---

## ✨ Features

New things to build. Grouped by area.

### Logging a workout
- 🟡 **Progressive overload hints.** "Last time 135 × 8. Try 140 × 8 or 135 × 9." Rule: if every set hit the top of the range at RPE ≤ 8, suggest +5 lb (+2.5 for isolation). One tap to apply. ⭐
- 🟡 **"Last time" row** at the top of each exercise (date, top set, total volume).
- 🟡 **Warm-up generator.** From the first working weight, add ramp sets (like 40/60/80% for 8/5/3). Round with the plate set.
- 🟡 **More set types:** drop, failure, AMRAP, backoff, myo-reps. Show a chip and count volume correctly.
- 🟡 **RPE half steps** (8.5, 9.5) and "apply RPE to all sets." Optional RIR display.
- 🟡 **Per-hand weight flag** for dumbbells and kettlebells (doubles the volume).
- 🟡 **Assisted exercises flag** (assisted pull-up). Subtract the help from bodyweight.
- 🟡 **Cardio and timed exercises.** Duration, distance, pace. Add a countdown / interval timer for HIIT, Tabata and EMOM.
- 🟡 **Quick-add a custom exercise** when search finds nothing ("Create 'cable pullover'").
- 🟡 **Better exercise search:** typo-friendly, recent and most-used first, chips for muscle and equipment.
- 🟡 **Merge / rename tool** for duplicate exercises. Keep the history.
- 🟡 **Daily readiness check-in** (sleep, soreness, mood 1–5). Chart it against performance.
- 🟡 **"How did it feel" 1–5 rating** shown in History. Notes templates.

### Plates and calculators
- 🟡 **Remember bar and plates per exercise.** Show "per side" as plain text, not just a graphic.
- 🟡 **Dumbbell / kettlebell steps** (5 lb steps, 2.5 lb jumps) from the user's real rack.
- 🟡 **Plates and bar per gym** (a `locations` table already exists).
- 🟡 **Percentage calculator → active workout.** Apply to an exercise's e1RM or training max. One tap to send sets.
- 🟡 **Manual training max / 1RM** per exercise (an `exercise_maxes` table).
- 🟡 **Plate-loaded vs selectorized machine toggle.** Different step sizes.
- 🟡 **More Tools tab items:** 1RM calculator (many formulas), RPE chart, warm-up calculator, dumbbell-pair helper.

### Programs
- 🟡 **RPE-based loads.** `program_exercises.target_rpe` exists but nothing uses it.
- 🟡 **Progression engines:** linear, double progression, 5/3/1, GZCL. Ship templates.
- 🟡 **Templates from any past workout**, and "save as template" on the finish sheet.

### Stats and progress
- ⭐ ❓ **Stats has no trends.** Add 3 small cards with the existing `LineChart`: best 1RM per exercise, weekly volume, bodyweight trend. Include a goal line.
- 🟡 **Weekly volume per muscle** with ideal ranges (MEV / MAV / MRV).
- 🟡 **Muscle balance:** push vs pull sets per week, quads vs hamstrings, in plain words.
- 🟡 **Training density:** hard sets per muscle per week.
- 🟡 **Deload alert** when volume or RPE climbs for 4+ weeks.
- 🟡 **Strength standards:** compare your e1RM to bodyweight levels (beginner → elite). Match lifts by exercise id.
- 🟡 **Recovery heat list:** hours since each muscle was trained.
- 🟡 **Workout-complete insights:** compare to your last 4 sessions of the same day. Best set. Fatigue flags.
- 🟡 **Bodyweight trend:** 7-day average, goal weight, projected date.

### Units
- 🟡 **Different units per field:** weight, distance, measurements.

### Save, share, import
- 🟡 **Full-detail JSON export** with a written schema.
- 🟡 **Share a workout as an image** with PR highlights.
- 🟡 **Social-lite profile card** (PRs, streak) as an image.

### Phone and device
- 🟡 **"Resume" card** for an in-progress workout on launch.

---

## 🎨 Look & feel

- 🟡 **Haptics:** different buzz for set done, PR and rest end. Make strength a setting. Respect the phone's "reduce haptics." Add a tick every 5 s in the last 10 s of rest.
- 🟡 **Keyboard:** number pad with decimal. "Next" button that moves across rows (`returnKeyType="next"`).
- 🟡 **Bigger text test.** Try 200% font size on both phones. Fixed row heights probably clip.
- 🟡 **Check light mode contrast** for ghost text and PR badges (needs 4.5:1).
- 🟡 **Onboarding:** 3 screens to pick units, weekly goal, starter program and plate set.
- 🟡 **Empty states with an action** for history, programs, goals and photos.
- 🟡 **Undo for goals and photos** too, like sets already have.
- 🟡 **"Workout in progress" banner** on every tab, with elapsed time and a way back.
- 🟡 **History filters:** by exercise, muscle, date range. Sort by volume. Answer "show every squat session."
- 🟡 **History swipe to repeat, long-press to delete.** Monthly headers with totals. Undo for deletions.
- 🟡 **One Exercise page.** Tap any exercise to see history, PRs, 1RM chart and notes together.
- 🟡 **Swipe a set:** left to delete, right to duplicate. Haptic + undo.
- 🟡 **Tab badges:** a dot for an unfinished workout on Train, a dot for a new PR on Stats.
- 🟡 **"Previous" in SetRow:** show date and RPE. Tap to copy it into the row. Long-press to see the last 3 sessions.
- 🟡 **Faster weight steps:** ±2.5, ±5, ±10, ±25 with press-and-hold. Good for 315 → 405 jumps.
- 🟡 **Show e1RM and a delta** ("+5 lb / +1 rep") after you finish a set.
- 🟡 **Undo a mistaken tick** with a 5-second snackbar.
- 🟡 **Workout-complete screen:** share image, notes prompt, and a peek at the next planned session.
- 🟡 **Tap on Weekly Goal** should show progress (see Bugs).

---

## ♿ Accessibility

- 🟡 **Labels everywhere.** The app has exactly **one** `accessibilityLabel`. Icon-only buttons (set done, add set, rest timer ±15 s, menus) are silent for TalkBack / VoiceOver. Add `accessibilityRole`, `accessibilityLabel` and `accessibilityState` to every Touchable in `SetRow`, `ExerciseBlock`, `RestTimerBar`, `WorkspaceHeader` and the tab bar. *(Parked in Skipped for now.)*
- 🟡 **Roles and hints.** Add roles for buttons, tabs, switches. Add hints for hidden gestures (long-press to remove a set).
- 🟡 **Dynamic Type.** Add `maxFontSizeMultiplier` so 200% text doesn't break `SetRow`'s fixed `h-11` inputs.

---

## ⚡ Speed

- 🟡 **Gate the three always-on modals per `ExerciseBlock`.** Wrap `SetRow` in `React.memo` with stable callbacks. Profile a 10-exercise workout.
- 🟡 **Split big files.** `train.tsx` is 27 KB. `useWorkoutSession.ts` is 22 KB. Smaller pieces mean fewer re-renders.
- 🟡 **Use `FlatList` / `FlashList`** on the workout detail screen (`app/workout/[id].tsx`, 27 KB) and custom exercises.
- 🟡 **Combine Train's startup reads** (`getLastUsedDatesByDay`, goals, streak) into one query.
- 🟡 **Hold the splash until fonts and DB are ready** (`expo-splash-screen`).
- 🟡 **Check the bundle:** turn on Hermes bytecode, use `source-map-explorer`, import each `lucide-react-native` icon on its own.
- 🟡 **Memoize `LineChart` math.** Don't rebuild SVG paths every render. Downsample above 200 points.
- 🟡 **Hoist the 90 inline `style={{…}}` objects** (or use NativeWind) so list rows stop re-rendering.
- 🟡 **Try `reactCompiler`** in `app.json`. Measure re-renders.

---

## 🎯 Code quality & tests

### Tests
- ⭐ 🟡 **End-to-end tests with Maestro** (YAML, no code) for the core loop. Run them in CI with EAS or an Android emulator.
- 🟡 **Strict TypeScript.** Set `"strict": true`. Remove `diagnostics: false` in Jest so tests type-check.
- 🟡 **Coverage:** run `jest --coverage` in CI. Require 70% on `src/db` and `src/utils`.
- 🟡 **Migration tests** from real `.db` fixtures for each released version. Check row counts and sample data survive.
- 🟡 **Property tests** for `calculatePlates`, `roundWeight` and `computePRBadges`.
- 🟡 **Snapshot tests** for `autoWorkoutName`, Markdown export and the share card.
- 🟡 **Fake clocks** (`jest.useFakeTimers`) for streak, rest timer and `autoWorkoutName`. Set `TZ` in the Jest script.
- 🟡 **Run tests in two time zones** (UTC and America/Los_Angeles).
- 🟡 **Component screenshot harness** (Storybook or similar) in light and dark.
- 🟡 **Smoke flows + nightly build.** Run Maestro / Detox and `eas build --profile preview` to catch native breaks.

### CI and tools
- 🟡 **Add `expo-doctor` and `npx expo install --check`** to CI.
- 🟡 **Add Renovate / Dependabot** with Expo SDK updates grouped.
- 🟡 **Stricter lint:** `eslint-plugin-react-hooks`, React Compiler lint, and `eslint-plugin-react-native` (`no-inline-styles`, `no-unused-styles`, `no-color-literals`).

### Cleaner code
- 🟡 **Crash reporting** with Sentry (opt-in, no personal data). A migration crash is invisible now.
- 🟡 **One `reportError` / `logError` helper** instead of 19 loose `console.error` calls. Keep the last 50 errors in `kv_store`. Show them in Settings → Diagnostics with a copy button. Show a toast for errors users can see.
- 🟡 **Typed queries.** About 150 untyped `getAllAsync<...>` casts. Try `kysely` or typed helpers.
- 🟡 **Keep SQL out of components.** All DB access in `src/db`, tested with the `better-sqlite3` shim.
- 🟡 **Runtime check for saved JSON** (zod style). `JSON.parse(raw) as ActiveSession` trusts old shapes.
- 🟡 **`TouchableOpacity` → `Pressable`.** 375 vs 77 uses. Make a shared `<Button>` with 44 px hit area, accessibility props, haptics.
- 🟡 **One `confirm({title, message, destructive})`** instead of 28 separate `Alert.alert` calls.
- 🟡 **Equipment-aware steps.** `RPE_VALUES` and `WEIGHT_STEPS` are hard-coded. Barbell 5 lb, dumbbell 2.5–5, machine 10. Allow custom steps.
- 🟡 **Document `sqlFragments.ts`** (`isBodyweightSql`, `setLoadSql`) and where each is needed.
- 🟡 **"DB doctor" in Settings.** Counts rows, finds orphans, unfinished workouts, missing photos. One-tap repair.
- 🟡 **Startup crash recovery.** After repeated crashes, offer "Reset UI cache" without touching the database (`expo-updates`).

---

## 🔒 Privacy & security


---

## 🚀 Release


---

## 📖 Docs

- 🟡 **Make README match reality.** It claims "Excel export," "PNG share," "Volume Heatmap," "Habit Tracker," "1RM charts" (several were deleted) and a "Crimson Red" theme.
- 🟡 **Real quick start** (install, run on device, build with EAS, run tests). Move the vision text to `docs/VISION.md`.
- 🟡 **Rename `DEVELOPER_DIRECTIONS.md`.** It holds an AI prompt. Move it to `AGENTS.md`. Keep human docs separate.
- 🟡 **Document the data model** (tables, links, rules like "warm-ups don't count as volume") in `docs/SYSTEM_ARCHITECTURE.md`. Keep it in sync with a test.
- 🟡 **User guide with screenshots** in `docs/`. Compress to WebP.

---

## 🧹 Cleanup

- ⚡ **Compress images.** `pics/1.jpg` is 333 KB, `assets/icon.png` is 393 KB. Use `oxipng` / WebP.
- ⚡ **Move `pics/1.jpg` and `pics/2.jpg`** to `docs/images/`. The app doesn't use them.
- ⚡ **Stop tracking `.claude/settings.local.json`.** Add it to `.gitignore`.
- ⚡ **Merge `TODO_CODE_REVIEW.md` into this file.** Tick finished items, delete the rest. One list only.
- ⚡ **Check tiny route files:** `app/programs/_layout.tsx`, `app/index.tsx`. Keep what's needed. Make `index.tsx` a plain `Redirect`.
- ⚡ **Delete unused Tailwind tokens** after the redesign audit.
- ⚡ **Add JSDoc and tests for `haptics.ts`, `time.ts`, `theme.ts`.** Test `time.ts` with negatives and over 24 h.

---

## ⏸️ Skipped for now

You marked these as "skip for now." They stay on the list so they aren't lost.

- ♿ **Accessibility labels** (see Accessibility above).
- 📊 **Backup is incomplete.** Make one zip: `konafit.db` + `photos/` + `manifest.json` (app version, schema version, date). Restore refuses a newer schema. Run `PRAGMA wal_checkpoint(TRUNCATE)` (or `VACUUM INTO`) first, because WAL is on.
- ✨ **Rest timer auto-start.** When a non-warm-up set is ticked, start the timer. Heavy lifts 3 min, isolation 60 s. RPE 9+ adds 30 s.
- ✨ **Rest timer end cue.** Haptic, sound, and a local notification so it fires with the screen locked.
- ✨ **Rest timer notification when backgrounded.** Schedule at the end time with `expo-notifications`. Cancel on stop. Use `expo-keep-awake` only in the foreground.
- ✨ **Cloud backup & restore.** Copy `konafit.db` out with `expo-file-system` + `expo-sharing`. Add "Restore from backup."
- ✨ **Android CSV shares to cache.** Write the file and share it (the text-message way breaks past about 1 MB).
- ✨ **Multi-language.** Move strings to `i18n` (`expo-localization`). Format dates and numbers with `Intl`. Start with Spanish.
- ✨ **Weekly goal with weekly streak.**
- ✨ **Body measurements and side-by-side photos.**
- ✨ **Starter programs** (PPL, Upper/Lower, 5×5) with rep ranges and RPE targets.
- ✨ **Auto-backup before "Wipe All Data"** and before each migration.
- ✨ **README fix:** it says Excel export and PNG share. Only CSV and Markdown text exist.
- ✨ **Apple Health / Health Connect sync.**
- ✨ **Interval / timer mode** for cardio and core (`target_type` already exists).
- ✨ **Home-screen widget** or notification action to start a workout.

### Moved from 🐛 Bugs
- 🟡 **`formatDate` is stuck on US format.** Use the phone's language. Use `Intl.NumberFormat` for numbers.
- 🟡 **Check CSV escapes quotes, commas and new lines.** Test with a note like `felt "tight", left knee`.
- 🟡 **CSV is always in lbs.** When kg arrives, add a `unit` column.
- 🟡 **Markdown share:** warm-ups say "W1," and set numbers skip after deletions. Renumber on export. Very long text can break Android's share limit, so share a file instead.
- 🟡 **`expo-file-system/legacy` is going away.** Move to the new `File` / `Directory` API.
- 🟡 **`app.json` has no version handling.** Use `"appVersionSource": "remote"` with `autoIncrement` so store uploads don't get rejected. *Reason: Im never uploading this to app store. Its for personal use.*

### Moved from ✨ Features
- 🟡 **Tempo and rest fields per set.** Track the real rest between sets.
- 🟡 **Supersets and circuits.** Start the rest timer after the last exercise in the group. Add a circuit mode with rounds.
- 🟡 **Voice logging:** say "225 for 5." Optional.
- 🟡 **Rest defaults per exercise.** Used by the auto-start rest timer.
- 🟡 **Swap suggestions** (same muscle and equipment), plus "last time you used X when Y was taken."
- 🟡 **Equipment profiles** ("home," "gym," "travel") that hide exercises you can't do.
- 🟡 **Injury / pain flags** on exercises or body parts. Warn when you add one.
- 🟡 **Weekly report card** each Sunday: sessions vs goal, volume vs last week, PRs, average RPE.
- 🟡 **Calories and session intensity,** clearly labeled as estimates.
- 🟡 **Body measurements** (waist, chest, arms, thighs) in a `measurements` table with a chart.
- 🟡 **Before / after photo slider** with dates and a framing overlay.
- 🟡 **Achievements:** first 100 lb bench, 1,000,000 lb lifted, 100 workouts.
- 🟡 **Better streaks:** weekly streak with rest-day allowance, freeze tokens, longest-streak record.
- 🟡 **Weekly goal ring** on Train, plus "weeks hit" in Stats.
- 🟡 **Import from Strong / Hevy / FitNotes / JEFIT CSV.** Map columns, show a dry-run ("412 workouts, 61 new exercises"). A free, local lifting app gains the most from this.
- 🟡 **Share a program** as a file or QR code. Another KonaFit install can import it.
- 🟡 **Encrypted cloud backup** to a file the user keeps in Drive / iCloud.
- 🟡 **Monthly backup reminder.**
- 🟠 **Sync two devices** over local network or a user-chosen file. Last write wins.
- 🟠 **Web viewer** (`expo start --web`) for exported data.
- 🟡 **Reminders** per weekday with `expo-notifications`. Skip days you already trained.
- 🟡 **App shortcuts / Quick Actions** (long-press icon): "Start empty workout," "Next program day." Use `expo-quick-actions`.
- 🟡 **Home-screen widget** with streak and next workout. Needs native code; optional.
- 🟡 **Apple Health / Health Connect.** Write workouts, read and write bodyweight. Opt-in.
- 🟡 **Dark mode on a schedule** and an AMOLED black option.
- 🟡 **Quick-log text entry:** type `225x5 @8` and it fills the row.
- 🟡 **Show target reps from the program** next to each set. Color sets that hit the top of the range.
- 🟡 **Import / export custom exercises** as JSON.
- 🟡 **Notes search** across set notes and workout notes.
- 🟡 **Powerlifting points** (Wilks / DOTS / IPF) from stored bodyweight.
- 🟡 **"Next up" card on Train.** Show the next program day with a one-tap Start. `getLastUsedDatesByDay` and `workouts.program_day_id` already give the order. ⭐
- 🟡 **"Week 3 of 8"** using `duration_weeks`, with automatic weight steps. Show progress on the program card.
- 🟡 **Wave loading and tempo templates.** Turn text like `5/3/1` into per-set targets.
- 🟡 **Folders / tags / pinned** for programs.
- 🟡 **Auto-detect goals.** After a workout, check progress and mark goals done. Show it on the workout-complete screen.
- 🟡 **Gym schedule.** Plan sessions from a program (planned vs done) in a calendar view.
- ⭐ ❓ **Real kg support.** Keep storing pounds. Add a `unit` setting plus one `formatWeight()` / `parseWeight()` pair used everywhere. Add kg steppers (±1, ±2.5) and kg plates. `lbs` is hard-coded in the set placeholder, `formatVolume`, the Stats grid, CSV, Markdown, bodyweight logger and goals.

### Moved from 🎨 Look & feel
- 🟡 **One-handed layout.** Put Finish / Add Exercise where your thumb is.
- 🟡 **Tablet / landscape.** iOS has `supportsTablet: false`, but Android tablets still run it. Lock orientation and test at 600 dp. Optional two-pane Train layout.
- 🟡 **Long-press a weight** to open the plate calculator for that weight.
- 🟡 **Plate-entry mode.** Tap plates to build the load.
- 🟡 **Lock-screen state.** While backgrounded, show elapsed time and the rest timer (Android service / iOS Live Activity).
- 🟡 **Floating mini plate calculator** on the weight field.
- 🟡 **Silent mode** setting turns off all sounds and haptics.

### Moved from ♿ Accessibility
- 🟡 **Reduce motion.** `PRBadgeChip` springs and `LayoutAnimation` ignores the phone setting. Check `AccessibilityInfo.isReduceMotionEnabled()`.
- 🟡 **Screen reader actions** on `SetRow` (complete, warm-up, remove). Long-press can't be triggered by a screen reader.

### Moved from 🔒 Privacy & security
- 🟡 **Optional app lock** (fingerprint / face with `expo-local-authentication`) for photos and app open.
- 🟡 **Encrypt backups** with a user passphrase (AES-GCM) before sharing.
- 🟡 **Decide on `android.allowBackup`.** Expo defaults to true, so Google may upload `konafit.db`. That's a free backup, but pick on purpose and write it down.
- 🟡 **Privacy policy page** (stores require it): local-only data, camera and photo use, no analytics. Link it from Settings.
- 🟡 **Explain photo storage in Settings** and add "Delete all photos."

### Moved from 🚀 Release
- 🟡 **Store readiness:** screenshots, adaptive icon, content rating, data-safety form, `eas submit` profile, a release checklist doc.
- 🟡 **OTA updates (EAS Update)** for JS-only fixes. Channels `preview` and `production`, runtime policy `appVersion`.
- 🟡 **Versioned changelog.** Add `CHANGELOG.md` and tag releases (`v1.0.0`). `docs/UPDATE_LOG.md` is 13 KB of prose.
- 🟡 **Remote versioning** for `android.versionCode` and `ios.buildNumber`.
- 🟡 **Test-data button (debug).** Make 6 months of fake workouts to test history and stats on big data.
- 🟡 **Watch Play Console vitals** (crash-free sessions, ANRs). Note how to read them.
- 🟡 **Schema docs + ER diagram** generated from the migrations.
- 🟡 **Dev-client build docs** (Node version, `npx expo start`, `npm test`).

---

## ✅ Done

Finished in earlier rounds. For reference only.

**Fixes**
- [x] Removing an exercise now deletes it from the database (with confirm and undo).
- [x] Streak is correct in time zones east of UTC.
- [x] CSV dates use the local day.
- [x] Startup backfill no longer re-ticks sets on every launch (runs once, in migration 1).
- [x] Finish with zero ticked sets offers "Discard" instead of counting.
- [x] Number inputs are cleaned (`,` becomes `.`, limits on weight, reps and bodyweight).
- [x] PR badges: no PR on first time (grey "FIRST TIME"), rep PRs only compare at the same or heavier weight.
- [x] Exercise order in the database now matches what you saw.
- [x] Notes typed in a workout no longer overwrite the library note.
- [x] CSV formula injection blocked (`=`, `+`, `-`, `@` prefixed with `'`).
- [x] Stats "Hours" shows minutes at first (`29 min`).
- [x] Bodyweight exercises count bodyweight + added load. Assisted sets can be negative.
- [x] Rest timer uses a wall-clock end time (no drift, catches up after background).
- [x] Default rest timer setting is now read. Weekly goal, theme and haptics settings added.

**Features**
- [x] Keep screen awake during a workout.
- [x] RPE chips and per-set notes (migration 3).
- [x] Weight stepper and "Copy last set to all."
- [x] Completed sets stay editable.
- [x] "Repeat Last Workout" button.
- [x] Rest timer presets (1m / 1m 30s / 2m / 3m).
- [x] Personal Records screen with plateau banner.
- [x] Bodyweight list on Stats (edit and delete).
- [x] Undo snackbar for removed sets and exercises.
- [x] Auto workout names (e.g. "Chest + Triceps · Thu").
- [x] "Wipe All Data" asks for `DELETE` and offers "Export first."
- [x] Search matches any word order and shortcuts like `db`, `bb`, `rdl`.
- [x] History pages 50 at a time with filter and month headers.
- [x] Plate calculator: honest bar options and 15 lb / 1.25 lb plates.
- [x] Version in Settings reads from `expo-constants`.

**Speed & data**
- [x] Numbered migrations with `PRAGMA user_version`.
- [x] Dropped the dead `exercises_fts` table.
- [x] Stats uses fewer queries (`getStatsTotals`, one `Promise.all`).
- [x] Streak query limited to 400 days.
- [x] `kvStore` has an in-memory cache.
- [x] Session snapshot is debounced and flushed when the app leaves the foreground.

**Cleanup & tools**
- [x] Deleted 11 unused Stats components and `strengthScore.ts`.
- [x] Removed unused queries, `App.tsx`, `index.ts`, `tsconfig` aliases and `eas-cli` devDependency.
- [x] Moved specs to `docs/`. KonaFit name used everywhere.
- [x] Blue is the official palette. Spec updated.
- [x] Jest, typecheck, ESLint and a GitHub Actions CI. In-memory SQLite test harness. Reducer tests.
- [x] Settings getters moved to `src/utils/settings.ts`.
- [x] Reanimated used everywhere (no core `Animated`).
- [x] PR badge text bigger (11 px). Touch targets 48 px.

**Still open from these:** per-set `upsertLoggedSet` on every keystroke, and long-press discoverability for removing a set.
