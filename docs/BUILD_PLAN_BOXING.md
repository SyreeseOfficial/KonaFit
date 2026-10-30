# Build Plan: Boxing in KonaFit

Source of truth for *what* to build: `docs/PRD_BOXING.md` (call it "the PRD").
This file is *how* and *in what order*. It is written to be executed by an AI coding agent, one step at a time.

---

## 0. How to use this plan (read first, every session)

**You are the agent. Do exactly one step per run unless told otherwise.**

### Session start checklist

1. Read `AGENTS.md`, `docs/DEVELOPER_DIRECTIONS.md`, `docs/SYSTEM_ARCHITECTURE.md`, `docs/UI_UX_SPEC.md`, and the `FEATURES_*` docs in `docs/`. Read the PRD sections the step cites.
2. Find the first step in the **Progress tracker** (section 2) that is not checked. That is your step. Do not skip ahead.
3. If the step touches an Expo / React Native API, read the matching page at `https://docs.expo.dev/versions/v56.0.0/` first (AGENTS.md rule). Do not code from memory of older SDKs.
4. `git status` must be clean (the untracked PRD file is the one exception until Step 0.1 commits it). If not, stop and tell the user.

### Step execution loop

1. Implement **only** what the step lists. No drive-by refactors, no work from later steps.
2. Write or update the tests the step lists. Pure logic gets tests; UI steps get a manual check list.
3. Run the gate: `npm run typecheck && npm run lint && npm test`. All three must pass.
4. For steps marked **[LOG]**, add an entry at the **top** of `docs/UPDATE_LOG.md` (date, files, what, why), per `DEVELOPER_DIRECTIONS.md`.
5. Tick the step in the Progress tracker (same commit).
6. Commit with the step's given message, ending with the `Co-Authored-By` trailer from the session attribution. One step = one commit. Then `git push`.
7. Report to the user: step done, what they can try on their phone (`npx expo start --tunnel`, dev client, see project memory), and the next step's ID and title.

### Hard rules

