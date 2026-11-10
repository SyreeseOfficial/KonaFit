import { kvStore } from "./kvStore";
import { buildPhases, validateSetup, type TimerState } from "./boxingTimer";

// Saved copy of a running boxing session, so a killed app can resume. Separate key from the lifting snapshot, and each
// carries its own shape check, so neither can be loaded as the other.
const BOXING_SNAPSHOT_KEY = "@konafit_active_boxing_v1";
const BOXING_SNAPSHOT_VERSION = 1;

/** What the user typed for a round while the timer ran. */
export type RoundLogEntry = { rpe: number | null; focusTags: number[]; focusNote: string };

export type BoxingSnapshot = {
  kind: "boxing";
  v: number;
  timer: TimerState;
  roundLog: RoundLogEntry[];
  tagsDraft: string[];
};

const sameTags = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * Applies `patch` to round `index`. If it changes the focus chips, later rounds that still hold an untouched copy of the old
 * chips follow along (so tapping round 1's chips pre-selects them for round 2, 3, ...), stopping at the first round the user
 * changed on its own.
 */
export function updateRoundLog(log: RoundLogEntry[], index: number, patch: Partial<RoundLogEntry>): RoundLogEntry[] {
  const out = log.map((e, i) => (i === index ? { ...e, ...patch } : e));
  if (!patch.focusTags) return out;
  const old = log[index].focusTags;
  for (let j = index + 1; j < out.length && sameTags(out[j].focusTags, old); j++) out[j] = { ...out[j], focusTags: patch.focusTags };
  return out;
}

export const serializeSnapshot = (s: Omit<BoxingSnapshot, "kind" | "v">): string =>
  JSON.stringify({ kind: "boxing", v: BOXING_SNAPSHOT_VERSION, ...s });

const isNum = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);

/** Null for missing/corrupt JSON, another kind (a lifting snapshot), another version, or a timer that can't be resumed. */
export function parseSnapshot(raw: string | null): BoxingSnapshot | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw);
    if (d?.kind !== "boxing" || d.v !== BOXING_SNAPSHOT_VERSION) return null;
    const t = d.timer as TimerState;
    if (!t?.setup || validateSetup(t.setup) !== null) return null;
    if (![t.phaseIndex, t.phaseTotalMs, t.phaseEndsAt, t.startedAt].every(isNum)) return null;
    if (t.phaseIndex < 0 || t.phaseIndex >= buildPhases(t.setup).length) return null;
    if (!Array.isArray(t.rounds) || t.rounds.length !== t.setup.rounds) return null;
    if (!Array.isArray(d.roundLog) || !Array.isArray(d.tagsDraft)) return null;
    return d as BoxingSnapshot;
  } catch {
    return null;
  }
}

export const saveSnapshot = (s: Omit<BoxingSnapshot, "kind" | "v">) => kvStore.setItem(BOXING_SNAPSHOT_KEY, serializeSnapshot(s));
export const clearSnapshot = () => kvStore.removeItem(BOXING_SNAPSHOT_KEY);
export async function loadSnapshot(): Promise<BoxingSnapshot | null> {
  try {
    return parseSnapshot(await kvStore.getItem(BOXING_SNAPSHOT_KEY));
  } catch {
    return null;
  }
}
