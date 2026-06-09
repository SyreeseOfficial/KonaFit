# 📝 KINETIC: DEVELOPMENT & ARCHITECTURE UPDATE LOG

This chronological ledger tracks major features, structural database migrations, and visual system shifts over the lifecycle of the Kinetic application.

**Developers: Always append your new log entries to the top of this file.**

---

### 2026-06-08 — Android Nav Bar Fix, Stats Spacing Fix, Multi-Select Exercise Picker, Filter Scroll Fix

* **Status:** Implemented
* **Scope:** Android Layout / Stats Tab / Exercise Picker
* **Changes Executed:**
  * **Android nav bar overlap fix (tabs):** Added explicit `SafeAreaProvider` at `app/_layout.tsx` root. Tab layout now uses `useSafeAreaInsets()` to add `insets.bottom` to tab bar `height` and `paddingBottom`, so the tab icons clear the Android 3-button nav bar on Vivo Origin OS and similar OEM builds.
  * **Stats section spacing root cause fixed:** Previous `mb-X` approach only added space *after* sections; section titles had no top padding. Replaced all section wrappers with `style={{ paddingTop: 72 }}` (explicit px) so every section title has 72px of breathing room directly above it, independent of NativeWind class resolution.
  * **Multi-select exercise picker:** `AddExerciseSheet` gains `multiSelect` prop (default `false`, backwards-compatible). When enabled: tapping toggles a checkmark on the row avatar; bottom bar shows "Add X Exercises" crimson button; creating a new exercise in multi-select mode queues it and returns to search. Enabled on Train "Add Exercise" and Programs "Add Exercise to Day"; swap exercise and GoalsSection picker remain single-select.
  * **Filter picker scroll fix:** Muscle group and equipment filter modals now wrap options in a `ScrollView` with `maxHeight: screenHeight * 0.55`, making all 21+ options reachable.
  * **AddExerciseSheet bottom bar inset:** Added `useSafeAreaInsets()` and `paddingBottom: insets.bottom` to the bottom action bar so "Add X Exercises" button is never hidden behind the Android system navigation bar.
* **Architectural Notes:** Nav bar auto-hide (immersive mode) is a system-level setting — apps cannot force it without a native build and `expo-navigation-bar`. The correct user fix is to switch to gesture navigation in Android Settings → Navigation style. The inset-based padding ensures the button is always reachable regardless of nav bar mode.

---

### 2026-06-08 — Feature Expansion: Plate Config, Program Builder, Goals, Settings Overhaul + UI Spacing Pass

* **Status:** Implemented
* **Scope:** Tactical Tools / Programs Tab / Train Tab / Settings / Global UI
* **Changes Executed:**
  * **Plate Calculator:** Per-plate enable/disable toggles (ON/OFF per plate type), custom plate creation with weight input and color picker. Settings persisted to `kv_store` so state survives app restarts.
  * **Program Builder overhaul (`new.tsx`):** Program type selector (Single Workout / Weekly / Multi-Week) with radio-button cards. Advanced settings panel (collapsible, with dot indicator when filled): workout duration picker (10–240 min in 10-min increments via bottom-sheet modal), training focus multi-select chips (9 options), equipment single-select chips, difficulty single-select row (Beginner → Elite).
  * **Programs list:** Replaced inline Clone/Delete icons with a 3-dot context menu per card (Duplicate, Archive, Delete Permanently). Program type badge and difficulty shown on each card.
  * **Archive programs:** New `archived` column on `programs` table (migration). Archive from the 3-dot menu; restore or permanently delete from Settings → Archived Programs screen (`app/archived-programs.tsx`).
  * **Goals Section (`src/components/train/GoalsSection.tsx`):** Three goal types — Lift PR (selects exercise, target weight, auto-calculates current best Epley 1RM from logged sets), Body Weight (target weight vs. latest bodyweight log), Custom (title + notes). Progress bars, mark-achieved toggle, delete. Lives on the Train idle screen below the Start Workout button; screen converted to ScrollView.
  * **Custom exercises management (`app/custom-exercises.tsx`):** Inline edit (name + muscle group) and delete for any exercise with `is_custom = 1`. Accessible from Settings → Custom Exercises. `createCustomExercise` updated to stamp `is_custom = 1` on insert.
  * **Settings overhaul:** New Units section (weight lbs/kg, distance mi/km chip toggles, persisted to `kv_store` with exported helpers `getWeightUnit` / `getDistanceUnit`). Library section with nav rows to Custom Exercises and Archived Programs. Danger Zone updated to also wipe `goals` table. About card expanded with full story and shoutout to Syreese Delos Santos.
  * **DB migrations:** `programs.archived INTEGER DEFAULT 0`, `exercises.is_custom INTEGER DEFAULT 0`, both added via safe try/catch migration loop.
  * **UI spacing pass:** Increased vertical breathing room throughout — screen headers, section gaps, card padding, row heights, set rows, modal sheets. SectionHeader mb increased. Stats sections spacing increased. ExerciseBlock header/footer paddings. SetRow row height raised.
