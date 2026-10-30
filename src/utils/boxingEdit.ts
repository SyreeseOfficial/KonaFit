import { parseClock } from "./boxingTimer";
import { formatTime } from "./time";
import type { BoxingRound } from "../types/boxing";

/** A round while it is being edited: seconds are m:ss text; `orig` lets untouched times keep their planned/actual split. */
export type RoundDraft = {
  rpe: number | null;
  focusTags: number[];
  focusNote: string;
  work: string;
  rest: string;
  orig?: BoxingRound;
};

const effective = (planned: number, actual: number | null) => actual ?? planned;

export const draftFromRound = (r: BoxingRound): RoundDraft => ({
  rpe: r.rpe, focusTags: r.focusTags, focusNote: r.focusNote ?? "",
  work: formatTime(effective(r.workSeconds, r.actualWorkSeconds)),
  rest: formatTime(effective(r.restSeconds, r.actualRestSeconds)),
  orig: r,
});

/** A new round copies the previous one's times (or 3:00 / 1:00 for the first). */
export const newDraft = (prev?: RoundDraft): RoundDraft => ({
  rpe: null, focusTags: [], focusNote: "", work: prev?.work ?? "3:00", rest: prev?.rest ?? "1:00",
});

const validTime = (n: number) => Number.isFinite(n) && n >= 0;

/** Null when any time can't be read. Times the user didn't touch keep their original planned/actual values. */
export function draftToRound(d: RoundDraft, roundNumber: number): BoxingRound | null {
  const work = parseClock(d.work);
  const rest = parseClock(d.rest);
  if (!validTime(work) || !validTime(rest)) return null;
  const o = d.orig;
  const sameWork = o && effective(o.workSeconds, o.actualWorkSeconds) === work;
  const sameRest = o && effective(o.restSeconds, o.actualRestSeconds) === rest;
  return {
    roundNumber, rpe: d.rpe, focusTags: d.focusTags, focusNote: d.focusNote.trim() || null,
    workSeconds: sameWork ? o.workSeconds : work, actualWorkSeconds: sameWork ? o.actualWorkSeconds : null,
    restSeconds: sameRest ? o.restSeconds : rest, actualRestSeconds: sameRest ? o.actualRestSeconds : null,
  };
}

/** Work + rest actually spent across rounds, for the session's duration. */
export const roundsDuration = (rounds: BoxingRound[]): number =>
  rounds.reduce((a, r) => a + effective(r.workSeconds, r.actualWorkSeconds) + effective(r.restSeconds, r.actualRestSeconds), 0);