- **Never edit a shipped migration.** Append to `MIGRATIONS` in `src/db/database.ts` (next is #13).
- **Every `workouts` query is suspect.** Boxing rows have zero sets. Lift-only math must filter `type = 'lift'` (or join through `logged_sets`). Never let a boxing row divide by zero or count as volume.
- **No new colors.** Use existing theme tokens (`src/utils/theme.ts`, `docs/UI_UX_SPEC.md`). The only new color is the boxing calendar dot (Step 7.3).
- **Sharp geometry, existing components.** Reuse `LineChart`, `TrendCards`, `SectionHeader`, `SetRow` patterns, `haptics`, `kvStore`. Look in `src/components/` before writing a new one.
- **A step that cannot meet its Done-when stops and asks.** Do not widen scope to make it pass.
- **Out of scope** is PRD section 15. If a step seems to need something from that list, stop and ask.

### Decisions made for the PRD's open questions (section 17)

These are settled so you don't re-ask. Change only if the user says so.

| # | Question | Decision |
|---|---|---|
| 1 | System sounds | Resolved by the Step 0.2 spike. Fallback order: OS sound via Expo API, then haptics-only, then ask the user about adding `expo-audio` with one tiny generated tone. Never ship without asking if a new dependency is needed. |
| 2 | Training-load fallback | Overall session RPE if set, else average of the session's logged RPEs (lift working sets / boxing rounds), else the session is **excluded** from load. |
| 3 | History filter | Chips: All / Lift / Boxing. |
| 4 | Detail vs edit | Detail screen shows the summary card plus a collapsed round list. "Edit" turns the round list and fields editable in place. |
| 5 | Goal schema | Extend `goals` with `start_date`, `end_date`, and reuse `target_value` and `direction` (`down` = ceiling, `up` = floor). New `GoalType`s: `boxing_rounds`, `boxing_sessions`, `boxing_minutes`, `boxing_avg_rpe`. |
| 6 | Readiness on boxing-only days | Same once-per-day card, same behavior. |
| 7 | Hidden default chips | Hiding does not change how old rounds display. |

### Design decisions that apply across steps

- **Row creation:** the boxing `workouts` row and its `boxing_rounds` are written in **one transaction at finish** (or on quick-add). While running, the kv snapshot is the only state. Step 4.1 must confirm nothing in `train.tsx` / `app/_layout.tsx` depends on an unfinished `workouts` row to detect an in-progress session.
- **New `workouts` columns:** `type TEXT NOT NULL DEFAULT 'lift'`, `rpe INTEGER`, `session_tags TEXT` (JSON array), `duration_seconds INTEGER` (active time, excludes pauses). Verify first whether `notes` already exists; add it only if not.
- **Timer engine is a pure module** (`src/utils/boxingTimer.ts`): state in, state out, `now` passed in. The hook and screen are thin shells. This is what makes the catch-up logic testable (acceptance #12).
- **Snapshot key:** `@konafit_active_boxing_v1`, separate from `@konafit_active_session_v1`. Each carries a `kind` field so one can never be loaded as the other.
- **Settings keys** are prefixed `@konafit_boxing_*` and added to `PRESERVED_KEYS` where the lifting equivalents are.

---

## 1. Dependency map

```
Phase 0  prep + sound spike
   |
Phase 1  data (migration, types, audits, export/wipe)  <-- everything depends on this
   |
Phase 2  timer engine + settings + sound util (no UI)
   |
Phase 3  Start picker + setup screen
   |
Phase 4  timer screen (the big one)
   |
Phase 5  per-round RPE / focus + chips
   |
Phase 6  finish flow + recap
   |
Phase 7  history, calendar, streaks      Phase 8  edit + quick-add
   |                                        |
Phase 9  stats + weekly load  ---------------+
   |
Phase 10 goals
   |
Phase 11 settings polish, readiness, chip manager
   |
Phase 12 docs + final acceptance
```

Phases 7 and 8 can swap order. Everything else is sequential.

---

## 2. Progress tracker

Tick as you go. Each line = one commit.

**Phase 0: Prep**
- [x] 0.1 Commit PRD + this plan
- [x] 0.2 Spike: sounds in SDK 56 (decision only, no app code)

**Phase 1: Data foundation**
- [x] 1.1 Migration 13: `workouts.type` + boxing columns
- [x] 1.2 Migration 14: `boxing_rounds` + `boxing_focus_chips` (seeded)
- [x] 1.3 Boxing types + write/read queries
- [x] 1.4 Audit: `statsQueries.ts`
- [x] 1.5 Audit: `insightQueries.ts`
- [x] 1.6 Audit: `historyQueries.ts` + `workoutQueries.ts`
- [x] 1.7 Audit: `goalQueries.ts`, `programQueries.ts`, `app/_layout.tsx`, `train.tsx` reads
- [x] 1.8 Export, import compat, and wipe

**Phase 2: Timer engine (no UI)**
- [x] 2.1 Pure timer state machine + tests
- [x] 2.2 Boxing settings (kv) + helpers
- [x] 2.3 Sound/haptic cue util
- [x] 2.4 Active-boxing snapshot (save/load/clear) + tests

**Phase 3: Start flow**
- [x] 3.1 Start picker on Train (Lift / Box)
- [x] 3.2 Boxing setup screen
- [x] 3.3 Repeat-last-setup shortcut

**Phase 4: Timer screen**
- [x] 4.1 `useBoxingSession` hook + route skeleton
- [x] 4.2 Timer face (phase colors, big clock, round counter)
- [ ] 4.3 Controls: pause, skip rest, +30s, end early
- [ ] 4.4 Cues: bell, 10s warning, keep-awake
- [ ] 4.5 Background catch-up + kill/resume

**Phase 5: In-session logging**
- [ ] 5.1 Round RPE row + focus chips component
- [ ] 5.2 Rest-time prompt + carry-over

**Phase 6: Finish + recap**
- [ ] 6.1 Finish sheet (overall RPE, tags, name) + save
- [ ] 6.2 Boxing recap screen

**Phase 7: History, calendar, streaks**
- [ ] 7.1 History filter chips + boxing row
- [ ] 7.2 Boxing detail screen (summary card + rounds)
- [ ] 7.3 Calendar/week dots
- [ ] 7.4 Streaks include boxing

**Phase 8: Editing**
- [ ] 8.1 Full edit of finished sessions
- [ ] 8.2 Quick-add past session

**Phase 9: Stats**
- [ ] 9.1 Boxing stats queries + tests
- [ ] 9.2 Boxing section on Stats
- [ ] 9.3 Weekly training load query + tests
- [ ] 9.4 Weekly load section on Stats

**Phase 10: Goals**
- [ ] 10.1 Migration 15 + goal types + progress queries + tests
- [ ] 10.2 Create-goal UI and display

**Phase 11: Polish**
- [ ] 11.1 Boxing timer settings screen section
- [ ] 11.2 Focus chip manager (add / edit / hide)
- [ ] 11.3 Readiness prompt before boxing

**Phase 12: Close-out**
- [ ] 12.1 Docs updates
- [ ] 12.2 Acceptance pass + cleanup

---

## Phase 0: Prep

### Step 0.1: Commit the PRD and this plan
- **Do:** `git add docs/PRD_BOXING.md docs/BUILD_PLAN_BOXING.md`. Tick this step.
- **Gate:** none (docs only).
- **Commit:** `docs: add boxing PRD and build plan`

### Step 0.2: Spike: what sound can SDK 56 play?
PRD 16 / 17.1. **Decision only; no app code merged.**
- **Do:**
  1. Read the SDK 56 docs for `expo-haptics`, `expo-audio`, and anything about system sounds/notifications sounds.
  2. Answer in a new file `docs/SPIKE_BOXING_SOUNDS.md` (under 40 lines): can Expo play OS sound IDs without an asset? If not, what is the smallest honest option? List 2-3 options with trade-offs (haptics-only; `expo-audio` + one bundled tone; local notification sound).
  3. Recommend one. **Stop and ask the user to choose** before Step 2.3. Record their choice at the top of the spike file.
- **Done when:** the spike file exists with a user-confirmed choice.
- **Commit:** `docs: record boxing sound spike and decision`

---

## Phase 1: Data foundation

### Step 1.1: Migration 13, `workouts.type` and boxing columns
PRD 6.
- **Files:** `src/db/database.ts`, `src/__tests__/db.test.ts`.
- **Do:**
  - Append migration 13 using `addColumn`: `type TEXT NOT NULL DEFAULT 'lift'`, `rpe INTEGER`, `session_tags TEXT`, `duration_seconds INTEGER`. Check `PRAGMA table_info(workouts)` for an existing `notes` column; add `notes TEXT` only if missing.
  - Add index `idx_workouts_type_finished ON workouts(type, finished_at)`.
- **Tests:** migrating a DB seeded at version 12 with lifting rows leaves every row `type = 'lift'`, data otherwise unchanged. Re-running is a no-op.
- **Done when:** gate passes; app still launches with existing data and Train/History/Stats look identical.
- **Commit:** `feat(db): add workouts.type and boxing session columns (migration 13)`

### Step 1.2: Migration 14, `boxing_rounds` and `boxing_focus_chips`
PRD 6, 9.
- **Do:** append migration 14:
  - `boxing_rounds(id, workout_id REFERENCES workouts ON DELETE CASCADE, round_number, rpe, focus_tags TEXT /*JSON array of chip ids*/, focus_note, work_seconds, rest_seconds, actual_work_seconds, actual_rest_seconds)` + index on `workout_id`.
  - `boxing_focus_chips(id, name, group_name, is_default, is_hidden, order_index)`.
  - Seed the 13 defaults from PRD 9 (Punches, Movement, Intent, Technical), `INSERT` only if the table is empty.
- **Tests:** table exists; seed count is 13; cascade delete removes rounds; double-run doesn't reseed.
- **Commit:** `feat(db): add boxing_rounds and boxing_focus_chips (migration 14)`

### Step 1.3: Boxing types and basic queries
- **Files:** new `src/types/boxing.ts`, new `src/db/boxingQueries.ts`.
- **Do:** types (`BoxingSetup`, `BoxingRound`, `BoxingSession`, `FocusChip`). Queries: `saveBoxingSession(session)` (one transaction: insert workout with `type='boxing'` and `finished_at`, insert rounds), `getBoxingSession(id)`, `getFocusChips({includeHidden})`, `getLastBoxingSetup()` (derive from latest boxing workout's first round + count).
- **Tests:** round-trip save/get; `getLastBoxingSetup` returns null on empty DB; app_version/created_at set like lifting workouts.
- **Commit:** `feat(db): boxing session types and save/read queries`

### Steps 1.4 to 1.7: Query audit (one commit per file group)
PRD 6 "Existing code to audit". For **each** file: grep every `workouts` reference, decide per query whether boxing must be excluded, included, or handled, and add a test with a boxing row in the DB asserting lift numbers are unchanged.

| Step | Files | Watch for |
|---|---|---|
| 1.4 | `src/db/statsQueries.ts` (15 refs) | volume, PRs, counts, avg duration, weekly counts. Streak logic is **left alone here**: it changes in 7.4. Counts like "workouts this week" are decided in 7.4/9.x; for now filter to `type='lift'` and leave a `// boxing: see Step 7.4` comment where a count will later include boxing. |
| 1.5 | `src/db/insightQueries.ts` (9) | muscle week, ghost sets, PR badges: lift only. |
| 1.6 | `src/db/historyQueries.ts` (12), `src/db/workoutQueries.ts` (15) | `getWorkoutHistory`, `getLastWorkoutExercises` ("repeat last" must skip boxing), CSV export rows, `getWorkoutDetail` on a boxing id must not crash. Add an optional `type` filter param to `getWorkoutHistory` (used in 7.1). |
| 1.7 | `goalQueries.ts` (3), `programQueries.ts` (1), `locationQueries.ts`, `photoQueries.ts`, `app/_layout.tsx`, `app/(tabs)/train.tsx` reads, `app/settings.tsx` reads | Anything touching `workouts` for counts, "last workout", program day matching. Also confirm how `train.tsx`/`_layout.tsx` detect an in-progress session (must use the kv snapshot, not an unfinished row). |

- **Done when (each):** gate passes; new tests with a boxing row prove lift output unchanged; no query divides by a count that boxing could make zero.
- **Commits:** `fix(db): keep boxing rows out of lift stats queries` / `...insight queries` / `...history queries` / `...misc workouts reads`

### Step 1.8: Export, import compat, wipe
PRD 16. Read `docs/export-schema.md` first.
- **Files:** `src/db/exportJson.ts`, `src/db/wipe.ts`, `docs/export-schema.md`, tests.
- **Do:** add `boxing_rounds` and `boxing_focus_chips` to `TABLES` (rounds after `workouts`); bump `EXPORT_FORMAT_VERSION` to 2; document new columns/tables and the "missing `type` means `lift`" rule. `wipe.ts`: `DELETE FROM boxing_rounds;` before `workouts`; reset focus chips to defaults (delete custom, unhide, reseed order) rather than emptying them. Check whether the repo has an importer; if so make it default missing `type` to `lift`.
- **Tests:** export contains the new tables and `type`; wipe leaves 0 boxing rows and the 13 default chips; a v1-shaped export (no `type`) is handled if an importer exists.
- **[LOG]**
- **Commit:** `feat(db): export and wipe cover boxing tables (format v2)`

---

## Phase 2: Timer engine (no UI)

### Step 2.1: Pure timer state machine
PRD 8. **The most important tested module in the project.**
- **File:** new `src/utils/boxingTimer.ts`; test `src/__tests__/boxingTimer.test.ts`.
- **Model:**
  - Setup: `{ rounds, workSec, restSec, getReadySec }`.
  - Phases in order: `getReady` (skipped if 0), then `work 1, rest 1, ... , work N` (**no rest after the last round**).
  - State: `{ setup, phaseIndex, phaseEndsAt, paused: null | { remainingMs }, rounds: [{ extraSec, actualWorkSec, actualRestSec }], startedAt, done }`.
- **API (all pure, `now` is a param):** `createTimer(setup, now)`, `advance(state, now)` (catches up through **every** boundary crossed, chaining from the old `phaseEndsAt`, never from `now`, so true time is preserved; returns the new state plus a list of crossed events), `pause`, `resume`, `skipRest`, `addSeconds(30)`, `endEarly`, `remainingSec(state, now)`, `currentPhase(state)`, `warningDue(state, now)` (true once when 10s remain in a work phase).
- **Tests (must all exist):** normal run end to end; 6x3:00/1:00 totals; advance 5 minutes late lands in the right round and phase; advance past the end sets `done`; pause freezes remaining, resume restores it, paused time not counted; +30s extends current phase and is recorded; skip rest jumps to next work; skip on a work phase is a no-op; endEarly keeps completed rounds and marks the in-progress round partial; getReady 0 starts straight in work; 1-round session has no rest.
- **Done when:** all tests pass with zero React imports in the module.
- **Commit:** `feat(boxing): pure round-timer state machine with catch-up`

### Step 2.2: Boxing settings
PRD 7, 8. Mirror the pattern in `src/utils/settings.ts` (`parseSetting`, kv keys, `PRESERVED_KEYS`).
- **File:** new `src/utils/boxingSettings.ts` (or additions to `settings.ts` if it stays small; prefer a new file).
- **Keys/defaults:** `bell_enabled` (true), `warning_enabled` (true), `get_ready_sec` (10, range 0-60), `last_setup` (rounds 6, work 180, rest 60). Add all to `PRESERVED_KEYS`.
- **Tests:** garbage/missing values fall back; get-ready is clamped to 0-60.
- **Commit:** `feat(boxing): separate boxing timer settings storage`

### Step 2.3: Sound/haptic cue util
Implements the choice from Step 0.2.
- **File:** new `src/utils/boxingCues.ts`.
- **API:** `cues.roundStart()`, `cues.roundEnd()`, `cues.warning()` (clapper + haptic), each respecting `bell_enabled` / `warning_enabled` and the global haptics flag via `src/utils/haptics.ts` (extend `haptics` with whatever new pattern is needed rather than calling `expo-haptics` directly).
- **Do not** add a dependency unless the user approved it in 0.2. If one was approved, also update `package.json` via `npx expo install`.
- **Commit:** `feat(boxing): bell, warning and haptic cue helpers`

### Step 2.4: Active-boxing snapshot
PRD 8, 16.
- **File:** new `src/utils/boxingSnapshot.ts`; tests.
- **Shape:** `{ kind: 'boxing', v: 1, timer: TimerState, roundLog: { rpe, focusTags, focusNote }[], tagsDraft }`. `loadSnapshot()` returns null for malformed JSON, wrong `kind`, or wrong `v`.
- **Tests:** round-trip; a lifting snapshot string is rejected; corrupt string returns null.
- **Commit:** `feat(boxing): versioned active-session snapshot`

---

## Phase 3: Start flow

### Step 3.1: Start picker on Train
PRD 5, 7. Read `app/(tabs)/train.tsx` and `useWorkoutSession.ts` first.
- **Do:** replace the single "Start Empty Workout" entry with a Start button that opens a small sheet/modal: **Lift** / **Box** (reuse an existing sheet pattern such as `LocationSheet`). Lift behaves exactly as today. Box navigates to `/boxing/setup` (route created in 3.2; use a stub screen if needed). Existing "discard in-progress workout" confirmation applies to **both** types (a boxing snapshot counts as in-progress).
- **Manual check:** Lift start unchanged; with a lift in progress, tapping Box asks to discard first.
- **Commit:** `feat(train): Start picker with Lift and Box`

### Step 3.2: Boxing setup screen
PRD 7.
- **Files:** `app/boxing/_layout.tsx` (Stack), `app/boxing/setup.tsx`.
- **Do:** quick chips (3:00/1:00, 2:00/0:30, plus a couple of sensible others) that fill the fields; custom inputs for rounds, work, rest (use `src/utils/numberInput.ts`), get-ready seconds (0-60, from settings). Remembers last values via `last_setup`. "Start" validates (rounds >= 1, work >= 10s), saves `last_setup`, navigates to `/boxing/session` with the setup.
- **Manual check:** values persist across launches; invalid input blocks Start.
- **Commit:** `feat(boxing): setup screen with presets and custom values`

### Step 3.3: Repeat-last-setup shortcut
- **Do:** on the Start picker, a "Repeat last: 6 x 3:00 / 1:00" row, shown only when `getLastBoxingSetup()` / saved `last_setup` exists; one tap starts the session directly (skips setup).
- **Commit:** `feat(boxing): repeat last setup shortcut`

---

## Phase 4: Timer screen

### Step 4.1: Hook and route skeleton
PRD 8. Model on `useRestTimer.ts` (wall-clock) and `useWorkoutSession.ts` (snapshot).
- **Files:** new `src/hooks/useBoxingSession.ts`, `app/boxing/session.tsx` (minimal, shows debug text).
- **Do:** hook owns `TimerState` via `boxingTimer.ts`, ticks on a ~250ms interval calling `advance`, persists the snapshot on every state change, exposes actions. Confirms the in-progress detection from Step 1.7.
- **Done when:** navigating from setup shows a ticking phase/remaining readout.
- **Commit:** `feat(boxing): session hook and route skeleton`

### Step 4.2: Timer face
PRD 8. Read `docs/UI_UX_SPEC.md` for tokens.
- **Do:** full-screen face: huge remaining clock (`formatTime` from `src/utils/time.ts`), phase label (GET READY / ROUND 3 of 6 / REST), **phase-colored background** (work vs rest vs get-ready, from existing theme tokens, readable across a room), thin progress for the whole session.
- **Manual check:** colors flip at boundaries; legible at arm's length; light and dark themes.
- **Commit:** `feat(boxing): timer face with phase colors`

### Step 4.3: Controls
- **Do:** Pause/Resume (big), Skip rest (only during rest), +30s, End early (confirm dialog; ends and goes to the finish flow, built in Step 6.1; until then navigates back with an `// TODO` that Step 6.1 removes. Keep this TODO list in the commit message).
- **Commit:** `feat(boxing): pause, skip rest, +30s and end early controls`

### Step 4.4: Cues and keep-awake
- **Do:** wire `cues.*` to timer events (round start, round end, 10s warning once per work phase); `expo-keep-awake` active while the session screen is mounted (read how other screens use it, if any).
- **Manual check (device):** bell at each boundary, warning once at 10s, screen never dims; settings toggles (Step 11.1) will gate these later, defaults apply now.
- **Commit:** `feat(boxing): bell, 10s warning and keep-awake during session`

### Step 4.5: Backgrounding catch-up and kill recovery
PRD 8, acceptance #3.
- **Do:** on `AppState` active, run `advance(state, Date.now())` and render the correct round immediately (play at most one cue, not one per missed boundary). On app launch, if a valid boxing snapshot exists, show a Resume prompt (match the lifting resume UX) that restores to the correct round via the same catch-up. If the catch-up shows the session already ended, go straight to finish.
- **Manual check (device):** lock/background for 90s mid-round, return on the right phase; force-kill, reopen, resume correctly.
- **[LOG]**
- **Commit:** `feat(boxing): background catch-up and resume after kill`

---

## Phase 5: In-session logging

### Step 5.1: RPE row and focus chips components
PRD 9.
- **Files:** new `src/components/boxing/RpeRow.tsx` (tap row 1-10), `src/components/boxing/FocusChips.tsx` (chips grouped by the four groups + optional text note).
- **Do:** presentational and controlled. Hidden chips not shown. Reuse existing chip styling if one exists in `src/components`.
- **Commit:** `feat(boxing): round RPE row and focus chip components`

### Step 5.2: Rest-time prompt and carry-over
- **Do:** during rest (and the get-ready before round 1 is skipped), show a collapsible card for the **round just finished**: RpeRow + FocusChips. Round N+1's chips are pre-selected from round N (carry-over). Nothing mandatory, no blocking. Values go into the session `roundLog` and snapshot. A small "rounds" strip lets the user tap an earlier round to edit it during the session.
- **Manual check:** skip entering anything and finish; enter on round 2 only; carry-over pre-selects.
- **Commit:** `feat(boxing): per-round RPE and focus entry with carry-over`

---

## Phase 6: Finish and recap

### Step 6.1: Finish sheet and save
PRD 9.
- **Do:** on end (natural or early): sheet asks overall RPE (optional, same row), session tags multi-select (Heavy bag, Shadowboxing, Drills, Skipping), optional notes, name (default "Morning Boxing" / "Afternoon Boxing" / "Evening Boxing" by start hour; put the helper in `src/utils/boxingNames.ts` with a test). Save via `saveBoxingSession` with `duration_seconds` from the timer's active time. Clear the snapshot. Remove the Step 4.3 TODO.
- **Tests:** name-by-hour boundaries.
- **Commit:** `feat(boxing): finish sheet and session save`

### Step 6.2: Boxing recap screen
PRD 10. Read `app/workout-complete.tsx` first; create a **separate** screen, don't branch the lift one.
- **File:** `app/boxing/complete.tsx` (+ a `src/utils/boxingRecap.ts` for the maths, tested).
- **Content:** headline (rounds, duration), RPE-per-round graph (reuse `LineChart` or a small bar row), work vs rest split, per-round focus list, comparison to the user's average ("harder than usual": compare avg RPE to average of last N boxing sessions; omit if fewer than 3 sessions).
- **Tests:** recap maths including no-RPE rounds and the under-3-sessions case.
- **Commit:** `feat(boxing): finish recap with RPE graph and comparison`

---

## Phase 7: History, calendar, streaks

### Step 7.1: History filter chips and boxing row
PRD 11. Read `app/history.tsx`.
- **Do:** chips All / Lift / Boxing at top using the `type` filter from 1.6. Boxing rows show rounds, duration, avg RPE where lift shows volume. Search box behaves sensibly under Boxing (exercise search applies to lift only; hide it or no-op there).
- **Commit:** `feat(history): All/Lift/Boxing filter and boxing rows`

### Step 7.2: Boxing detail screen
- **Do:** `app/workout/[id].tsx` routes to a boxing variant (separate component file) when `type='boxing'`: summary card (duration, rounds, avg RPE, tags), collapsed round list. No edit yet.
- **Commit:** `feat(history): boxing session detail view`

### Step 7.3: Calendar/week dots
- **Do:** find where lift days are marked (week strip on Train, any calendar in History/Stats). Add a second dot color for boxing days; a day with both shows both. This is the one new color; add a token in `src/utils/theme.ts` and note it in `UI_UX_SPEC.md` in 12.1.
- **Commit:** `feat(calendar): distinct dot for boxing days`

### Step 7.4: Streaks include boxing
PRD 11.
- **Do:** update the streak and weekly-goal-count logic in `statsQueries.ts` (the Step 1.4 comments) so any finished lift or boxing session counts. Rest days keep working as before.
- **Tests:** boxing-only day extends a streak; mixed week counts both; rest day logic unchanged.
- **Commit:** `feat(stats): boxing sessions count toward streaks`

---

## Phase 8: Editing

### Step 8.1: Full edit of finished sessions
PRD 11.
- **Do:** Edit mode on the boxing detail: change name, date/time (reuse `updateWorkoutDateTime` patterns), overall RPE, notes, tags; edit each round's RPE/focus/seconds; add and remove rounds (renumber). Add `updateBoxingSession` to `boxingQueries.ts` (transactional replace of rounds). Delete session works via existing delete path (confirm cascade).
- **Tests:** edit round-trip; remove middle round renumbers; delete cascades.
- **Commit:** `feat(boxing): edit finished sessions`

### Step 8.2: Quick-add past session
- **Do:** form (date/time, rounds, work/rest or total duration, overall RPE, tags). Entry point in the Start picker area or History menu (choose the least cluttered spot, and say where in the report). Saves through `saveBoxingSession` with generated rounds that have no RPE.
- **Tests:** generated round count/duration math.
- **Commit:** `feat(boxing): quick-add past session`

---

## Phase 9: Stats

### Step 9.1: Boxing stats queries
PRD 12.
- **Do:** in `boxingQueries.ts` (or `src/db/boxingStats.ts`): rounds per week/month, minutes per period, avg RPE trend (weekly points) matching the shapes `LineChart`/`TrendCards` already consume (read `statsQueries.ts` for the period conventions).
- **Tests:** with fixture sessions across weeks; empty DB returns empty arrays, not NaN.
- **Commit:** `feat(stats): boxing aggregate queries`

### Step 9.2: Boxing section on Stats
- **Do:** new section below the lifting sections using `SectionHeader`, `TrendCards`, `LineChart`, same period toggles. Hidden entirely until the user has at least one boxing session.
- **Commit:** `feat(stats): boxing section`

### Step 9.3: Weekly training load query
PRD 12.
- **Do:** `getWeeklyLoad()` returns `{ thisWeek, lastWeek, changePct }`. Load per session = RPE x minutes using the fallback rule in section 0 (decision #2). Lift minutes = true workout length as already computed for lifting; boxing = `duration_seconds`.
- **Tests:** overall RPE used; fallback to average round/set RPE; session with no RPE excluded; last week 0 yields `changePct = null` (no divide by zero).
- **Commit:** `feat(stats): weekly training load query`

### Step 9.4: Weekly load section
- **Do:** own section: big number plus "up 12% vs last week" (neutral wording, no good/bad judgement), "n/a" state when last week is empty.
- **Commit:** `feat(stats): weekly training load section`

---

## Phase 10: Goals

### Step 10.1: Schema, types, progress
PRD 13, decision #5.
- **Do:** migration 15: `goals.start_date INTEGER`, `goals.end_date INTEGER` (nullable). Extend `GoalType`; `createGoal` accepts dates; `getGoalProgress`/`goalFraction` handle the four boxing types within the date range (rounds/sessions/minutes = **current week's total**, clamped to the range; avg RPE = average over the range so far; `direction` `down` ceiling, `up` floor). Expired goals (past `end_date`) are shown as ended, not deleted.
- **Tests:** each of the four types, ceiling vs floor, week boundary, outside-range sessions ignored, existing lift/bodyweight goals unaffected.
- **Commit:** `feat(goals): boxing goal types with custom date ranges (migration 15)`

### Step 10.2: Create-goal UI and display
Read `src/components/train/GoalsSection.tsx`.
- **Do:** add the four types to the goal creator with a date-range picker (native-feeling control per `expo-ui`/existing patterns), render progress in the existing list, achieve/unachieve behaves like other goals.
- **Commit:** `feat(goals): create and show boxing goals on Train`

---

## Phase 11: Polish

### Step 11.1: Boxing timer settings UI
PRD 8.
- **Do:** a "Boxing timer" group in `app/settings.tsx`: bell on/off, 10s warning on/off, default get-ready (0-60). Gate `cues.*` on them (already designed in 2.3). Rest-timer settings untouched.
- **Commit:** `feat(settings): boxing timer settings`

### Step 11.2: Focus chip manager
PRD 9.
- **Do:** screen (reachable from Settings and from a "Manage" link on the chip picker): add custom chip (name + group), rename, hide/unhide. Defaults can be hidden, never deleted. Renaming a default is allowed. Queries added to `boxingQueries.ts` with tests (hide keeps old rounds' labels resolvable: `getFocusChips({includeHidden:true})` is what recap/detail use for name lookup).
- **Commit:** `feat(boxing): manage focus chips`

### Step 11.3: Readiness prompt before boxing
PRD 9.
- **Do:** after picking Box (before the timer), if no check-in exists today, show the existing readiness UI as a skippable step. Skip never blocks. Reuse `ReadinessCard` logic; don't duplicate it.
- **Commit:** `feat(boxing): optional readiness check-in before sessions`

---

## Phase 12: Close-out

### Step 12.1: Documentation
PRD 16, `DEVELOPER_DIRECTIONS.md`.
- **Do:** update `SYSTEM_ARCHITECTURE.md` (schema, migrations 13-15, snapshot keys), `UI_UX_SPEC.md` (boxing dot token, phase colors), `FEATURES_LOGGING.md` / `FEATURES_STATS_PROGRAMS.md` (boxing flow, stats, goals), `export-schema.md` (confirm v2), `README.md` feature list. Final **[LOG]** entry summarizing the boxing release. Mark PRD status "Built".
- **Commit:** `docs: document boxing across architecture, UI, features and log`

### Step 12.2: Acceptance pass and cleanup
- **Do:** walk PRD section 18 criteria 1-12 one by one. For each: pass, or fix, with evidence (test name or the manual check done). Run the full gate. Grep for leftover `TODO`/debug text from this plan. Update `FINDINGS.md` only if you find unrelated bugs (log them; don't fix).
- **Output:** a short checklist table in the report. Anything failing becomes a follow-up commit `fix(boxing): ...`.
- **Commit:** `chore(boxing): acceptance pass and cleanup`

---

## Appendix A: Manual device test script (use at 4.5, 6.2, 12.2)

1. Start Box, 3 rounds, 0:30 work, 0:15 rest, 5s get-ready. Watch full cycle: colors, bells, 10s warning, haptic.
2. Pause 20s mid-round; confirm clock froze and duration excludes it.
3. +30s during a round; skip a rest; End early in round 3 -> finish sheet shows 2 or 3 rounds correctly.
4. Background app for 60s mid-round; return on the right phase.
5. Force-kill mid-round; relaunch; resume.
6. Enter RPE on only some rounds; finish; recap renders without errors.
7. Check History (Boxing chip), calendar dot, Stats sections, streak, export JSON contains the session.
8. Lift a normal workout afterward; confirm lift stats are unchanged.

## Appendix B: Commit/step conventions

- Style matches history: `feat: ...`, `fix(...)`, `docs: ...`, `chore: ...`.
- One step per commit; if a step turns out too big, split it and add the new IDs to the tracker (`4.3a`, `4.3b`) in the same commit as the first half.
- Never amend or force-push. If a pushed step is wrong, fix forward in a new commit.
