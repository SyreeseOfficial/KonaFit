# PRD: Boxing in KonaFit

Status: Draft v1 (brainstorm complete, nothing built yet)
Owner: Syreese Delos Santos
Date: 2026-10-30
Source: two ~30-question multiple-choice interview rounds plus the owner's opening thought dump. Every decision below traces to one of them. Section 15 lists what was explicitly declined so it doesn't creep back in.

---

## 1. Background and motivation

KonaFit started as a lifting log. The owner boxes a lot and wants it in the app. The bigger shift is that KonaFit is turning into **one app for several parts of their training life** instead of one app per use case. Other activities they do:

- Sauna
- Running (including a recent marathon)
- Other cardio
- Hyrox training

For now the scope is **gym + boxing only**. Running and sauna come next (section 14). Hyrox and other cardio come "down the road".

### Owner's original thought dump (verbatim intent)

- Maybe a whole boxing tab. Or maybe not a whole tab: incorporate it into the existing stuff.
- Boxing data should be **combined in the Stats section** if possible. Lifting volume is not the same as hitting a heavy bag, "but I'm sure we can figure something out."
- The app is moving from "solely a workout app" to "an app that serves multiple purposes of my life."

## 2. Goals

1. Let the owner run a full **boxing round timer** inside KonaFit, good enough to stop using another timer app.
2. Log boxing sessions with round-level effort and focus, so progress is visible over time.
3. Show **lifting and boxing together** (one place to see the whole week), on the calendar, in History, in streaks and in a shared load number.
4. Lay a data model that makes **running, sauna and later activities cheap to add**.

### Success criteria (owner picked "all of the above", equal priority)

- The owner stops using another timer app for boxing.
- The owner can see the whole week (lifting + boxing) in one place.
- The owner can see boxing progress over time (rounds and RPE trends).

## 3. Scope

### In v1 (owner: "nothing, build all of it" from everything answered)

- Activity type on workouts (lift | boxing) and a `boxing_rounds` child table
- Start picker on the Train tab (Lift / Box)
- Boxing setup screen with quick chips + custom values
- Full boxing timer (rounds, rest, get-ready, warnings, pause, skip, +30s, end early, true-time catch-up, resume after kill)
- Per-round RPE (1-10) and focus (chips + optional text)
- Finish flow: duration, rounds, overall RPE, session tags
- Finish-screen recap with RPE graph and extras
- Quick-add form for past sessions
- Full edit of finished sessions
- History filter chips (All / Lift / Boxing)
- Calendar/week view with a distinct color dot for boxing
- Boxing section on Stats
- Weekly training load section on Stats
- Boxing goals (rounds, sessions, minutes per week, avg RPE ceiling/floor) with custom date ranges
- Separate boxing timer settings
- Custom focus chips (add, edit, hide)
- Streaks include boxing; export includes boxing; migration defaults old rows to lift
- Optional readiness prompt before boxing
- Repeat-last-setup shortcut

### Out of v1

See section 15.

## 4. User profile and context

- Single user, local-only app (Expo / React Native, SQLite). No accounts or sync.
- Boxes with **timed rounds** (e.g. 6x3 min, 1 min rest). Not class-based, not freeform, though the owner said they plan in a "mix" of loose structure and flexibility.
- Session types done: **heavy bag** and **shadowboxing / drills / skipping**.
- Sparring and mitts/pads were **not** selected, so v1 does not model them.
- Wears a **Coros watch**, but "idk if we can do anything with it" (section 15).
- Uses the app with the **screen on, always**. "I'll never use the app with the screen off." This removes any need for background audio or lock-screen timers.

## 5. Navigation and placement

