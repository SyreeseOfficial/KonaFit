export const MAX_WEIGHT = 2000;
export const MAX_REPS = 999;
export const MIN_BODYWEIGHT = 20;
export const MAX_BODYWEIGHT = 700;

/**
 * Cleans typed decimal text: "," becomes ".", only digits and one dot survive, 2 decimals max.
 * Returns null when the value is above `max`, so the caller can ignore that keystroke.
 * `allowNegative` keeps a leading "-" (assisted bodyweight movements); `max` then bounds the magnitude.
 */
export function cleanDecimal(v: string, max: number, allowNegative = false): string | null {
  const neg = allowNegative && v.trimStart().startsWith("-");
  let s = v.replace(/,/g, ".").replace(/[^0-9.]/g, "");
  const dot = s.indexOf(".");
  if (dot >= 0) s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, "").slice(0, 2);
  if (neg) s = `-${s}`;
  return Math.abs(parseFloat(s)) > max ? null : s;
}

/** Microwave-style m:ss from digits only (number-pad has no colon): "5" -> "0:05", "300" -> "3:00". Empty when no digits. */
export function cleanClock(v: string): string {
  if (!/\d/.test(v)) return "";
  const d = v.replace(/\D/g, "").replace(/^0+/, "").slice(-4).padStart(3, "0");
  return `${d.slice(0, -2)}:${d.slice(-2)}`;
}

/** Digits only; null when above `max`. */
export function cleanInt(v: string, max: number): string | null {
  const s = v.replace(/\D/g, "");
  return parseInt(s, 10) > max ? null : s;
}
