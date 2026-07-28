# Code Review — TODO

Items found during a full codebase audit. Ordered by priority (fix bugs first, then performance, then polish).

---

## 🐛 Bugs

- [ ] **Recovery "Discard" deletes nothing**
  - File: `app/(tabs)/train.tsx:285-291`
  - When the user taps "Discard" on the recovery prompt, `session` is still `null` (it was never resumed), so `discardWorkout()` early-returns and does nothing. The workout record stays in the DB and the kvStore entry is never cleared — the recovery prompt reappears every launch.
  - Fix: call `deleteWorkout(cachedSession.workoutId)` and `kvStore.removeItem(...)` directly, bypassing the hook's null-guard.

---

## ⚡ Performance

- [ ] **Side effect (DB write) inside a React state updater**
  - Files: `src/hooks/useWorkoutSession.ts:314-322` (also `toggleSetComplete`, `toggleSetWarmup`)
  - `upsertLoggedSet` is called from inside the `setSession` updater function. State updaters must be pure — React can call them multiple times in Concurrent/StrictMode, causing duplicate DB writes.
  - Fix: capture the set to write before/after the updater, then call the DB function outside it.

- [ ] **N+1 queries when loading a workout detail**
  - File: `src/db/historyQueries.ts:88-103`
  - One SQL query per exercise to fetch its sets. With 10 exercises, that's 11 round-trips. Rewrite as a single JOIN query and group the results in JS.

- [ ] **`seedDefaultExercises` fires ~200 individual INSERTs without a transaction**
  - File: `src/db/database.ts:486-497` (also `seedExpandedExercises`)
  - On a fresh install, every exercise is inserted one by one. Wrap the loop in `database.withTransactionAsync()` — it'll be dramatically faster and atomic.

- [ ] **No indexes on the most-queried columns**
  - File: `src/db/database.ts` (schema init section)
  - `getGhostSets` and `getHistPRs` join across 3 tables and filter on `exercise_id` / `workout_id` / `finished_at` with no explicit indexes. As workout history grows these get slower.
  - Add to schema:
    ```sql
    CREATE INDEX IF NOT EXISTS idx_le_exercise ON logged_exercises(exercise_id);
    CREATE INDEX IF NOT EXISTS idx_le_workout ON logged_exercises(workout_id);
    CREATE INDEX IF NOT EXISTS idx_ls_exercise ON logged_sets(logged_exercise_id);
    CREATE INDEX IF NOT EXISTS idx_workouts_finished ON workouts(finished_at);
    ```

- [ ] **Exercise search fires a DB query on every keystroke**
  - File: `src/components/workout/AddExerciseSheet.tsx:224-227`
  - No debounce — typing "bench" fires 5 queries. Add a 150ms `setTimeout` debounce to the search effect.

- [ ] **`upsertLoggedSet` fires on every keystroke in weight/reps fields**
  - File: `src/hooks/useWorkoutSession.ts:314` → `src/db/workoutQueries.ts:82`
  - Typing "225" generates 3 DB writes. Debounce the write at 300ms, or only write on blur/set-complete.

- [ ] **`saveEdits` on the workout detail screen uses sequential `await` in a loop**
  - File: `app/workout/[id].tsx:115-132`
  - Each set is saved one at a time. Swap to `Promise.all(Object.entries(setEdits).map(...))`.

- [ ] **24+ `Modal` components always mounted during an active workout**
  - File: `src/components/workout/ExerciseBlock.tsx`
  - Each `ExerciseBlock` mounts 3 modals unconditionally (history, context menu, notes). With 8 exercises, 24 modals are always in the tree. Gate them on their open state: `{menuOpen && <Modal ...>}`.

---

## 🎨 UX / Polish

- [ ] **`saveEdits` has no loading state — double-tap can fire duplicate saves**
  - File: `app/workout/[id].tsx:115`
  - Add a `saving` boolean state, set it before the async work, and disable/show a spinner on the Save button while it's in progress.

- [ ] **`KeyboardAvoidingView` has `undefined` behavior on Android**
  - Files: `src/components/workout/AddExerciseSheet.tsx:277`, `src/components/workout/ExerciseBlock.tsx:250`
  - `behavior={Platform.OS === "ios" ? "padding" : undefined}` — on Android `undefined` means the keyboard can cover inputs. Change to `"height"` for Android.