- **Boxing lives inside the Train tab. No new tab.** The owner was undecided in round 1 ("not sure yet") and chose "Inside Train tab" in round 2.
- Train gets a **Start picker**: tap Start, choose Lift or Box. This replaces today's single "Start Empty Workout" entry point (`app/(tabs)/train.tsx`). Other options rejected: quick-action buttons, today's plan, recent + suggested.
- Weekly planning today is a "mix" of structure and flexibility, so no boxing scheduling or program features are added (section 15).
- App direction: **full life/fitness hub** (lifting, combat sports, cardio, recovery as equal citizens). Train keeps its name for v1; a later rename (e.g. "Activity") was offered but not chosen.

## 6. Data model

### Decision

Round 1: the owner answered "let me think". After an explanation of the tradeoff, round 2 chose **Option A: one table with a type column**.

- Add a `type` column to the existing `workouts` table: `'lift' | 'boxing'`. All existing rows migrate as **`lift`** (owner confirmed "default type = lift").
- Add a `boxing_rounds` child table, one row per round, cascade-deleting with the workout:
  - `id`, `workout_id` (FK, ON DELETE CASCADE)
  - `round_number`
  - `rpe` (1-10, nullable until entered)
  - `focus_tags` (chip ids or names), `focus_note` (optional text)
  - planned `work_seconds` and `rest_seconds`; actual seconds worked and rested if they differ
- Session-level fields (on `workouts` or a small extension): `session_tags` (multi-select: heavy bag, shadowboxing, drills, skipping), overall `rpe`, and `name`.
- New table for user focus chips: `boxing_focus_chips` (name, is_default, is_hidden, order). Seeded with the defaults in section 8.
- Why Option A: History, calendar, streaks, goals and export already read `workouts`. Boxing shows up in them with little new code, and running/sauna later become new `type` values. Option B (a separate `boxing_sessions` table) would force every screen to merge two lists.

### Existing code to audit for the new type

Because boxing sessions will be `workouts` rows **with no sets**, every query that assumes lift data must be checked or filtered by `type`. The areas that read `workouts`:

- `src/db/statsQueries.ts`, `insightQueries.ts` (volume, PRs, muscle week, counts)
- `src/db/historyQueries.ts`, `workoutQueries.ts`
- `src/db/goalQueries.ts`
- `src/db/exportJson.ts`: add `boxing_rounds` and `boxing_focus_chips` to its table list and bump `formatVersion`, per `docs/export-schema.md`
- `src/db/wipe.ts`: delete the new tables too
- `src/utils/sessionReducers.ts` and `src/hooks/useWorkoutSession.ts` (active session snapshot)
- `app/workout/[id].tsx` and `app/workout-complete.tsx`: need a boxing variant

Migration goes in the numbered migrations array in `src/db/database.ts` (next number after 12).

## 7. Start flow and timer setup

### Start picker

- Train shows Start with two choices: Lift / Box.
- If a session is already in progress, the existing "discard in-progress workout" confirmation applies to either type.
- **Repeat last boxing setup**: one-tap shortcut on the picker that starts with the previous rounds/work/rest.

### Boxing setup screen

- **Quick chips plus custom**: tap a preset such as 3:00/1:00 or 2:00/0:30, or enter your own rounds, work and rest.
- The screen **remembers the last values**.
- **Get-ready countdown** before round 1: **configurable**, 0 to 60 seconds, remembered.
- No saved templates and no boxing programs (owner: "No templates"). Chips and the repeat shortcut cover the need.
- Open-ended rounds (no fixed count) were **not** selected.

## 8. The boxing timer

Reference: `src/hooks/useRestTimer.ts` already uses wall-clock end times so backgrounding can't cause drift. The boxing timer uses the same approach.

### Behavior

