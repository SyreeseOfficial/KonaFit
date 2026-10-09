# ⚙️ SYSTEM ARCHITECTURE & TECH STACK

This document defines the technical execution, database schemas, and state management rules for the **KonaFit** application. Stick to these primitives to maintain a fast, local-first mobile environment.

---

## 🛠️ The Tech Stack

* **Framework:** Expo (React Native) — for cross-platform iOS and Android native deployment.
* **Language:** TypeScript — strict typing for exercise records, sets, and state history.
* **Styling:** NativeWind (Tailwind CSS for React Native) — utility-first styling to rapidly build the minimal, dark aesthetic.
* **Database:** Expo SQLite — a lightweight, serverless relational database operating completely local-first on the device.
* **Icons:** Lucide React Native — clean, minimalist, high-density vector icons.

---

## 🗄️ Database Schema Blueprint

The database must utilize standard relational paradigms to natively support **Supersets** and **Exercise Swapping**.

```
+-------------------+             +-------------------+
|     Workouts      |             |     Programs      |
+-------------------+             +-------------------+
| id (PK)           |             | id (PK)           |
| date              |             | name              |
| duration          |             | description       |
| gym_location      |             +---------+---------|
| notes             |                       |
+---------+---------+                       | 1:N
|                                 v
| 1:N                           +-------------------+
v                               |   Program_Days    |
+-------------------+                     +-------------------+
| Logged_Exercises  |                     | id (PK)           |
|-------------------|                     | program_id (FK)   |
| id (PK)           |                     | day_name          |
| workout_id (FK)   |                     +---------+---------|
| exercise_id (FK)  |                               |
| order_index       |                               | 1:N
| superset_id (NULL)|<-- Self-Join                  v
+---------+---------+                     +-------------------+
|                               | Program_Exercises |
| 1:N                           +-------------------+
v                               | id (PK)           |
+-------------------+                     | day_id (FK)       |
|    Logged_Sets    |                     | exercise_id (FK)  |
+-------------------+                     | sets_count        |
| id (PK)           |                     | target_reps       |
| logged_ex_id (FK) |                     +-------------------+
| set_number        |
| weight            |             +-------------------+
| reps              |             |     Exercises     |
| rpe (Nullable)    |             +-------------------+
| is_warmup (Bool)  |             | id (PK)           |
| is_complete (Bool)|             | name (Fuzzy Index)|
| notes (Nullable)  |             | muscle_group      |
+-------------------+             | equipment_type    |
                                  | use_count         |
                                  +-------------------+
```

### Key Schema Constraints

1. **Supersets:** Handled via the `superset_id` self-join foreign key in `Logged_Exercises`. If two exercises share the same `superset_id` UUID, they are rendered together as a visual block.

2. **Ghost Text Pre-filling:** Query the latest `Logged_Sets` grouped by `exercise_id` where `workout_id` is the most recent chronological date to pass previous values to the UI.

3. **Per-Set Notes:** The `notes` field in `Logged_Sets` allows users to annotate individual set performance (form cues, tempo, difficulty spikes, etc.) without cluttering the exercise-level notes.

---

## ⚡ State Management & Cache Architecture

### Active Workout Session (The Critical Rule)

* **Active State:** The active workout logger state must be decoupled from volatile component memory.
* **Local Auto-Save Trigger:** Every time a user changes a weight/rep value, checks a set completion box, adds a row, or updates notes, the active state payload must automatically write to a local cache key (`@kinetic_active_session`).
* **Session Recovery:** On application boot, the app must check for `@kinetic_active_session`. If detected, instantly prompt the user to resume their active session to prevent data loss from app background crashes.

### Analytics Caching

* **Heavy Queries:** Heavy statistical calculations (Estimated 1RM trajectories, anatomical volume heatmaps) must compute asynchronously and cache to a local JSON structure.
* **Invalidation:** Re-trigger cache computation only upon clicking "Finish Workout" or deleting a log from the history feed.

---

## 🛑 Coding & Operational Guidelines for AI

1. **Local Isolation:** Never attempt to pull external packages requiring network requests (e.g., Firebase, Supabase, external APIs) unless explicitly specified. Everything remains native to the device.

2. **Strict SQL Statements:** Write clean, optimized SQLite statements using placeholders (`?`) to prevent structural errors during batch operations.

3. **No UI Interruption:** Database updates must run off-main-thread asynchronously to ensure the rest timer and layout transitions never stutter during intense training workflows.

