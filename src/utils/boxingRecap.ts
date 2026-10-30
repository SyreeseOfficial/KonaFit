import type { BoxingSession } from "../types/boxing";

export type Recap = {
  rounds: number;
  durationSec: number;
  /** seconds actually worked / rested, summed over rounds (actual when it differed from plan) */
  workSec: number;
  restSec: number;
  /** null when no round has an RPE and no overall RPE */
  avgRpe: number | null;
  rpePoints: { round: number; rpe: number | null }[];
  comparison: Comparison | null;
};

export type Comparison = { verdict: "harder" | "easier" | "about the same"; avgRpe: number; usualRpe: number };

/** Prior sessions needed before "harder than usual" is worth saying. */
export const MIN_PRIOR_SESSIONS = 3;
const SAME_BAND = 0.5;

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** Average round RPE, else the overall RPE, else null. The same rule the Stats trend uses. */
export const sessionAvgRpe = (roundRpes: (number | null)[], overall: number | null): number | null =>
  mean(roundRpes.filter((r): r is number => r != null)) ?? overall;

/** `priorAvgRpes` = avg RPE of the user's previous sessions (nulls allowed), newest first, already limited to the last few. */
export function buildRecap(s: BoxingSession, priorAvgRpes: (number | null)[]): Recap {
  const avgRpe = sessionAvgRpe(s.rounds.map((r) => r.rpe), s.rpe);
  const prior = priorAvgRpes.filter((x): x is number => x != null);
  const usual = prior.length >= MIN_PRIOR_SESSIONS ? mean(prior) : null;
  let comparison: Comparison | null = null;
  if (avgRpe != null && usual != null) {
    const d = avgRpe - usual;
    comparison = { verdict: d >= SAME_BAND ? "harder" : d <= -SAME_BAND ? "easier" : "about the same", avgRpe, usualRpe: usual };
  }
  return {
    rounds: s.rounds.length,
    durationSec: s.durationSeconds,
    workSec: s.rounds.reduce((a, r) => a + (r.actualWorkSeconds ?? r.workSeconds), 0),
    restSec: s.rounds.reduce((a, r) => a + (r.actualRestSeconds ?? r.restSeconds), 0),
    avgRpe,
    rpePoints: s.rounds.map((r) => ({ round: r.roundNumber, rpe: r.rpe })),
    comparison,
  };
}
