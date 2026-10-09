# 🏋️ FEATURES: TRAINING LOGGER & WORKOUT WORKSPACE

This document details the functional specifications, layout behaviors, and state logic for the active training logger workspace in KonaFit. This is the primary engine of the application.

---

## 🏎️ 1. Workspace Lifecycle & Core Actions

When a user triggers "START EMPTY WORKOUT" or launches a saved program template, the app transitions into a dedicated fullscreen logging sheet that programmatically hides the main bottom navigation bar to maximize focus.

* **Session Timer:** A live, prominent upward-counting tracker rendered in `JetBrains Mono` at the top of the screen tracking duration in `MM:SS`.
* **The "Finish" Action:** A prominent Crimson Red button in the top header. Tapping it triggers a calculation of final workout metrics, updates the exercise `use_count` metrics, invalidates the stats cache, flushes the active session cache, and writes the data permanently to the `Workouts` table. **Upon completion, displays a modal summary of all PRs achieved during the workout** (e.g., "NEW PR: Bench 225 x 3", "NEW PR: Squat 315 x 5").
* **The "Discard" Action:** A clean, secondary text button in the header. Tapping it prompts an absolute confirmation warning: *"DISCARD CURRENT WORKOUT? ALL ACTIVE PROGRESS WILL BE PERMANENTLY LOST."* Confirming wipes the active state and exits without saving.



---

## 🧬 2. Dynamic Exercise Row Display

Each movement added to the active workout grid is contained within its own dedicated layout card, displaying a list of individual training sets.

### Columns Matrix

Every set row within an exercise block must be aligned in a clean, high-density table structure containing:

1. **SET #:** A static label (e.g., `1`, `2`, `3`) styled in `JetBrains Mono`.
2. **PR INDICATOR:** Displays the absolute highest historical weight lifted for that rep count.
3. **PREVIOUS SET:** Pulls the exact performance data from the last chronological session for this exercise (e.g., `225 x 5`). It acts as a baseline target.
4. **WEIGHT INPUT:** A sharp, numeric-only input block bounded by a 1px border. Defaults to `lbs`.
5. **REPS INPUT:** A sharp, numeric-only input block bounded by a 1px border.
6. **COMPLETION CHECKBOX:** A square box toggle. Clicking it changes the border color to Crimson Red (`#FF0000`), locks the inputs for that row, starts the **Rest Timer**, and logs the set state.

### Quality-of-Life State Enhancements

* **Smart "Previous Data" Copying (Ghost Text):** To minimize keyboard friction, the inputs for Weight and Reps must be pre-filled with the values from the "PREVIOUS SET" data column rendered as a faint, low-opacity placeholder string (`#353534`). Tapping the input fields allows immediate overwriting, but hitting the checkmark on an untouched row commits the placeholder data as the active log.
* **"Add Set" Control:** Appends a new set row to the bottom of the current exercise matrix, automatically duplicating the target rep scheme from the row directly preceding it.
* **Per-Set Notes:** A small, optional icon (memo/note symbol) next to each completed set row allowing users to attach brief annotations (e.g., "slow negatives", "form broke at rep 7", "RPE 8.5"). Notes are stored in the `Logged_Sets.notes` field and remain with the set data for future reference in history views. Notes field is optional and does not interrupt workflow.



---

## 🛠️ 3. Inline Context Menu & Exercise Management

Every exercise block features a small, minimalist tactical menu trigger icon (vertical dots or a small gear) that reveals a sleek dropdown overlay containing localized utility tools:

* **Collapse/Expand Exercise:** A toggle control that collapses the entire exercise card, hiding all set rows and leaving only the exercise name and a collapsed state indicator visible. This declutters the workspace during long workouts, allowing users to focus on the exercise they're actively performing. Expanded exercises display all set rows; collapsed exercises show only a summary badge (e.g., "3/5 completed").
* **Add Warm-up Sets:** Allows a user to flag a row as a warm-up set (`is_warmup = true`). Warm-up sets must visually render with a subtle gray indicator tag, color-code differently, and be automatically filtered out from strength tracking charts and estimated 1RM calculations in the Stats dashboard to avoid polluting heavy data.
* **Add Exercise Notes:** Opens a small inline plain-text input directly below the exercise name for recording specific execution details (e.g., *"Focus on slow negatives,"* *"Pin height 4"*).
* **Reorder Exercises:** Interchanges the position of whole exercise blocks within the active layout view, updating their respective `order_index` schema parameters.
* **View Movement History:** Opens an instant modal sub-layer displaying a clean timeline feed of all historical dates, weights, reps, and RPE logs recorded strictly for that specific exercise.



---

## 🔄 4. Advanced Training Modifiers

### The "Swap" Button Engine

* **The Problem:** A targeted machine or rack is occupied by another lifter in the gym, stalling the workout flow.
* **The Solution:** A prominent, tactile `SWAP` button embedded directly into the exercise card header for instant access.
* **The Logic:** Tapping it opens a quick-access modal of the exercise database with a fuzzy search interface. Selecting a replacement movement seamlessly swaps out the active exercise ID while completely retaining the existing set structure, row counts, and target rep inputs. The original movement's historical analytics remain unpolluted. This enables zero-friction exercise adaptability during live workouts.

### Superset Creator Logic

* **The Workflow:** Inside the inline context menu of an exercise, a user taps `CREATE SUPERSET`. This fires up a rapid-access fuzzy search box to find a second movement.
* **The Connection:** Once selected, the backend assigns a matching unique `superset_id` key to both items in the active tracking dictionary.
* **Visual Grouping:** The application shifts layout formatting dynamically: the individual cards fuse together inside a consolidated block highlighted by a thin, sharp Crimson Red (`#FF0000`) vertical tracking line or border running down the absolute left margin of the linked group.

---

## ⏱️ 5. Automated Rest Timer Engine

* **Trigger Matrix:** Instantly instantiates the second a user clicks the completion checkmark on any active set row.
* **Default State:** Defaults to a standard 90-second countdown, but allows manual runtime adjustment via inline increment buttons (`+30s` / `-30s`).
* **Visual Callout:** Renders as a thin, highly legible numeric ticker or countdown banner directly over the footer bar using `JetBrains Mono` typography.
* **Completion State:** Upon hitting `00:00`, the text turns flash-crimson, firing off a subtle hardware vibration pulse to signal the start of the next working set.

