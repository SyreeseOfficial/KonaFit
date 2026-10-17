export const MAX_WEIGHT = 2000;
export const MAX_REPS = 999;
export const MIN_BODYWEIGHT = 20;
export const MAX_BODYWEIGHT = 700;

/**
 * Cleans typed decimal text: "," becomes ".", only digits and one dot survive, 2 decimals max.
 * Returns null when the value is above `max`, so the caller can ignore that keystroke.
 */
export function cleanDecimal(v: string, max: number): string | null {
  let s = v.replace(/,/g, ".").replace(/[^0-9.]/g, "");
  const dot = s.indexOf(".");
  if (dot >= 0) s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, "").slice(0, 2);
  return parseFloat(s) > max ? null : s;
}

/** Digits only; null when above `max`. */
export function cleanInt(v: string, max: number): string | null {
  const s = v.replace(/\D/g, "");
  return parseInt(s, 10) > max ? null : s;
}
