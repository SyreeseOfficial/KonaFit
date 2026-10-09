# 🧮 FEATURES: CALCULATORS & TACTICAL TOOLS

This document defines the mathematical logic, algorithmic parameters, and visual rendering specifications for the calculation engines inside KonaFit.

---

## 🏋️ 1. The Visual Plate Calculator Engine

The Plate Calculator instantly decodes a target weight into the physical plates required per side of a standard barbell.

### Activation Triggers

* **Global Access:** Available as a dedicated utility tool in the app layout settings.
* **Inline Logger Access (Primary UX):** Triggered by tapping the tiny Crimson Red barbell icon placed directly next to the Weight input box on an active workout row. Tapping it pulls the active numeric weight from that specific row and opens the calculator popover instantly.

### The Plate-Matching Algorithm

Given a target weight W_target and a configured bar weight W_bar (default: 45 lbs):

1. Calculate the total weight required per side: W_side = (W_target - W_bar) / 2
2. Iterate through the user's active, selected **Plate Inventory** from largest to smallest, subtracting plates until W_side is zero or the remainder cannot be matched.

### Visual Proportional Rendering Spec

The popover must render a clean, high-contrast, horizontal HTML/CSS mockup representation of an Olympic barbell sleeve loaded with plates.

* **Design Constraint:** Do not use realistic imagery. Use flat, sharp CSS blocks stacked horizontally from the collar outwards.
* **Proportional Scaling:** Plates must scale vertically by height and horizontally by width according to their physical real-world size relationships (e.g., a 55 lb plate is thick and tall; a 10 lb plate is short and thin).
* **Official Olympic Color Scheme:**
  * 🔴 **Red** (#FF0000): 55 lbs / 25 kg (Tallest, thickest)
  * 🔵 **Blue** (#0044FF): 45 lbs / 20 kg (Standard Olympic height, thick)
  * 🟡 **Yellow** (#FFCC00): 35 lbs / 15 kg (Medium height, medium thickness)
  * 🟢 **Green** (#00B000): 25 lbs / 10 kg (Shorter height, medium thickness)
  * ⚪ **White** (#FFFFFF): 10 lbs / 5 kg (Short height, thin width)
  * 🔘 **Micro/Custom Plates** (2.5 lbs / 1.25 kg etc.): Styled as very small, flat grey/matte borders.

### Layout Text Strings

Directly below the visual graphic bar mockup, output a precise, uppercase string for instant readability:

```
GOAL: 175 LBS | BAR: 45 LBS | PER SIDE: 45LB x 1, 10LB x 2
```



---

## 📊 2. The Set Percentage Calculator

Designed to let users run auto-regulated percentage-based strength protocols (like 5/3/1 or heavy-intensity drop blocks) on the fly.

### UI Controls & Workflow

1. **Target Weight Field:** A manual text entry box utilizing `JetBrains Mono`.
2. **"Select Max" Fast-Trigger Button:** Positioned directly adjacent to the input field. Tapping it instantly queries the `Exercises` table, pulls the user's all-time absolute Personal Record (PR) weight for that specific movement, and autofills the target weight field.
3. **Percentage Modifiers:** A row of sharp, high-density selectable pills or quick-buttons labeled by standard training intensity thresholds: `50%`, `60%`, `70%`, `75%`, `80%`, `85%`, `90%`. Clicking a modifier instantly computes the mathematical product.
4. **Smart Rounding Toggle:** A checkbox labeled `ROUND TO CLOSEST`. When active, it references a user-definable increment variable (defaults directly to rounding to the nearest `5 lbs`).
   * *Example:* 50% of a 225 lb bench press equals 112.5 lbs. With the rounding toggle active, the calculator rounds it up immediately to `115 lbs`.
5. **"Add To Workout" Pipeline:** A prominent Crimson Red button at the base of the calculator tool. Clicking it flashes a micro-confirmation popup allowing the user to tweak the calculated weight or add target reps, then automatically pushes that completed set row straight into the live active training logger workspace.

---

## 🧮 3. Core Analytical Math Engines

These backend mathematical functions run locally off-main-thread to power the stats views without causing interface stutter.

### Estimated 1-Rep Max (1RM) Engine

KonaFit utilizes the **Epley Formula** to project max strength metrics without requiring absolute structural failure testing. Run this calculation on any completed set where reps are greater than 1:

```
1RM = w × (1 + r/30)
```

Where `w` is the logged weight, and `r` is the logged rep count.

* **Historical Mapping:** The system tracks the highest calculated value per session to plot the **1RM Trajectory Graph** within the Stats dashboard.
* **PR Detection Engine:** Upon finishing a workout, the system compares all completed sets against historical 1RM calculations for that movement. Any new maximum is flagged as a "New PR" and displayed in the workout completion summary modal.

### Total Session Training Volume

Calculated globally upon clicking "FINISH WORKOUT" to determine the work capacity payload of the session:

```
Total Volume = Σ(Weight × Reps)
```

*Constraint:* Only sets where `is_complete = true` and `is_warmup = false` are compiled into the volume metrics pool. Warm-up entries are systematically bypassed.