* **Architectural Notes:** `getWeightUnit` / `getDistanceUnit` are exported from `settings.tsx` for future consumption by display components. Unit preference is stored but not yet applied to all display strings — wiring is a follow-up task. Goals progress for `lift_pr` type uses the same Epley formula as the rest of the stats pipeline (via `getGoalProgress` in `goalQueries.ts`). Archive is a soft-delete pattern (flag on row) rather than a separate table, keeping queries simple and restore trivial.

---

### [YYYY-MM-DD] — TEMPLATE ENTRY (Example)

* **Status:** [Implemented / Refactored / Migrated]
* **Scope:** [e.g., Active Logger Workspace / Database Schema]
* **Changes Executed:**
  * Detailed bullet point of code addition or adjustment.
  * Detailed bullet point of code addition or adjustment.
* **Architectural Notes:** Explain the engineering reasoning behind this change and any specific dependencies or files affected for future context.

---

### 2026-06-07 — Full App Build (Phases 1–7) + UI Redesigns & Bug Fixes

* **Status:** Implemented
* **Scope:** Entire application — all phases shipped in this session
* **Changes Executed:**
  * **Phase 1:** Expo project, SQLite schema (workouts, logged\_exercises, logged\_sets, programs, program\_days, program\_exercises, bodyweight\_logs, lifestyle\_logs, kv\_store), NativeWind, bottom tab navigation (Train / Stats / Programs).
  * **Phase 2:** Train Tab workspace — useWorkoutSession hook with SQLite-backed kv\_store session persistence and crash recovery, useRestTimer (90s countdown ±30s), useWorkoutTimer (pause/resume/reset), AddExerciseSheet (FTS→LIKE search, muscle group + equipment filters, use\_count badges, Create Custom Exercise form), ExerciseBlock (reference-matched layout: index · name · ‹ header, Set/Previous/Lbs/Reps/RPE/✓ columns, ⊕ Add Set + ⇄ Swap footer), SetRow (rounded inputs, ghost previous data, circular complete toggle), RestTimerBar.
  * **Phase 3:** Session auto-save on every state mutation (kv\_store); boot-time recovery prompt (resume / discard); finalize-on-finish with duration calculation.
  * **Phase 4:** Stats Tab — getTotalLifted, streak calculation, 1RM history (Epley formula), volume by muscle group, habit calendar (13-week dot grid), StatsGrid (4 metrics), OneRMChart (SVG line), VolumeChart (SVG horizontal bars, 7d/30d toggle), MuscleHeatmap (SVG front/back body, crimson gradient), HabitCalendar, LifestyleLogger (bodyweight, hydration, pre-workout toggle, location).
  * **Phase 5:** Programs Tab — Stack navigation (index / new / \[id\]), program CRUD + clone, day editor, exercise targets (sets/reps/RPE), LAUNCH WORKOUT action (navigates to Train with programDayId param, pre-populates session from template). swapExercise added to session hook.
  * **Phase 6:** Tactical Tools modal — PlateCalculator (greedy algorithm, Olympic plate colors, SVG barbell visualization, bar selector), PercentageCalculator (50–100% table, rep ranges, smart rounding 0/2.5/5 lb, cross-links to plate calc). Accessible via calculator icon in Train and Stats headers.
  * **Phase 7:** History & Export — WorkoutHistoryList in Stats tab, workout/\[id\] detail screen, Markdown share (RN Share API), PNG share card (modal screenshot pattern), CSV export (expo-file-system + Share, file on iOS / text on Android).
  * **Bug fixes:** Replaced expo-sharing (needs native build) with RN Share; replaced @react-native-async-storage (needs native build) with SQLite kv\_store; replaced FTS5 search (empty index) with LIKE query; fixed Create Exercise button hidden below scroll (pinned to bottom); fixed AddExerciseSheet sheet height and filter dropdowns.
