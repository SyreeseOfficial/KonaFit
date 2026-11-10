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
| 12 | [🙋 Needs my decision](#-needs-my-decision) | Claude got stuck or needs a choice from me |
| 13 | [⏸️ Skipped for now](#️-skipped-for-now) | Parked on purpose |
| 14 | [✅ Done](#-done) | Finished work |

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

*Empty: every bug was worked through. Finished ones are in ✅ Done, the ones that need a choice from you are in 🙋 Needs my decision.*

---

## 🗄️ Data

How the database and files are saved.

- 🟡 **Auto-backup before each migration.** Use `VACUUM INTO`, keep the last 3. Also add a `schema_version` row. *Left alone this round: it is the same job as "Auto-backup before Wipe All Data and before each migration" in ⏸️ Skipped for now.*

---

## ✨ Features

New things to build. Grouped by area.

Everything here was worked through in the Features round: finished jobs are under ✅ Done, the rest are under 🙋 Needs my decision.

---

## 🎨 Look & feel

- 🟡 **Bigger text test.** Try 200% font size on both phones. Fixed row heights probably clip.
- 🟡 **Onboarding:** 3 screens to pick units, weekly goal, starter program and plate set.
- 🟡 **Undo for goals and photos** too, like sets already have.
- 🟡 **"Workout in progress" banner** on every tab, with elapsed time and a way back.
- 🟡 **History swipe to repeat, long-press to delete.** Monthly headers with totals. Undo for deletions.
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

## 🙋 Needs my decision

Claude parks jobs here when it needs a choice or help from me. Each entry: original job, which category it came from, the question, and Claude's recommended answer. Empty = nothing waiting.

- **Category: 🐛 Bugs.** 🟡 **PR count and PR badges don't match.** They use different rules. Save PR events in a `pr_events` table and count from that.
  - *Done already:* the PR count and the live badges now share the same "working set" rule, and a typo'd weight no longer inflates the count (see Done).
  - *Question:* the badges can be Weight, Reps or Volume, but the Stats "PRs" number only counts weight records. Should one PR in `pr_events` be one badge (so a set that earns W+R+V counts as 3), or one per set? And should old history be replayed once to fill `pr_events`, or should the table start empty and count only from now?
  - *Recommended:* one row per (set, kind). Replay history once in a migration (additive, easy to rebuild). The Stats number shows distinct sets with at least one real PR.

- **Category: 🐛 Bugs.** ❓ **Fresh installs get duplicate exercises.** `Stiff-Leg Deadlift`, `Good Morning` and `Reverse Curl` each appear twice, so they get two separate histories. Near-duplicates exist too (`Band Pull-Apart` / `Banded Pull-Apart`, `Hyperextension` / `Back Extension`). Fix the list, merge old duplicates in a migration, add a unique index on `LOWER(name)`, and block duplicate custom exercises.
  - *Done already:* the seed list is fixed (one row each; two-muscle moves list both groups, e.g. `Hamstrings, Lower Back`), the test for it passes, and creating or renaming a custom exercise to an existing name is blocked with a message.
  - *Not done:* the migration that merges duplicates already on your phone, and the unique index. The merge repoints workout history, programs and goals to one exercise and deletes the other. If it fails halfway, the app can't start.
  - *Question:* OK to add a migration that merges the existing duplicates (keeping the oldest id and repointing `logged_exercises`, `program_exercises`, `goals`), then adds `CREATE UNIQUE INDEX ... ON exercises(LOWER(name)) WHERE is_deleted = 0`?
  - *Recommended:* yes, inside one transaction, after a one-time CSV export from Settings as a safety net. Do it as its own commit so it's easy to undo.

- **Category: 🐛 Bugs.** 🟡 **Goals have gaps.** "Custom" goals show no progress. Bodyweight goals don't know if you're cutting or bulking. Save a start value and a direction.
  - *Done already:* bodyweight goals now save a start value and a direction (cut or bulk), the progress bar goes from start to target, and old goals were backfilled from your bodyweight log.
  - *Question:* a custom goal like "Run a 5K" has no number to measure. What should "progress" mean?
  - *Recommended:* leave custom goals as a tick box (no bar). If you want a bar, add an optional "target number + unit" and a small "update progress" button on the card.

- **Category: ✨ Features.** 🟡 **Progressive overload hints: what is "the top of the range"?**
  - *Done already:* the hint shows under "Last time" and applies with one tap (see Done).
  - *Question:* the exercise has no rep range of its own, so I used 8 reps for compound lifts and 10 for isolation lifts, and "RPE not logged" counts as easy. OK, or do you want a range per exercise?
  - *Recommended:* keep these defaults. Programs with a target rep/RPE already use their own target.

- **Category: ✨ Features.** 🟡 **Cardio and timed exercises.** Duration, distance, pace. Add a countdown / interval timer for HIIT, Tabata and EMOM.
  - *Question:* this needs new set columns (seconds, distance), a different set row, and a timer that works with the screen locked (needs `expo-notifications`, which is in Skipped).
  - *Recommended:* ship duration + distance fields and pace first (no timer). Do the interval timer together with the rest-timer notification work.

- **Category: ✨ Features.** 🟡 **Remember bar and plates per exercise.** Show "per side" as plain text.
  - *Question:* earlier you chose one remembered bar for everything. Switch to per exercise?
  - *Recommended:* yes: store `{bar, disabled plates}` per exercise id in the key-value store and add a "per side: 2 × 45, 1 × 25" text line. Needs the plate calculator opened from an exercise.

- **Category: ✨ Features.** 🟡 **Dumbbell / kettlebell steps** from the user's real rack. **Plates and bar per gym.** **Plate-loaded vs selectorized machine toggle.**
  - *Question:* these three all change what "next weight up" means. Do you want one "equipment" model (per gym: bar, plates, dumbbell list, machine step) used by hints and the plate calculator?
  - *Recommended:* yes. Add `bar_lbs`, `plates_json`, `dumbbells_json` to `locations` and `exercises.load_type`. Round overload hints to the gym's real steps. Done together it is about half a day.

- **Category: ✨ Features.** 🟡 **Manual training max / 1RM per exercise** (`exercise_maxes` table). **Percentage calculator → active workout** (one tap to send sets).
  - *Question:* which number should the % calculator start from: the manual max if set, else the best estimated 1RM of the last 90 days?
  - *Recommended:* yes, that order. Build the table first, then a "Send to workout" button that fills unticked sets.

- **Category: ✨ Features.** 🟡 **Progression engines:** linear, double progression, 5/3/1, GZCL. Ship templates.
  - *Question:* which one first? They all need a program to remember "where you are" (week, cycle, training max).
  - *Recommended:* double progression first (uses the program's rep range and the overload hint), then linear. Leave 5/3/1 and GZCL until training maxes exist.

- **Category: ✨ Features.** 🟡 **Strength standards** (beginner → elite by bodyweight).
  - *Question:* standards depend on sex and on which lifts count. Exercise ids change between installs, so matching has to be by name. OK to cover only squat, bench, deadlift and overhead press, with a "male/female" setting?
  - *Recommended:* yes, and keep the table in one file so it is easy to correct.

- **Category: ✨ Features.** 🟡 **Different units per field:** weight, distance, measurements.
  - *Question:* everything is stored in pounds. Keep storing pounds and convert only when showing and typing (my recommendation), or store the unit with each value?
  - *Recommended:* store pounds, add a unit setting per field, and add the `unit` column to CSV. It touches every screen that shows weight, so do it as its own round.

- **Category: ✨ Features.** 🟡 **Share a workout as an image** with PR highlights. **Social-lite profile card** as an image.
  - *Question:* making a real image file needs `react-native-view-shot` (and `expo-sharing` for the file). Both are native modules, so you would need a new dev-client build. OK?
  - *Recommended:* yes, add both and rebuild once. The card view already exists.

- **Category: ✨ Features.** 🟡 **Notes templates** (part of "How did it feel" rating) and the **dumbbell-pair helper** (part of "More Tools").
  - *Question:* what should a note template be (tap-to-insert phrases like "felt strong", or a fill-in form), and what should the pair helper do (total weight of two dumbbells, or which pair makes a target)?
  - *Recommended:* notes: a row of 4 editable phrase chips in the notes box. Pair helper: skip it; the % and plate tools cover it.

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

**Look & feel round** (passed typecheck, lint and `npm test`)
- [x] Haptics: set done, PR (delayed success buzz) and rest end (double thump) feel different. Ticks at 10 s and 5 s left in rest. Settings > Haptics is Off / Normal / Strong. iOS can't read the system "reduce haptics" switch from JS, so the in-app level is the control.
- [x] Keyboard: number pads were already decimal where needed. "Next" on the last field of a set now jumps to the first field of the next set.
- [x] Light-mode contrast: ghost "previous" text uses the secondary grey, ghost-filled values are 65% opaque, PR badges are amber-700 (all ≥ 4.5:1). Other muted greys are not audited yet.
- [x] Empty states with an action button: history (Start a workout / Clear filters), photos (Programs and Goals keep the "Tap +" hint, no button) (`src/components/EmptyState.tsx`).
- [x] History filters sheet: muscle group, date range (30 d / 90 d / 1 y), sort by most volume. The Exercise page's "Show every session" opens History pre-filtered to that exercise.
- [x] One Exercise page (`app/exercise/[id].tsx`): PRs, est. 1RM chart, recent sets, notes. Opened from the workout's history icon, exercise names on a past workout, and the PRs screen. Replaces `ExerciseHistoryModal`.

**Features round** (passed typecheck, lint and `npm test`)
- [x] Progressive overload hint under each exercise ("Try 140 × 8"), one tap fills the unticked sets. Rule in `src/utils/training.ts` (`suggestNext`): every set at the top of the range and RPE ≤ 8 → +5 lb (+2.5 for isolation), else +1 rep. A program's target RPE and reps use the RPE chart instead.
- [x] "Last time" line on each exercise: date, top set and total volume.
- [x] Warm-up generator: exercise menu > "Add warm-up sets" adds 40/60/80% ramps (8/5/3 reps, rounded to 5 lb, never under the 45 lb bar). Sets are renumbered in the database too (`set_number` is now saved on update).
- [x] Set types: Normal / Drop / Failure / AMRAP / Backoff / Myo-reps (migration 12, tap the "Normal" chip while editing a set). Everything except warm-ups counts toward volume.
- [x] RPE half steps (quick chips 6-10 in 0.5 steps, "reps in reserve" text) and "Apply RPE to all sets" in the exercise menu.
- [x] Per-hand flag for dumbbells and kettlebells (exercise menu, migration 12). Volume counts both hands in Stats, History, workout detail and the finish screen; the column reads "Lbs/hd".
- [x] Assisted exercises: already covered by bodyweight exercises with a negative added load (see Fixes). No change needed.
- [x] Quick-add custom exercise: "Create 'cable pullover'" button when a search finds nothing (the "+ New" form is prefilled).
- [x] Better exercise search: typo-friendly fallback when nothing matches ("bnch pres" finds Bench Press), recently trained first when the box is empty, muscle and equipment filters were already there.
- [x] Merge tool: Settings > Merge Duplicate Exercises. History, programs and goals move to the kept exercise; the duplicate goes to Deleted Exercises (restorable). One transaction.
- [x] Daily readiness check-in (sleep, soreness, mood 1-5) on Stats with a trend chart and "workouts felt X on high-readiness days vs Y" (migration 12).
- [x] "How did it feel" rating shows as ★ n/5 in History.
- [x] More Tools tabs: 1RM calculator (Epley, Brzycki, Lombardi), RPE chart, warm-up calculator.
- [x] RPE-based loads: a program's `target_rpe` + target reps now turn into a suggested load from last time's top set.
- [x] "Save as Program" also on any past workout's detail screen (it was only on the finish screen).
- [x] Stats trends: best 1RM per exercise (with the open lift goal as a dashed line), weekly volume, bodyweight with 7-day average, goal line and projected date.
- [x] Weekly hard sets per muscle against MEV / MAV / MRV (last 7 days). Also covers "Training density".
- [x] Muscle balance in plain words (push vs pull, quads vs hamstrings).
- [x] Deload alert on Stats when weekly volume or average RPE rose 4 weeks in a row.
- [x] Recovery list: how long ago each muscle was trained.
- [x] Workout-complete insights: volume vs your last 4 sessions with the same name, best set, and rep drop-off (fatigue) flags.
- [x] Full-detail JSON export (Settings > Export Everything) with the schema written in `docs/export-schema.md`.
- [x] "Resume" for an in-progress workout on launch: already exists (the "Resume Workout?" prompt in Train). No change needed.

**Data round** (passed typecheck, lint and `npm test`)
- [x] Indexes `idx_le_exercise`, `idx_le_workout`, `idx_ls_exercise`, `idx_workouts_finished` (migration 6).
- [x] Photos save only the file name (`src/utils/photoFiles.ts` builds the path; migration 7 trims old rows). Deleting a photo deletes its file; orphan files are removed on launch and after Wipe All Data. The media-library permission prompt is gone (camera still asks for camera access).
- [x] Active session key is now `@konafit_active_session_v1` with a `schemaVersion` inside. Old/unknown saves are ignored, and the old `@kinetic_active_session` key is removed.
- [x] Workouts store `app_version` and `created_at` (migration 8).
- [x] Deleted exercises get `deleted_at` (migration 9). Ones older than 30 days with no workout or program use are purged on launch. Settings > Deleted Exercises lists them with Restore (blocked if a live exercise took the name).
- [x] Workout rating, energy (1-5) and sleep hours on the finish sheet (migration 10), charted on Stats under "How it felt".
- [x] Each set stores `rest_seconds` (time since the previous ticked set, gaps over 30 min ignored) and a `session_events` table logs start, pause, resume, finish (migration 11). `completed_at` already existed.
- [x] Exercise notes timeline: the exercise history modal lists your notes for that exercise, newest first.



**Bugs round** (everything below passed typecheck, lint and `npm test`)
- [x] App waits for the database, theme and haptics before drawing screens (no white screen, no wrong-theme flash). If startup fails you get a "Try again / Share error" screen.
- [x] Finish only counts sets you ticked. Nothing is auto-completed any more (this fixes "Copy last set to all" + Finish).
- [x] "Save as program" gives every exercise at least 1 set, inside one transaction.
- [x] Starting a workout is all-or-nothing: if it fails halfway the half-built workout is deleted and you get an alert. Unfinished leftover workouts are deleted on startup (except the one you can still resume). "Discard" on the resume prompt now really deletes it.
- [x] Finishing a workout shows an alert if saving fails and keeps your sets on screen.
- [x] Swapping an exercise that has logged sets asks first, and clears the old PR badges.
- [x] "Repeat last workout" now repeats ticked sets only, plus warm-ups and supersets (supersets are now saved in the database; ones made before this version can't be restored).
- [x] Bad saved numbers in Settings (rest time, weekly goal) fall back to the default instead of `NaN`. Weekly goal stays 1 to 7.
- [x] "Wipe All Data" lives in `src/db/wipe.ts` and clears the kv cache. Test added.
- [x] Typing in a set saves after a 400 ms pause, on blur, on Finish and when the app goes to the background (not on every key).
- [x] Local ids are random (`crypto.randomUUID()` with a fallback), so they can't clash after a restart.
- [x] Test that `PRAGMA foreign_keys` is on after startup.
- [x] One 1RM formula (`src/utils/oneRm.ts` + `oneRmSql`), reps capped at 12, used by stats, goals, PRs and the PR screen. Unit-tested and checked against the SQL version.
- [x] One volume rule (ticked, non-warm-up sets of finished workouts) in `sqlFragments.ts`. Test checks stats, history, detail, trend and muscle volume all agree.
- [x] Workout length ends at "last ticked set + 2 min" (each set now stores `completed_at`, migration 5). You can still edit it on the workout screen.
- [x] PR count ignores weights over 3x your previous best (typos).
- [x] Bodyweight exercises can now earn a volume PR (reps count when added load is 0).
- [x] Live PR badges and history PRs use the same rule; test checks unfinished workouts are ignored.
- [x] Streak counts the day a workout was finished, and the rule is written next to the query.
- [x] Streak has a "Rest Days" setting (Settings > Preferences).
- [x] Bodyweight goals save a start weight and direction; progress bar works for cutting and bulking.
- [x] Lift goals get their achieved date from the workout that reached the target.
- [x] `formatVolume` and the Stats grid round first, then pick K/M (999,999.9 shows `1.00M`).
- [x] Weekly goal shows as "2 / 4 this week" on Train and Stats.
- [x] Plate calculator shows "Closest loadable: X lb (Y lb short)", and "closest is the empty bar" under the bar weight. Added EZ 25 and Trap 55 bars. The last bar you picked is remembered (one choice for everything, not per exercise).
- [x] Percent chart is labelled as an estimate, shows reps from a formula (12+ capped), and lets you pick Epley, Brzycki or Lombardi.
- [x] Rest timer +/- only works while running, total capped at 20 min, step is a setting (5/10/15/30 s). Haptic when rest ends, and the clock re-syncs when the app returns to the foreground.
- [x] Fresh-install exercise list has no duplicates (see 🙋 for the migration part). Custom exercise names can't repeat, and muscle/equipment lists are cleaned on save.
- [x] Share card: README no longer claims PNG export (the card is a screenshot view, so no library is needed).
- [x] `lifestyle_logs` kept on purpose and documented in `database.ts`; `caffeine_mg` removed from the migration test.
- [x] Removed `@expo-google-fonts/anton`. (Adding `knip`/`depcheck` to CI was not done.)

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

**Still open from these:** long-press discoverability for removing a set. (The per-keystroke save is fixed, see Bugs round.)
