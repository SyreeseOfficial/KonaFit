import { roundResults, activeSeconds, type TimerState } from "./boxingTimer";
import type { RoundLogEntry } from "./boxingSnapshot";
import type { BoxingSession } from "../types/boxing";

export type FinishInput = { name: string; rpe: number | null; tags: string[]; notes: string | null };

/**
 * Turns a finished (or ended-early) timer into the row set to save. Only rounds that started are kept. Planned seconds are
 * what the setup said (no rest after the last round); "actual" is filled only where reality differed (+30s, skipped rest, cut short).
 */
export function toBoxingSession(timer: TimerState, log: RoundLogEntry[], input: FinishInput, finishedAtMs: number): BoxingSession {
  const last = timer.setup.rounds;
  return {
    name: input.name.trim() || "Boxing",
    startedAt: Math.floor(timer.startedAt / 1000),
    finishedAt: Math.floor(finishedAtMs / 1000),
    durationSeconds: activeSeconds(timer),
    rpe: input.rpe,
    tags: input.tags,
    notes: input.notes?.trim() || null,
    rounds: roundResults(timer).map((r) => {
      const plannedRest = r.round === last ? 0 : r.plannedRestSec;
      const entry = log[r.round - 1];
      return {
        roundNumber: r.round,
        rpe: entry?.rpe ?? null,
        focusTags: entry?.focusTags ?? [],
        focusNote: entry?.focusNote.trim() || null,
        workSeconds: r.plannedWorkSec,
        restSeconds: plannedRest,
        actualWorkSeconds: r.actualWorkSec !== r.plannedWorkSec ? r.actualWorkSec : null,
        actualRestSeconds: r.actualRestSec !== plannedRest ? r.actualRestSec : null,
      };
    }),
  };
}
