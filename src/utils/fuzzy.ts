function distance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Typo-friendly match: every query word is in `text`, or within 1 edit (2 for long words) of one of its words / a same-length prefix of one. */
export function fuzzyMatches(text: string, tokens: string[]): boolean {
  const lower = text.toLowerCase();
  const words = lower.split(/[^a-z0-9]+/).filter(Boolean);
  return tokens.every((t) => {
    if (lower.includes(t)) return true;
    if (t.length < 4) return false;
    const max = t.length >= 8 ? 2 : 1;
    return words.some((w) => distance(t, w) <= max || distance(t, w.slice(0, t.length)) <= max);
  });
}
