import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Share } from "react-native";
import type { WorkoutDetail, CsvRow } from "../db/historyQueries";

// ─── Formatting helpers ───────────────────────────────────────────────────────

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

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

export function formatVolume(lbs: number): string {
  if (lbs >= 1_000_000) return `${(lbs / 1_000_000).toFixed(2)}M lbs`;
  if (lbs >= 1_000) return `${(lbs / 1_000).toFixed(1)}K lbs`;
  return `${Math.round(lbs)} lbs`;
}

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

    const workSets = ex.sets.filter((s) => !s.is_warmup);
    const warmSets = ex.sets.filter((s) => s.is_warmup);

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
      lines.push(`- Set ${s.set_number}: ${w} × ${r}${rpe}${done}`);
    });
    lines.push("");
  }

  lines.push("---");
  lines.push("_Logged with [KonaFit](https://github.com/SyreeseOfficial/KonaFit)_");
  return lines.join("\n");
}

export async function shareWorkoutMarkdown(workout: WorkoutDetail): Promise<void> {
  const markdown = buildWorkoutMarkdown(workout);
  await Share.share({
    message: markdown,
    title: `KonaFit — ${formatShortDate(workout.started_at)}`,
  });
}

// ─── PNG export (view-shot) ───────────────────────────────────────────────────

export async function shareImageFile(uri: string, filename: string): Promise<void> {
  const dest = FileSystem.cacheDirectory + filename;
  await FileSystem.copyAsync({ from: uri, to: dest });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(dest, { mimeType: "image/png", dialogTitle: "Share Workout" });
  }
}

// ─── CSV export ───────────────────────────────────────────────────────────────

const CSV_HEADERS = [
  "Date", "Time", "Duration (min)", "Workout ID",
  "Exercise", "Muscle Group",
  "Set", "Weight (lbs)", "Reps", "RPE", "Warmup", "Completed",
];

function escapeCsv(val: string | number | null): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
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
      r.set_number, r.weight_lbs, r.reps, r.rpe,
      r.is_warmup, r.is_completed,
    ].map(escapeCsv).join(","));
  }
  return lines.join("\n");
}

export async function exportCsvAndShare(rows: CsvRow[]): Promise<void> {
  if (rows.length === 0) {
    throw new Error("No workout data to export");
  }
  const csv = buildCsv(rows);
  const filename = `konafit_export_${new Date().toISOString().slice(0, 10)}.csv`;
  const path = FileSystem.cacheDirectory + filename;
  await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, {
      mimeType: "text/csv",
      dialogTitle: "Export KonaFit Data",
      UTI: "public.comma-separated-values-text",
    });
  }
}
