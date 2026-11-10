// Property tests: seeded random inputs (no extra dependency), invariants must hold for every case.
jest.mock("expo-sqlite", () => ({}));
jest.mock("expo-file-system/legacy", () => ({}));
jest.mock("react-native", () => ({ Share: {}, Platform: { OS: "android" } }));

import { calculatePlates, planLoad, roundWeight, PLATES } from "../utils/plateCalc";
import { computePRBadges } from "../utils/prBadges";
import type { ActiveExercise, ActiveSet, HistPRs } from "../types/workout";

/** mulberry32: tiny deterministic PRNG so a failure reproduces. */
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const N = 500;

describe("calculatePlates / planLoad", () => {
  it("never loads more than the target, and the leftover is smaller than the smallest plate pair", () => {
    const r = rng(1);
    for (let i = 0; i < N; i++) {
      const bar = [45, 35, 33, 44, 25, 55][Math.floor(r() * 6)];
      const target = bar + Math.floor(r() * 800) * 0.5;
      const plates = PLATES.filter((p) => p.weight >= 2.5 || r() < 0.5);
      const load = planLoad(target, bar, plates);
      const smallest = Math.min(...plates.map((p) => p.weight));
      expect(load.loadedLbs).toBeLessThanOrEqual(target + 1e-9);
      expect(load.loadedLbs + load.leftoverLbs).toBeCloseTo(target, 6);
      expect(load.leftoverLbs).toBeLessThan(2 * smallest + 1e-9);
      for (const { count } of load.results ?? []) expect(count).toBeGreaterThan(0);
    }
  });

  it("is null only when the target is lighter than the bar", () => {
    const r = rng(2);
    for (let i = 0; i < N; i++) {
      const bar = 45, target = Math.floor(r() * 300);
      expect(calculatePlates(target, bar) === null).toBe(target < bar);
    }
  });
});

describe("roundWeight", () => {
  it("lands on a multiple of `nearest`, within half a step, and is idempotent", () => {
    const r = rng(3);
    for (let i = 0; i < N; i++) {
      const w = Math.round(r() * 10000) / 10;
      for (const n of [2.5, 5] as const) {
        const out = roundWeight(w, n);
        expect(Math.abs(out - w)).toBeLessThanOrEqual(n / 2 + 1e-9);
        expect(out / n).toBeCloseTo(Math.round(out / n), 9);
        expect(roundWeight(out, n)).toBe(out);
      }
      expect(roundWeight(w, 0)).toBe(w);
    }
  });
});

describe("computePRBadges", () => {
  const set = (id: string, w: number, reps: number): ActiveSet => ({
    localId: id, setNumber: 1, weightLbs: String(w), reps: String(reps), rpe: "", isWarmup: false, isCompleted: true,
  });

  it("only returns known badges; F only without history; no badges for a set below every record", () => {
    const r = rng(4);
    for (let i = 0; i < N; i++) {
      const maxWeight = 45 + Math.floor(r() * 300);
      const maxReps = 1 + Math.floor(r() * 30);
      const hasHist = r() < 0.8;
      const hist: HistPRs = hasHist
        ? { maxWeight, maxReps, maxVolume: maxWeight * maxReps, repsByWeight: [{ weight: maxWeight, reps: maxReps }] }
        : { maxWeight: null, maxReps: null, maxVolume: null, repsByWeight: [] };
      const others = Array.from({ length: Math.floor(r() * 4) }, (_, k) => set(`o${k}`, 45 + Math.floor(r() * 300), 1 + Math.floor(r() * 20)));
      const ex = { sets: others } as ActiveExercise;
      const w = 5 + Math.floor(r() * 400), reps = 1 + Math.floor(r() * 40);
      const badges = computePRBadges(ex, "new", w, reps, hist);
      for (const b of badges) expect(["W", "R", "V", "F"]).toContain(b);
      expect(new Set(badges).size).toBe(badges.length);
      if (!hasHist) expect(badges).toEqual(others.length === 0 ? ["F"] : []);
      else expect(badges).not.toContain("F");
      // Strictly heavier than every record in history and session: always a weight PR.
      if (hasHist && w > Math.max(maxWeight, ...others.map((o) => Number(o.weightLbs)))) expect(badges).toContain("W");
    }
  });

  it("a set that matches nothing beats nothing", () => {
    const hist: HistPRs = { maxWeight: 300, maxReps: 20, maxVolume: 6000, repsByWeight: [{ weight: 300, reps: 20 }] };
    const r = rng(5);
    for (let i = 0; i < N; i++) {
      const w = 1 + Math.floor(r() * 300), reps = 1 + Math.floor(r() * 20);
      expect(computePRBadges({ sets: [] } as unknown as ActiveExercise, "new", w, reps, hist)).toEqual([]);
    }
  });
});