- **Full boxing timer**: rounds, work, rest, get-ready, and a warning near the end of each work round.
- **Big color change** between phases (work vs rest), readable from across the room. Exact colors come from the existing theme tokens (`docs/UI_UX_SPEC.md`). Owner picked "match existing theme" for accent, so no new boxing accent color; only the calendar dot color differs.
- **Bell** at round start/end using **system sounds** (owner chose system sounds over bundled bell audio; "pick from a few bells" was not chosen).
- **10-second warning**: clapper sound **plus** haptic.
- **Haptics**: via the existing `src/utils/haptics.ts`, which respects the global haptics setting. The owner did not tick "haptic buzz" for round bells separately, but chose haptic with the 10s warning, so haptics are used there.
- **Keep screen awake** while a session runs (`expo-keep-awake`, already installed).
- **Pause and resume anywhere**; paused time is excluded from duration.
- **Live controls**: skip rest, add 30 seconds, end early.
- **Interruptions** (phone call, backgrounding): the timer keeps true time from timestamps and **catches up to the correct round** on return. It does not auto-pause.
- **Crash/kill recovery**: **resume where you were**, matching how lifting sessions already resume via the `@konafit_active_session_v1` snapshot in `src/hooks/useWorkoutSession.ts`. Boxing needs its own snapshot shape (round index, phase, phase end time, paused state, entered RPE/focus).

### Settings (separate from the lifting rest timer)

Owner chose **separate boxing timer settings**: bell on/off, 10-second warning on/off, get-ready length, and similar. Inline-on-setup-screen and shared-with-rest-timer were rejected. The existing rest-timer settings stay untouched (`src/utils/settings.ts`).

## 9. Logging during and after a session

### During a session (owner picked: round timer, per-round notes/focus, per-round RPE)

- **Per-round RPE**: **1-10 tap row**, same scale as lifting RPE. Easy/Medium/Hard/Max and slider were rejected.
- **Per-round focus**: **tag chips plus optional text**.
- **Carry-over**: each new round **pre-selects the previous round's chips**; tap only to change.
- **Entry timing**: **either**. An optional prompt appears during rest, and everything stays editable afterward. Nothing is mandatory.
- Punch counting was not selected and is not in v1.

### Default focus chips (all four groups were selected)

| Group | Chips |
|---|---|
| Punches | Jab, Cross, Hooks, Uppercuts |
| Movement | Footwork, Head movement, Defense |
| Intent | Power, Speed, Endurance |
| Technical | Combos, Counters, Body shots |

- **User-managed chips**: add, edit and hide (examples the owner saw: "slip", "body shots"). Defaults are seeded and can be hidden, not hard-deleted, so old rounds keep their labels.

### After a session (owner picked: duration + rounds, overall RPE, what you worked on)

- **Total duration and rounds**: taken automatically from the timer.
- **Overall RPE** (how it felt), with an optional note.
- **Session tags, multi-select at finish**: Heavy bag, Shadowboxing, Drills, Skipping. These answer "what you worked on" at the session level. (Per-round chips are the finer-grained version.)
- Photo/video link was not selected.

### Naming

Sessions are named by **time of day** by default ("Morning Boxing", "Evening Boxing"), editable. This mirrors today's `workouts.name` default of "Workout".

### Readiness

The daily readiness check-in (sleep, soreness, mood; `readiness_checkins` table, `ReadinessCard` on Stats) is shown as an **optional, skippable prompt** before boxing. It's still once per day regardless of activity.

## 10. Finish-screen recap

Owner: "I like number 2 [round recap with RPE graph] but want to add more if possible."

