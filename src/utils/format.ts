/** 999950 -> "1.00M" (not "1000.0K"): round at each unit first, then pick the unit. `mDigits` is the decimals shown for millions. */
export function compactNumber(n: number, mDigits = 2): string {
  if (n >= 1_000_000 || Number((n / 1_000).toFixed(1)) >= 1_000) return `${(n / 1_000_000).toFixed(mDigits)}M`;
  if (Math.round(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}