* **Architectural Notes:** All state is local-first. Session persistence uses a kv\_store table in the same SQLite database to avoid native module dependency. Native modules that require a compiled dev build (expo-sharing, react-native-view-shot, @react-native-async-storage) were removed and replaced with built-in or already-linked alternatives. FTS5 virtual table is retained in schema for future use but search queries use LIKE for reliability.

---

### 2026-06-06 — Feature Expansion & Documentation Refinement

* **Status:** Specification Enhancement
* **Scope:** Markdown formatting fixes & new feature specifications
* **Changes Executed:**
  * Fixed all markdown formatting issues across specification files (SYSTEM_ARCHITECTURE.md, DEVELOPER_DIRECTIONS.md, UI_UX_SPEC.md, FEATURES_LOGGING.md, FEATURES_CALCULATORS.md, FEATURES_STATS_PROGRAMS.md, UPDATE_LOG.md).
  * Added per-set notes feature to `Logged_Sets` schema (`notes` field) — allows granular annotation on individual sets for form cues, difficulty tracking, and detailed performance notes.
  * Implemented collapsible exercise cards during active workouts — reduces visual clutter during long sessions and allows users to focus on current movement.
  * Enhanced exercise swap functionality documentation to emphasize zero-friction adaptability during live gym sessions.
  * Integrated PR detection & display post-workout: finish modal now shows all new Personal Records achieved during the session, calculated via Epley Formula comparison against historical data.
  * Improved UI_UX_SPEC formatting by converting YAML block into clean markdown tables for better human and AI readability.
* **Architectural Notes:** Per-set notes required adding a nullable `notes` column to `Logged_Sets` table. Collapsible state is a pure UI concern stored in React component state (not persisted). PR detection runs during "Finish Workout" as part of the metrics calculation pipeline — no additional database queries needed beyond existing 1RM calculations. All feature additions maintain local-first architecture and zero external dependencies.

---

### 2026-05-16 — Project Genesis & Specification Mapping

* **Status:** Implemented Base Specifications
* **Scope:** Repository Scaffolding & Governance
* **Changes Executed:**
  * Formulated the baseline core repository map (`README.md`).
  * Configured the local-first Expo SQLite relational database entities and state auto-save caching criteria (`SYSTEM_ARCHITECTURE.md`).
  * Deep-linked the Obsidian Tactical layout tokens, font weights, and zero-radius geometry patterns directly from the Google Stitch workspace profile (`UI_UX_SPEC.md`).
  * Outlined the technical logic specs for the logging sheet, calculators, trackers, and export blocks (`FEATURES_LOGGING.md`, `FEATURES_CALCULATORS.md`, `FEATURES_STATS_PROGRAMS.md`).
* **Architectural Notes:** Initial project blueprint locked down. The system is structurally primed for local-first execution. Claude is granted full autonomy to build as a Senior Engineer.