- [ ] **Superset border uses raw `#FF0000` instead of the theme color**
  - File: `src/components/workout/ExerciseBlock.tsx:75`
  - `borderLeftColor: "#FF0000"` is harsh pure red. Replace with `#E11D48` (crimson) to match the rest of the theme.

- [ ] **No accessibility labels on interactive elements**
  - Affects: `SetRow`, `ExerciseBlock`, `WorkspaceHeader`, and others
  - Zero `accessibilityLabel` or `accessibilityRole` props anywhere. TalkBack / VoiceOver users get no context. Start with the highest-traffic actions: set complete button, add set, add exercise.

---

## 🏗️ Architecture / Reliability

- [ ] **Migration system silently swallows all failures**
  - File: `src/db/database.ts:165-167`
  - `try { await execAsync(m); } catch { }` — a migration that fails for a real reason (wrong type, constraint) is silently skipped forever, leaving the schema in a bad state with no indication.
  - At minimum, log non-"duplicate column" errors: `catch (e) { if (!String(e).includes("duplicate column")) console.warn(...) }`.

- [ ] **`addExercise` and `addExerciseAsSuperset` share ~40 lines of duplicated logic**
  - File: `src/hooks/useWorkoutSession.ts:143-250`
  - Both functions fetch ghost sets, hist PRs, library notes, create DB records, and build an `ActiveExercise` object identically. Extract a shared `buildExercise(...)` helper and call it from both.

- [ ] **`refreshKey` forces full child remount on stats refresh**
  - File: `app/(tabs)/stats.tsx:53`
  - `setRefreshKey(k => k + 1)` remounts child components instead of re-rendering them with new data. This resets animations and local state inside those components. Pass data as props or use a proper invalidation approach.

---

---

## 🔄 Onboarding & Retention

- [ ] **No first-run onboarding**
  - App opens directly on a blank Train screen with no guidance. Add a one-time coach mark (3 steps: start workout → complete sets → track PRs) gated by a `@konafit_onboarding_done` kvStore flag.

- [ ] **Rest timer freezes when app is backgrounded**
  - `src/hooks/useRestTimer.ts` uses a raw `setInterval` with no `AppState` listener. On return from background the timer shows a stale value and never fires completion. Fix: record `endTime = Date.now() + remaining * 1000` on start, recalculate `remaining` from wall-clock on each tick and on `AppState` change to `active`.

- [ ] **No workout streak / frequency summary**
  - Stats has volume charts and PRs but no "X days this week" retention anchor. Data already exists in `workouts.finished_at` — no schema change needed.

- [ ] **"Save as Program" CTA is buried on workout-complete**
  - File: `app/workout-complete.tsx`
  - It's a ghost text link below the primary "Done" button. Promote to a secondary card so users don't miss it.

- [ ] **No starter/template programs on fresh install**
  - New users see "No programs yet." Seed 2–3 bundled templates (e.g. Push/Pull/Legs) inside `seedDefaultExercises` so there's something to tap on day one.

---

## 🛡️ Edge Cases & Error Handling

- [ ] **Wipe Data leaves photo files on disk**
  - File: `app/settings.tsx:162`
  - `DELETE FROM progress_photos` removes DB rows but never calls `FileSystem.deleteAsync` on the stored files. `konafit/photos/` grows unbounded after a wipe. Fix: query `SELECT photo_uri FROM progress_photos` first, delete each file, then run the SQL.

- [ ] **`initializeDatabase` failure shows a blank screen**
  - File: `app/_layout.tsx:35`
  - `initializeDatabase().catch(console.error)` — if SQLite fails to open (storage full, corrupted DB), the app silently renders nothing. Add a `dbError` state and show a user-facing message with a Retry option.

- [ ] **No React error boundary**
  - Any unhandled JS exception in a screen component produces an invisible blank screen on production builds. Wrap the root layout children in an `ErrorBoundary` with a "Something went wrong — restart the app" fallback.

