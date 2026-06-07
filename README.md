# 🖤 KINETIC

An ultra-modern, minimal, and high-performance workout tracking application built entirely for personal use. This app consolidates advanced tracking metrics, smart training calculators, and comprehensive analytics into a unified, zero-bloat system without premium paywalls.

---

## 🦅 Core Vision & Philosophy

* **Zero Paywalls, Zero Bloat:** Built strictly for personal utility. No social feeds, no video tutorials, and no heavy backend requirements.
* **Local-First Architecture:** Fast, private, and lightweight. Designed to operate completely offline using local data storage.
* **Utilitarian & Intense Aesthetic:** A high-focus, dark command-center vibe tailored for heavy lifting and progress tracking.

---

## 🛠️ System Architecture & Tech Stack

This repository utilizes a multi-file documentation context strategy to keep builds modular and highly focused.

* **Framework:** Expo (React Native) — Cross-platform iOS/Android
* **Database:** Expo SQLite — Fully local, relational, zero-backend
* **State Management:** Strict auto-save states during active training sessions to ensure zero data loss.
* **Data Portability:** Local database backed up via raw CSV/Excel export engines.

---

## 📁 Repository Context Map

When building or modifying components, refer to these specialized context files in the directory:

* 📄 **UI_UX_SPEC.md** — Defines the "Kinetic" visual design token system (Obsidian backgrounds, Crimson accents, geometric typography) and navigation layouts.
* 📄 **FEATURES_LOGGING.md** — Detailed requirements for the Active Workout workspace, exercise row layouts, ghost-text pre-filling, superset UI logic, and per-set notes.
* 📄 **FEATURES_CALCULATORS.md** — Logic, math configurations, smart rounding algorithms, and CSS/HTML proportional rendering for the Plate and Set percentage calculators.
* 📄 **FEATURES_STATS_PROGRAMS.md** — Specifications for the Program Builder, monthly Habit Calendar grid, data analytics dashboard, anatomical volume heatmaps, and export sheets.
* 📄 **SYSTEM_ARCHITECTURE.md** — Explicit coding conventions, database schemas, and state management guidelines.
* 📄 **DEVELOPER_DIRECTIONS.md** — Engineer persona, multi-file context protocol, and update logging requirements.

---

## 🚀 Key Feature Overview

### 1. The Workspace (Train)

* **Active Logger:** Track sets, reps, weight, and RPE with completion checkmarks.
* **Smart Placeholders:** Week-over-week performance automatically copies forward as light "ghost-text" placeholders.
* **Per-Set Notes:** Attach brief annotations to individual sets for form cues, difficulty spikes, or execution details.
* **Collapsible Exercises:** Hide inactive exercises during workouts to reduce visual clutter and improve focus.
* **On-the-Fly Adjustments:** A quick "Swap Exercise" button to adapt when gym machinery or equipment is occupied.
* **Auto Rest Timer:** 90-second countdown (adjustable) with vibration cue and Crimson Red flash at completion.

### 2. The Command Center (Stats)

* **Volume Heatmap:** An interactive anatomical body muscle outline that shades to Crimson Red based on historical training volume.
* **Data Visualizations:** High-contrast line graphs tracing estimated 1RM trajectories and volume streaks.
* **Habit Tracker:** A stark, minimalist calendar grid dropping visual checkmarks on active training days.
* **Lifetime Stats Grid:** Total lifted, workout count, current streak, and bodyweight tracking in `JetBrains Mono`.

### 3. Tactical Tools (Calculators)

* **Visual Plate Engine:** Instantly translates target weights into a proportional, color-coded graphic representation of an Olympic barbell sleeve.
* **Auto-Regulated Sets:** Calculate exact target intensities using percentage modifiers off historical PRs, complete with custom increment rounding (e.g., nearest 5 lbs).

### 4. Programs & Tracking

* **Program Builder:** Create repeatable workout templates with custom day structures and exercise assignments.
* **PR Summary:** Finish modal displays all new Personal Records achieved during the workout session.
* **History Feed:** Reverse-chronological log of past workouts with expandable details and per-set notes.
* **Data Export:** CSV/Excel export and tactical share sheets (Markdown + PNG image formats).

---

## 🛑 Coding Conventions for AI Contributors

1. **Read the Spec First:** Always reference the dedicated `.md` spec sheets before generating or modifying code blocks.
2. **Preserve Visual Theme:** Never deviate from the core Crimson Red (#FF0000) and Deep Obsidian (#0A0A0A) design system tokens mapped in `UI_UX_SPEC.md`.
3. **No Decorative Fluff:** Code features with high utility, minimal micro-interactions, and tight data density.
4. **Update the Log:** Every major feature or architecture change must be documented in `UPDATE_LOG.md` with date, scope, changes, and reasoning.
