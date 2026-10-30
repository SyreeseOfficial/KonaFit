// Text-field model of a workout's date, time and duration, shared by the lift and boxing edit screens.
export type InfoEdits = {
  month: string; day: string; year: string;
  hour: string; minute: string; ampm: "AM" | "PM";
  durHours: string; durMins: string;
};

export function initDateEdits(startedAtSecs: number, durationSecs: number): InfoEdits {
  const d = new Date(startedAtSecs * 1000);
  let h = d.getHours();
  const ampm: "AM" | "PM" = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  const totalDurMin = Math.round(durationSecs / 60);
  return {
    month: String(d.getMonth() + 1), day: String(d.getDate()), year: String(d.getFullYear()),
    hour: String(h), minute: String(d.getMinutes()).padStart(2, "0"), ampm,
    durHours: String(Math.floor(totalDurMin / 60)), durMins: String(totalDurMin % 60),
  };
}

/** Null when any field is missing or out of range. */
export function dateEditsToTimestamp(edits: InfoEdits): { startedAt: number; durationSeconds: number } | null {
  const month = parseInt(edits.month, 10);
  const day = parseInt(edits.day, 10);
  const year = parseInt(edits.year, 10);
  let hour = parseInt(edits.hour, 10) % 12;
  if (edits.ampm === "PM") hour += 12;
  const minute = parseInt(edits.minute, 10);
  if (
    isNaN(month) || isNaN(day) || isNaN(year) || isNaN(hour) || isNaN(minute) ||
    month < 1 || month > 12 || day < 1 || day > 31 || year < 2000 || minute < 0 || minute > 59
  ) return null;
  const d = new Date(year, month - 1, day, hour, minute, 0);
  const startedAt = Math.floor(d.getTime() / 1000);
  const dH = parseInt(edits.durHours, 10) || 0;
  const dM = parseInt(edits.durMins, 10) || 0;
  return { startedAt, durationSeconds: Math.max(0, dH * 3600 + dM * 60) };
}

export type DateFields = { month: string; day: string; year: string };

export const toDateFields = (unixSecs: number): DateFields => {
  const d = new Date(unixSecs * 1000);
  return { month: String(d.getMonth() + 1), day: String(d.getDate()), year: String(d.getFullYear()) };
};

/** Unix seconds for local midnight (or 23:59:59 with `endOfDay`) of the typed date; null if it isn't a real calendar date. */
export function fromDateFields(f: DateFields, endOfDay = false): number | null {
  const month = parseInt(f.month, 10), day = parseInt(f.day, 10), year = parseInt(f.year, 10);
  if ([month, day, year].some(isNaN) || year < 2000 || year > 2100) return null;
  const d = new Date(year, month - 1, day, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0);
  return d.getMonth() === month - 1 && d.getDate() === day ? Math.floor(d.getTime() / 1000) : null; // rejects Feb 31 etc.
}