- [ ] **Camera permission denial in `ProgressPhotoGallery` is a silent no-op**
  - File: `src/components/stats/ProgressPhotoGallery.tsx:46`
  - `if (cam.status !== "granted") return` with no alert. User taps Camera, nothing happens. Show the same alert as `train.tsx:68` directing them to Settings.

- [ ] **`handleSaveAsProgram` has no error handling**
  - File: `app/workout-complete.tsx:56`
  - If `createProgramFromWorkout` throws, the error is uncaught and the UI hangs silently. Wrap in try/catch and show an alert on failure.

- [ ] **LocationSheet "Discard" cancels the whole workout without warning**
  - File: `app/(tabs)/train.tsx:247-250`
  - `handleDiscardWorkout` in the location picker path discards the entire workout — not just the location selection. A user expecting to skip location entry loses their session. Rename the action and gate it behind a confirmation alert.

---

## ♿ Accessibility & Localization

- [ ] **Weight unit setting has no effect on `BodyweightLogger`**
  - File: `src/components/stats/BodyweightLogger.tsx:37,44,78`
  - `"lbs"` is hardcoded as placeholder and label regardless of the unit preference in kvStore. A kg user logs values that are stored as if they were lbs. Fix: read `getWeightUnit()` in the component and use the result.

- [ ] **Weight values in history and stats have no unit label**
  - Ghost sets, exercise history, and PR badges display raw numbers (`225 × 5`) with no unit suffix. Ambiguous after a lbs → kg switch. Add unit label wherever weights are rendered.

- [ ] **No dynamic font scaling**
  - All `Text` components use fixed Tailwind sizes; the system Accessibility → Large Text setting has no effect. Allow scaling on body/content text by default; only suppress it (`allowFontScaling={false}`) on layout-critical elements like tab labels.

- [ ] **Launch background color causes a white flash**
  - File: `app.json` — `"backgroundColor": "#F8FAFC"` is near-white. On a dark-themed app this produces a jarring white flash before the UI renders. Set to `"#0A0A0A"` to match the obsidian background, and add a matching `splash.backgroundColor`.

---

## 🏪 App Store / Play Store Readiness

- [ ] **No `versionCode` in `app.json`**
  - Android requires an incrementing integer `versionCode` per release. Add `"android": { "versionCode": 1 }` and document that it must be bumped with every submission.

- [ ] **No privacy policy**
  - Google Play requires a privacy policy URL for any app requesting camera or media library permissions. Host a simple "all data stored locally, we collect nothing" policy and link it in the Play Console and in a Settings row.

- [ ] **No splash screen configuration**
  - File: `app.json` — no `splash` key. Expo falls back to a default white splash. Add:
    ```json
    "splash": { "image": "./assets/splash.png", "resizeMode": "contain", "backgroundColor": "#0A0A0A" }
    ```

- [ ] **No crash reporting**
  - Sentry appears in `package-lock.json` only as a transitive EAS dep — it is not initialized in the app. Add `@sentry/react-native` before the first real-user rollout to avoid learning about crashes from 1-star reviews.

- [ ] **Store listing copy not drafted**
  - No 80-char short description or 4000-char full description prepared. These directly affect Play Store search ranking and conversion. Draft and store them in the repo (e.g. `store/play-store-listing.md`) before submission.

- [ ] **Content rating questionnaire**
  - Google Play requires a completed IARC content rating before publishing. Verify this is filled out in the Play Console (a no-UGC fitness app should land "Everyone").

- [ ] **`minSdkVersion` not explicitly declared**
  - Expo SDK 56 defaults to API 23 (Android 6.0). Explicitly set `"minSdkVersion": 26` in `app.json → android` to opt into modern permission APIs and reduce support surface, or document the chosen minimum.

---

## Summary

| Priority | Count |
|----------|-------|
| 🐛 Bugs | 1 |
| ⚡ Performance | 8 |
| 🎨 UX / Polish | 4 |
| 🏗️ Architecture | 3 |
| 🔄 Onboarding & Retention | 5 |
| 🛡️ Edge Cases & Error Handling | 6 |
| ♿ Accessibility & Localization | 4 |
| 🏪 App Store Readiness | 7 |
| **Total** | **38** |
