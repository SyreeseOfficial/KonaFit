# Boxing build: decisions, issues and acceptance

Written during the unattended run of `BUILD_PLAN_BOXING.md` (all 12 phases built, gate green, one commit per step, all pushed).
Nothing here was tested on a phone: the Expo Android bundle compiles (`expo export`), and the pure logic has 190 unit tests. **Run Appendix A of the plan on a device first.**

## Decisions needed from you (ranked)

1. **D1 Sound (the one real gap).** There is no bell sound, only haptics. SDK 56 can't play OS sound IDs; it needs `expo-audio` plus one tiny bundled tone and a dev-client rebuild. Plan: say yes and I add it behind the existing `playSound()` seam in `src/utils/boxingCues.ts` (one file). See `SPIKE_BOXING_SOUNDS.md`. Until then the 10s warning is haptic only, not "clapper plus haptic".
2. **I5 Leaving the timer.** Back/swipe off the session screen doesn't stop the clock, and nothing on Train says "boxing in progress" until next launch or Start tap. Options: confirm on back, or a "Resume boxing" row on Train.
3. **I8 Calendar.** The app had no calendar or week view, so I added a Mon-Sun **week strip** on Train (blue dot lift, orange dot boxing). Want a full month calendar in History/Stats?
4. **D3 Native date picker.** Goal dates and workout dates are MM/DD/YYYY text fields (matches the existing editor). `@expo/ui` isn't installed. Add it?
5. **Stats grid totals.** "Workouts" and "Total time" in the lifetime grid are still **lift only** (streak and weekly goal include boxing). Include boxing in them?

## Issues / follow-ups (not blocking)

- **I7 Stale snapshot:** a forgotten session still offers Resume hours later and lands on the finish sheet. Consider auto-discarding snapshots older than planned length + a margin.
- **Lint:** warnings went 36 -> 37 (one new "setState in effect" style warning in the `app/workout/[id].tsx` type wrapper). No errors.
- **Lift detail** now does one extra tiny query (`getWorkoutType`) before rendering, so it shows blank for a frame.
- **No share/markdown export for boxing sessions** (JSON export includes them; CSV is lift sets only by design).
- **Rest-time logging only:** the per-round card shows during rest. There's no card during work rounds (keeps the clock big). Earlier rounds are editable from the strip during any rest, and fully after finishing.
- **Ended in get-ready** (0 rounds) offers only Discard.
- **Progress bar:** `sessionProgress` ignores where +30s was added (approximate, monotonic).
- **Single-round sessions** store rest 0 on the round, so `getLastBoxingSetup()` would report rest 0 for them. Train's "Repeat last" reads the kv `last_setup`, so it's unaffected.
- **Recap** has no "View in History" button (Done returns to Train).

## Judgment calls I made

- Step 0.2 wanted a stop-and-ask; you were away, so I took the plan's own fallback (haptics-only) and kept going.
- Step 3.1: "Box with a lift in progress asks to discard" isn't reachable (Train hides Start while a lift runs). I built the reverse: boxing running, then starting a lift/program/repeat asks to resume or discard.
- Steps 1.5+1.6 share one commit; 2.2+2.3 share one; 9.1+9.3 share one (shared fixtures/files).
- Name clash: the existing `getWeeklyLoad` (weekly lift volume) stays; mine is `getTrainingLoad` in `src/db/boxingStats.ts`.
- Pre-boxing readiness: asked once a day, skip is remembered for that day (`@konafit_boxing_readiness_skip_day`).
- Quick-add lives behind **+** in the History header.
- Edited boxing round times become the new "plan" for that round (the planned-vs-actual split is kept only for times you don't touch).
- Avg RPE everywhere = mean of a session's round RPEs, else its overall RPE.

## Acceptance (PRD section 18)

| # | Criterion | Result |
|---|---|---|
| 1 | Box from Train, set rounds/work/rest/get-ready, start | Built. Device untested |
| 2 | Phase colors, bell, 10s warning (sound + haptic), pause, skip rest, +30s, end early, screen awake | Built. **Sound missing (D1)**, haptics only. Device untested |
| 3 | Background returns to correct round; kill offers resume | Logic tested (`boxingTimer.test.ts` catch-up, snapshot tests). Device untested |
| 4 | Per-round RPE/chips during rest or after; chips carry forward | Built; carry-over tested |
| 5 | Finish asks RPE + tags, then recap (RPE graph, work/rest, focus, vs usual) | Built; recap maths tested |
| 6 | History chips, distinct dot, streaks, export | Built (dot = week strip, see I8); streak + export tested |
| 7 | Quick-add and full edit | Built; save/edit/renumber/cascade tested |
| 8 | Stats boxing section + weekly load | Built; queries tested |
| 9 | Boxing goals with date range | Built; all four types, ceiling/floor, range edges tested |
| 10 | Separate timer settings; chips add/edit/hide | Built; chip queries tested |
| 11 | Lifting data unchanged, lift stats unaffected | Tested with boxing rows present (stats, insights, history, goals) |
| 12 | Tests: migration, stats with boxing, export/wipe, timer catch-up | Present |
