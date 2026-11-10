import { boxingName, MIN_WORK_SEC } from "./boxingTimer";
import type { BoxingSession } from "../types/boxing";

export type QuickAddInput = {
  startedAt: number; // unix seconds
  rounds: number;
  /** "plan": rounds x work/rest. "total": just a total time split evenly across the rounds, no rest. */
  mode: "plan" | "total";
  workSec: number;
  restSec: number;
  totalSec: number;
  rpe: number | null;
  tags: string[];
};

/** A finished session with generated rounds (no per-round RPE), or a message saying what's wrong. */
export function buildQuickSession(i: QuickAddInput): BoxingSession | string {
  if (!Number.isInteger(i.rounds) || i.rounds < 1 || i.rounds > 99) return "Rounds must be 1 to 99";
  const work = i.mode === "plan" ? i.workSec : Math.floor(i.totalSec / i.rounds);
  const rest = i.mode === "plan" ? i.restSec : 0;
  if (!Number.isFinite(work) || work < MIN_WORK_SEC) return i.mode === "plan" ? `Work time must be at least ${MIN_WORK_SEC}s` : "Total time is too short for that many rounds";
  if (!Number.isFinite(rest) || rest < 0) return "Rest can't be negative";
  const duration = i.rounds * work + (i.rounds - 1) * rest;
  return {
    name: boxingName(i.startedAt * 1000),
    startedAt: i.startedAt,
    finishedAt: i.startedAt + duration,
    durationSeconds: duration,
    rpe: i.rpe,
    tags: i.tags,
    notes: null,
    rounds: Array.from({ length: i.rounds }, (_, n) => ({
      roundNumber: n + 1, rpe: null, focusTags: [], focusNote: null,
      workSeconds: work, restSeconds: n === i.rounds - 1 ? 0 : rest, actualWorkSeconds: null, actualRestSeconds: null,
    })),
  };
}
