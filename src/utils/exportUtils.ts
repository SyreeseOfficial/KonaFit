import * as FileSystem from "expo-file-system/legacy";
import { Share, Platform } from "react-native";
import type { WorkoutDetail, CsvRow } from "../db/historyQueries";
import { localDateKey, formatTime } from "./time";
import { compactNumber } from "./format";

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
        const w = s.weight_lbs != null ? `${s.weight_lbs} lbs` : "—";
        const r = s.reps != null ? `${s.reps} reps` : "—";
        lines.push(`- W${s.set_number}: ${w} × ${r}`);
      });
      lines.push("");
    }

    workSets.forEach((s) => {
      const w = s.weight_lbs != null ? `${s.weight_lbs} lbs` : "—";
      const r = s.reps != null ? `${s.reps} reps` : "—";
      const rpe = s.rpe != null ? ` @ RPE ${s.rpe}` : "";
      const done = s.is_completed ? " ✓" : "";
      const note = s.notes ? ` — ${s.notes}` : "";
      lines.push(`- Set ${s.set_number}: ${w} × ${r}${rpe}${done}${note}`);
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
  "Set", "Weight (lbs)", "Reps", "RPE", "Notes", "Warmup", "Completed",
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
      r.set_number, r.weight_lbs, r.reps, r.rpe, r.notes,
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
