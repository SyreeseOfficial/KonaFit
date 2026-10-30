# 📊 FEATURES: PROGRAMS, STATS & HABIT TRACKING

This document defines the functional requirements, data views, and tracking logic for the **Programs** and **Stats** tabs within KonaFit.

---

## 📅 1. The "Programs" Tab Architecture

The Programs tab acts as the central vault for routine creation and repeatable workout architecture.

### UI Layout Components

* **Header Actions:** A minimalist uppercase title `PROGRAMS` utilizing `Anton` typography. Includes a sharp top-right Crimson Red (+) button or a prominent ghost button for "CREATE NEW PROGRAM".
* **Program Feed List:** A vertical column of cards representing saved templates.
  * **Card Anatomy:** Background surface set to Matte Charcoal (`#1F1F1F`) with a thin 1px `#4A4A4A` border. Sharp `0px` edges.
  * **Metadata Display:** Bold all-caps program title, followed by a summary line using wide letter-spacing (e.g., `5 WEEKS | 4 DAYS/WEEK`). Below, a ghosted grey string maps out the routine skeleton (e.g., `DAY A: BENCH/BACK, DAY B: SQUAT/ARMS`).

### Core Engine Requirements

* **Routine Architect Builder:** A sub-workspace allowing users to name a program, structure it into custom days (e.g., Day 1, Day 2 or Upper, Lower), add target movements from the exercise database, and set predefined target set counts and rep goals.
* **Save & Clone Logic:** Saving copies the blueprint to the `Programs`, `Program_Days`, and `Program_Exercises` tables. Tapping a program template from the main feed must provide a fast "LAUNCH WORKOUT" action that instantiates an active training session preloaded with those exercises.

---



## ⚡ 2. The "Train" Tab Persistent Hub (History & Habits)

While active tracking happens in a deep workspace view, the default state of the **Train** tab houses consistency and historical feeds.

### Top Navigation Toggle

* A flat, segmented control switch at the absolute top layout line: `[TRAIN VIEW]` | `[HISTORY VIEW]`. The active segment text turns pure white and is underscored by a sharp Crimson Red line.

### Habit Tracker Calendar (On Train View)

* **Visual Element:** Positioned directly below the primary "START EMPTY WORKOUT" action button. Renders a stark, high-density monthly matrix grid representing a calendar.
* **Consistency Dots:** Query the `Workouts` database table on boot. For any calendar date matching a logged entry, render a sharp Crimson Red marker dot or checkmark inside the day square to build a visual training streak.

### History Feed List (On History View)

* **Feed Properties:** A reverse-chronological list (newest workouts first) summarizing past sessions.
* **Expandable Summary Cards:** Each entry shows a condensed header line: Date (e.g., `MAY 16, 2026`), Title (e.g., `EMPTY WORKOUT` or `DAY A`), duration, and gym location if tagged. Tapping the card expands it with a clean smooth transition to reveal every set, weight, rep, and RPE checked off during that session. The expanded view also displays any per-set notes attached to individual sets.
* **Destructive Deletion:** Long-pressing an entry or hitting an inline context delete button prompts a destructive confirmation dialog to completely remove the entry from the database.



---

## 📊 3. The "Stats" Tab Dashboard (Analytics Engine)

The Stats tab utilizes deep local data aggregation to display progress, strength metrics, and training balance.

### Tier 1: Lifetime Stats Grid

* Rendered at the absolute top of the view using a clean, space-conscious 2x2 grid.
* Large numerical readouts styled in `JetBrains Mono` white text with ghosted grey metadata labels underneath:
  * **TOTAL LIFTED:** Cumulative calculated volume across all lifetime logged sets.
  * **WORKOUTS:** Count of total rows in the `Workouts` table.
  * **STREAK:** Rolling consecutive week or day count calculated via completion timestamps.
  * **BODYWEIGHT:** The most recent numeric value input into the bodyweight log.

### Tier 2: Performance & Data Charts

All chart components utilize a Crimson Red to transparent gradient layout line, sharp data node plots, and no rounded visual elements.

* **1RM Trajectory Graph:** A time-series line graph tracking your estimated 1-Rep Max over time for specific major compound movements. Calculated using the Epley formula on logged rows marked complete: `1RM = w × (1 + r/30)` (where `w` is weight and `r` is reps).
* **Volume Distribution Chart:** A high-contrast bar or pie graph segment displaying total target set accumulation sorted by muscle group over a rolling 7-day or 30-day window.

### Tier 3: Visual Volume Muscle Heatmap

* **Anatomical Vector Graphic:** A minimalist front and back body muscular silhouette diagram embedded directly into the view layout.
* **Heat Scaling Engine:** As the database updates, dynamically compute the total working sets hit per muscle group. Shading colors for individual muscle outlines scale fluidly along a technical gradient: un-targeted muscles remain Deep Obsidian or Matte Charcoal, shifting up to sharp Crimson Red for the heaviest hit muscle groups of the current training cycle.



---

## 📋 4. Lifestyle Metrics Engine

Tucked neatly into the daily habit loops, these lightweight parameter loggers inject data metrics straight into the daily summary files.

* **Bodyweight Log:** A fast numeric input block tracking morning scale values, plotting directly onto a tracking chart inside the Stats tab.
* **Hydration Counter:** A clean metric box with a fast step-increment button (e.g., `+250ml` or `+8oz`) to quickly log daily water intake.
* **Pre-Workout Tracker:** A small text or numeric input box allowing users to check off if pre-workout was utilized, quantified cleanly by inputting the total estimated milligrams (mg) of caffeine consumed.
* **Location Tagging Engine:** Integrates a lightweight text field or localized dropdown list to tag a workout to a specific location string (e.g., `MAIN GYM`, `HOME GYM`, `HOTEL GYM`).

---

## 📄 5. Data Portability & Share Sheets

* **Excel/CSV Export Engine:** A button inside local settings that triggers a script parsing all database tables into raw comma-separated CSV structures, packaged into an `.xlsx` format for immediate file sharing.
* **Tactical Share Sheets:** A "SHARE STATS" button inside completed or historical workout feeds. Instantly compiles the specific training metrics (Total Volume, PRs hit, Movements executed) and exports it as either:
  1. A beautifully formatted, unindented Markdown raw text string optimized for quick copying to text-based clipboards.
  2. A crisp, flat PNG image output displaying the session summary framed in the dark Obsidian / Crimson signature style.


---

## 🥊 Boxing in History, Stats and Goals

* **History:** All / Lift / Boxing chips; boxing rows show rounds, duration and average RPE. The detail screen is a summary card with a collapsed round list.
* **Week strip (Train):** Mon-Sun dots, blue for lifting, orange for boxing, both on a day with both.
* **Streaks / weekly goal:** any finished lift (with a ticked set) or boxing session counts for the day and the week.
* **Stats:** a **Boxing** section (rounds, minutes and average RPE per week or month; hidden until the first session) and a **Weekly load** section (session RPE x minutes across lifting and boxing, change vs last week, "n/a" when last week is empty). A session's RPE is its overall RPE, else the average of its set/round RPEs, else it is left out.
* **Goals:** boxing goals (rounds, sessions or minutes per week; average RPE ceiling or floor) with a start and end date.
