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
  { weight: 10,  color: "#DEDEDE", textColor: "#000000", label: "10",  heightPx: 36 },
  { weight: 5,   color: "#555555", textColor: "#FFFFFF", label: "5",   heightPx: 26 },
  { weight: 2.5, color: "#333333", textColor: "#A0A0A0", label: "2.5", heightPx: 18 },
];

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

export const REP_RANGES: Record<number, string> = {
  50: "12–15",
  55: "12–15",
  60: "10–12",
  65: "8–10",
  70: "6–8",
  75: "5–6",
  80: "4–5",
  85: "3–4",
  90: "2–3",
  95: "1–2",
  100: "1",
};

export const BAR_OPTIONS = [
  { label: "45 lb", weight: 45 },
  { label: "35 lb", weight: 35 },
  { label: "15 kg", weight: 33 },
] as const;
