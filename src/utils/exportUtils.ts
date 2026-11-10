import * as FileSystem from "expo-file-system/legacy";
import { Share, Platform } from "react-native";
import type { WorkoutDetail, CsvRow, SetRecord } from "../db/historyQueries";
import { columnsFor, setSummary } from "./setFields";
import { localDateKey, formatTime } from "./time";
import { compactNumber } from "./format";
import { buildFullExport } from "../db/exportJson";

// ─── Formatting helpers ───────────────────────────────────────────────────────

export const formatDuration = formatTime;

export function formatDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatShortDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export const formatVolume = (lbs: number): string => `${compactNumber(lbs)} lbs`;

// ─── Markdown export ──────────────────────────────────────────────────────────

/** "135 lbs × 5 reps" for lifts; "1:30", "2 mi · 18:00", "250 cal" for time/distance/calories exercises. */
function setLine(s: SetRecord, targetType: string): string {
  if (!columnsFor(targetType).includes("weightLbs")) return setSummary(s, targetType);
  return `${s.weight_lbs != null ? `${s.weight_lbs} lbs` : "—"} × ${s.reps != null ? `${s.reps} reps` : "—"}`;
}

export function buildWorkoutMarkdown(workout: WorkoutDetail): string {
  const lines: string[] = [];
  lines.push(`# ${formatDate(workout.started_at)}`);
  lines.push(`**Duration:** ${formatDuration(workout.duration_seconds)}`);
  lines.push(`**Total Volume:** ${formatVolume(workout.totalVolume)}`);
  lines.push("");

  for (const ex of workout.exercises) {
    lines.push(`---`);
    lines.push(`## ${ex.exercise_name}`);
    if (ex.muscle_group) lines.push(`*${ex.muscle_group}*`);
    lines.push("");

    const warmSets = ex.sets.filter((s) => s.is_warmup);
    const workSets = ex.sets.filter((s) => !s.is_warmup);

    if (warmSets.length > 0) {
      lines.push("**Warm-up:**");
      warmSets.forEach((s) => {
        lines.push(`- W${s.set_number}: ${setLine(s, ex.target_type)}`);
      });
      lines.push("");
    }

    workSets.forEach((s) => {
      const rpe = s.rpe != null ? ` @ RPE ${s.rpe}` : "";
      const done = s.is_completed ? " ✓" : "";
      const note = s.notes ? ` — ${s.notes}` : "";
      lines.push(`- Set ${s.set_number}: ${setLine(s, ex.target_type)}${rpe}${done}${note}`);
    });
    lines.push("");
  }

  lines.push("---");
  lines.push("_Logged with KonaFit_");
  return lines.join("\n");
}

export async function shareWorkoutMarkdown(workout: WorkoutDetail): Promise<void> {
  const markdown = buildWorkoutMarkdown(workout);
  await Share.share({
    message: markdown,
    title: `KonaFit — ${formatShortDate(workout.started_at)}`,
  });
}

// ─── CSV export ───────────────────────────────────────────────────────────────

const CSV_HEADERS = [
  "Date", "Time", "Duration (min)", "Workout ID",
  "Exercise", "Muscle Group",
  "Set", "Weight (lbs)", "Reps", "Duration (sec)", "Distance (mi)", "Calories", "RPE", "Notes", "Warmup", "Completed",
];

function escapeCsv(val: string | number | null): string {
  if (val === null || val === undefined) return "";
  let str = String(val);
  // Neutralise spreadsheet formulas in user-entered text (numbers are never strings here).
  if (typeof val === "string" && /^[=+\-@\t\r]/.test(str)) str = `'${str}`;
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCsv(rows: CsvRow[]): string {
  const lines = [CSV_HEADERS.join(",")];
  for (const r of rows) {
    lines.push([
      r.date, r.time, r.duration_min, r.workout_id,
      r.exercise, r.muscle_group,
      r.set_number, r.weight_lbs, r.reps, r.duration_sec, r.distance_mi, r.calories, r.rpe, r.notes,
      r.is_warmup, r.is_completed,
    ].map(escapeCsv).join(","));
  }
  return lines.join("\n");
}

export async function exportCsvAndShare(rows: CsvRow[]): Promise<void> {
  if (rows.length === 0) throw new Error("No workout data to export");

  const csv = buildCsv(rows);
  const filename = `konafit_export_${localDateKey(new Date())}.csv`;

  // On iOS share the file directly; on Android share as text (no FileProvider needed)
  if (Platform.OS === "ios") {
    const path = (FileSystem.cacheDirectory ?? "") + filename;
    await FileSystem.writeAsStringAsync(path, csv, {
      encoding: FileSystem.EncodingType.UTF8,
    });
    await Share.share({ url: path, title: "KonaFit Export" });
  } else {
    await Share.share({ message: csv, title: "KonaFit Export" });
  }
}

/** Everything in the database as one JSON file (see docs/export-schema.md). Same sharing path as the CSV. */
export async function exportJsonAndShare(appVersion: string): Promise<void> {
  const json = JSON.stringify(await buildFullExport(appVersion), null, 2);
  if (Platform.OS === "ios") {
    const path = (FileSystem.cacheDirectory ?? "") + `konafit_full_${localDateKey(new Date())}.json`;
    await FileSystem.writeAsStringAsync(path, json, { encoding: FileSystem.EncodingType.UTF8 });
    await Share.share({ url: path, title: "KonaFit Full Export" });
  } else {
    await Share.share({ message: json, title: "KonaFit Full Export" });
  }
}