- **RPE-per-round graph** (the base).
- **Work vs rest time split**.
- **Per-round focus list** (each round's chips/notes under the graph).
- **Comparison to your average** (e.g. "harder than your usual session").
- Week progress vs goal was **not** selected for the recap. Weekly goals still show on the Train tab.
- Boxing needs its own variant of the finish screen (`app/workout-complete.tsx` today assumes lifting data). The "same as lifting finish screen" option was not chosen.

## 11. History, calendar and streaks

### History

- Boxing sessions appear in the same History list with a boxing row showing **rounds, duration, avg RPE** in place of lift volume.
- Round 2 answered both "Separate boxing filter tab" and "Chips: All, Lift, Boxing". These are treated as one feature: **filter chips at the top: All / Lift / Boxing**. (Flagged in the conversation; confirm if a literal separate tab was intended.)
- Detail view for a finished boxing session is a **summary card** (duration, rounds, avg RPE, tags). In round 1 the owner chose "just a summary card" for the detail view over a round list. Because the owner also wants **full edit**, rounds are still reachable for editing (see below). Final presentation of the editor is left to design.
- Search-only and no-filter options were rejected.

### Editing

- **Full edit** of finished sessions: change RPE and notes, add/remove rounds, adjust tags.
- Manual **quick-add form** for past sessions (date, rounds, duration, RPE, tags). The owner picked the quick form, not the rebuild-round-by-round flow.

### Calendar / week view

- Boxing and lifting appear on the **same calendar and week**.
- Boxing uses a **different color dot** (icons and a single shared marker were rejected).
- Fatigue warnings ("heavy lift day after hard sparring") and scheduling-around-each-other were **not** selected.

### Streaks and consistency

- **Any session counts**: lift or boxing keeps the existing streak alive. No separate boxing streak in v1. See `getStreak`-style logic in `src/db/statsQueries.ts`.

## 12. Stats

### Structure

Owner picked **separate sections on the shared Stats page** (not a unified score replacing them, not a toggle). Later they also asked for a combined load tile, which is its own section. Stats ends up with:

1. Existing lifting sections (unchanged)
2. **Boxing section** (new)
3. **Weekly training load** section (new)

### Boxing section

- Metrics the owner wants: **rounds per week/month**, **time in session**, **avg RPE trend**. Sparring-round counts were not selected.
- **Same look as the lifting charts** (reuse `LineChart`, `TrendCards`, `SectionHeader`, period toggles). No new boxing-only visuals or signature chart.

### Weekly training load

- **Formula: session RPE x minutes**, summed across all activities (I picked this when the owner said "you pick"; it is the standard sRPE method, simple and works for any activity). Lifting sessions use their overall session RPE and duration; boxing uses the overall session RPE and duration.
- **Lives in its own section** on Stats (not top of Stats, not the Train header).
- **Shows a number plus change vs last week** (e.g. "840, up 12%"). The stacked bar and 8-week line were not selected.
- Sessions without an overall RPE need a defined fallback (open question, section 17).

## 13. Goals

Owner: "custom goals similar to the Train tab." Today `GoalsSection` / `src/db/goalQueries.ts` handle `lift_pr`, `bodyweight` and `custom` goals.

- New boxing goal types (all four selected):
  - **Rounds per week**
  - **Sessions per week**
  - **Minutes per week**
  - **Average RPE ceiling or floor** (e.g. keep the average under 8)
- **Period: custom date range** (e.g. a fight camp, 8 weeks). Weekly-and-monthly was not chosen; the weekly targets are measured inside the chosen range.
- Goals appear in the existing Train goals area, with the same create/achieve behavior as other goals. This implies extending `GoalType` and the goals table.

## 14. Future direction (explicitly later, design for it now)

- **Running** and **sauna** next ("running and sauna, but down the road..."). Because activities are `workouts.type` values with type-specific child data, adding them means a new type, a new setup/logging screen and a stats section, with no rework of History, calendar, streaks, goals or export.
- **Hyrox** and **other cardio** (bike, row, ski erg, swim) after that.
- The weekly training load tile gets more useful as activities are added.
- The Start picker grows with each activity.
- The generic base-plus-extras idea (common type/date/duration/RPE/notes, plus type-specific data) is the long-term pattern.

## 15. Explicitly out of scope

Declined or not selected in the interviews:

- Own Boxing tab (rejected; inside Train)
- Combo library, guided workouts, random combo caller ("No, just logging")
- Saved templates and boxing programs
- Sparring and mitts/pads session types; sparring-round stats
- Punch counting
- Photo/video attachments
- Open-ended (no fixed count) rounds
- Background or locked-screen timer behavior
- Custom bell audio assets and a bell picker
- Fatigue/overload warnings and cross-activity scheduling
- A separate boxing streak
- Wearable integration: **Coros** is skipped for v1 (no easy open API). Manual HR/calorie fields and an import spike (Coros API, Apple Health, Strava) are possible follow-ups. No HR or calorie fields in v1.
- A unified "training load score" replacing the separate sections (the load tile is additive)
- Weekly and monthly goal periods (replaced by custom date range)

## 16. Technical notes and risks

- **Expo version**: `AGENTS.md` says Expo has changed. The versioned docs at https://docs.expo.dev/versions/v56.0.0/ must be read before writing code (current packages: `expo ~56.0.9`, `expo-haptics`, `expo-keep-awake`).
- **System sounds**: no audio package (`expo-audio`, `expo-av`) is installed. "System sounds" for the bell and clapper must be checked against SDK 56. Expo may not expose OS sound ids, and haptics alone would not match what the owner expects. Treat this as a spike before building the timer (section 17).
- **Query audit** (section 6): the largest risk is lift-only stats accidentally counting boxing rows (zero sets, zero volume) or dividing by them. Every `workouts` query needs a type filter or review, and tests in `src/__tests__/db.test.ts` should cover boxing rows.
- **Export**: bump `formatVersion`, add tables to `TABLES`, document in `docs/export-schema.md`. Old exports without `type` must still import with `lift`.
- **Active-session snapshot**: boxing needs its own serialized shape and versioned key; a lifting snapshot must not be mistaken for a boxing one.
- **Project rules**: per `docs/DEVELOPER_DIRECTIONS.md`, follow `SYSTEM_ARCHITECTURE.md`, `UI_UX_SPEC.md`, `FEATURES_*` docs, and append an entry to `UPDATE_LOG.md` for each major change. Update the feature docs when boxing ships.
- **Dev connectivity**: the Expo dev server needs `--tunnel` for the phone dev client (project memory).

## 17. Open questions

1. **System sounds**: what can SDK 56 actually play? Is an audio dependency acceptable if not? (Owner prefers no assets.)
2. **Training-load fallback** when a session has no overall RPE (lifts today log per-set RPE only; boxing overall RPE is optional). Options: skip those sessions, default to a mid value, or derive from set/round RPE.
3. **History filter**: confirm filter chips vs a literal separate tab (section 11).
4. **Detail view vs full edit**: summary card is the display, full edit is required; confirm how rounds are surfaced in the editor.
5. **Goal fit**: the avg RPE ceiling/floor and custom-range goals do not match today's `goals` table shape; decide the schema extension.
6. **Daily readiness** on days with only boxing: confirm the Stats ReadinessCard behaves the same.
7. **Default chip hiding**: should hiding a default also remove it from old rounds' display? (Proposed: no.)

## 18. Acceptance criteria (v1)

1. From Train, the owner can choose Box, pick or enter rounds/work/rest/get-ready, and start.
2. The timer runs correct rounds with phase colors, bell, 10s warning (sound plus haptic), pause, skip rest, +30s and end early, with the screen kept awake.
3. Backgrounding the app mid-session returns to the correct round; killing it offers resume.
4. Per-round RPE (1-10) and chips/text can be entered during rest or afterward; chips carry forward.
5. Finishing prompts for overall RPE and session tags, then shows the recap (RPE graph, work/rest split, focus list, comparison to average).
6. The session appears in History (with All/Lift/Boxing chips), on the calendar with a distinct dot, in streaks, and in export.
7. A past session can be added via quick-add and any finished session fully edited.
8. Stats shows a Boxing section (rounds, time, avg RPE trend) and a Weekly training load section (number, change vs last week).
9. Boxing goals (rounds, sessions, minutes, avg RPE ceiling/floor) with a custom date range work from the Train tab.
10. Boxing timer settings are separate; custom chips can be added, edited and hidden.
11. All existing lifting data is unchanged and type = lift; existing lifting stats are unaffected by boxing rows.
12. Tests cover the migration, boxing rows in stats queries, export/wipe, and the timer's catch-up logic.
