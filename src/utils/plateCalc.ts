export type PlateConfig = {
  weight: number;
  color: string;
  textColor: string;
  label: string;
  heightPx: number;
};

export const PLATES: PlateConfig[] = [
  { weight: 55,  color: "#CC0000", textColor: "#FFFFFF", label: "55",  heightPx: 72 },
  { weight: 45,  color: "#1565C0", textColor: "#FFFFFF", label: "45",  heightPx: 64 },
  { weight: 35,  color: "#E6AC00", textColor: "#000000", label: "35",  heightPx: 56 },
  { weight: 25,  color: "#2E7D32", textColor: "#FFFFFF", label: "25",  heightPx: 48 },
  { weight: 15,  color: "#6A1B9A", textColor: "#FFFFFF", label: "15",  heightPx: 42 },
  { weight: 10,  color: "#DEDEDE", textColor: "#000000", label: "10",  heightPx: 36 },
  { weight: 5,   color: "#555555", textColor: "#FFFFFF", label: "5",   heightPx: 26 },
  { weight: 2.5, color: "#333333", textColor: "#A0A0A0", label: "2.5", heightPx: 18 },
  { weight: 1.25, color: "#444444", textColor: "#A0A0A0", label: "1.25", heightPx: 14 },
];

// Not every gym stocks these, so they start disabled (toggle in Plate Config).
export const OPTIONAL_PLATES: Record<string, boolean> = { "15": false, "1.25": false };

export type PlateResult = { plate: PlateConfig; count: number };

export function calculatePlates(
  targetLbs: number,
  barLbs = 45,
  activePlates: PlateConfig[] = PLATES
): PlateResult[] | null {
  const perSide = (targetLbs - barLbs) / 2;
  if (perSide < 0) return null;
  if (perSide === 0) return [];

  // Sort by weight descending for greedy algorithm
  const sorted = [...activePlates].sort((a, b) => b.weight - a.weight);
  const results: PlateResult[] = [];
  let remaining = Math.round(perSide * 10) / 10;

  for (const plate of sorted) {
    const count = Math.floor(remaining / plate.weight + 0.0001);
    if (count > 0) {
      results.push({ plate, count });
      remaining = Math.round((remaining - count * plate.weight) * 10) / 10;
    }
  }

  return results;
}

type PlateLoad = {
  results: PlateResult[] | null; // null when the target is lighter than the bar
  loadedLbs: number;             // what actually ends up on the bar: closest loadable at or under the target
  leftoverLbs: number;           // target - loadedLbs (0 when exact)
};

/** `calculatePlates` plus what's actually loadable when the plates can't hit the target exactly. */
export function planLoad(targetLbs: number, barLbs = 45, activePlates: PlateConfig[] = PLATES): PlateLoad {
  const results = calculatePlates(targetLbs, barLbs, activePlates);
  if (!results) return { results, loadedLbs: barLbs, leftoverLbs: 0 }; // under the bar: the empty bar is the closest
  const loadedLbs = Math.round((barLbs + 2 * results.reduce((sum, r) => sum + r.plate.weight * r.count, 0)) * 100) / 100;
  return { results, loadedLbs, leftoverLbs: Math.max(0, Math.round((targetLbs - loadedLbs) * 100) / 100) };
}

// Preset colors for custom plates
export const CUSTOM_PLATE_COLORS = [
  { hex: "#7B1FA2", label: "Purple" },
  { hex: "#00838F", label: "Teal" },
  { hex: "#F57F17", label: "Amber" },
  { hex: "#263238", label: "Steel" },
  { hex: "#880E4F", label: "Pink" },
  { hex: "#1B5E20", label: "Forest" },
] as const;

export function roundWeight(weight: number, nearest: 0 | 2.5 | 5): number {
  if (nearest === 0) return weight;
  return Math.round(weight / nearest) * nearest;
}

export const PERCENTAGES = [50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100] as const;

export const BAR_OPTIONS = [
  { label: "45 lb", weight: 45 },
  { label: "35 lb", weight: 35 },
  { label: "33 lb (15 kg)", weight: 33 },
  { label: "44 lb (20 kg)", weight: 44 },
  { label: "EZ 25 lb", weight: 25 },
  { label: "Trap 55 lb", weight: 55 },
] as const;
