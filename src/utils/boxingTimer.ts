// Pure round-timer state machine. State in, state out; `now` (ms) is always passed in, nothing here reads a clock or imports React.
// Callers run `advance(state, now)` first on every tick/resume, then apply user actions (pause, skipRest, ...).
// Time is chained from each phase's own end (never from `now`), so a late `advance` lands on the true phase.

export type TimerSetup = { rounds: number; workSec: number; restSec: number; getReadySec: number };

export type PhaseKind = "getReady" | "work" | "rest";
export type Phase = { kind: PhaseKind; /** 1-based; 0 for get-ready */ round: number; durationSec: number };

/** Per round: seconds added with +30s, and seconds actually worked/rested (pauses excluded). */
export type RoundStat = { extraSec: number; actualWorkSec: number; actualRestSec: number };

export type TimerState = {
  setup: TimerSetup;
  phaseIndex: number;
  /** Length of the current phase including any +30s. */
  phaseTotalMs: number;
  /** When the current phase ends. Meaningless while paused. */
  phaseEndsAt: number;
  paused: null | { remainingMs: number };
  rounds: RoundStat[];
  startedAt: number;
  done: boolean;
  endedEarly: boolean;
  /** Phase index the 10s warning already fired for. */
  warnedIndex: number;
};

export type TimerEvent =
  | { type: "phaseStart"; kind: PhaseKind; round: number }
  | { type: "phaseEnd"; kind: PhaseKind; round: number }
  | { type: "warning" }
  | { type: "done" };

export const WARNING_SEC = 10;
export const ADD_SECONDS = 30;
export const MIN_WORK_SEC = 10;
export const MAX_GET_READY_SEC = 60;

/** Null when the setup can run, else a message for the setup screen. */
export function validateSetup(s: TimerSetup): string | null {
  if (!Number.isInteger(s.rounds) || s.rounds < 1) return "At least 1 round";
  if (!Number.isFinite(s.workSec) || s.workSec < MIN_WORK_SEC) return `Work time must be at least ${MIN_WORK_SEC}s`;
  if (!Number.isFinite(s.restSec) || s.restSec < 0) return "Rest can't be negative";
  if (!Number.isFinite(s.getReadySec) || s.getReadySec < 0 || s.getReadySec > MAX_GET_READY_SEC) return `Get ready must be 0 to ${MAX_GET_READY_SEC}s`;
  return null;
}

/** getReady (skipped when 0), then work 1, rest 1, ..., work N. No rest after the last round, and no zero-length rests. */
export function buildPhases(s: TimerSetup): Phase[] {
  const phases: Phase[] = [];
  if (s.getReadySec > 0) phases.push({ kind: "getReady", round: 0, durationSec: s.getReadySec });
  for (let r = 1; r <= s.rounds; r++) {
    phases.push({ kind: "work", round: r, durationSec: s.workSec });
    if (r < s.rounds && s.restSec > 0) phases.push({ kind: "rest", round: r, durationSec: s.restSec });
  }
  return phases;
}

export const plannedTotalSec = (s: TimerSetup): number => buildPhases(s).reduce((a, p) => a + p.durationSec, 0);

export function createTimer(setup: TimerSetup, now: number): TimerState {
  const first = buildPhases(setup)[0];
  return {
    setup,
    phaseIndex: 0,
    phaseTotalMs: first.durationSec * 1000,
    phaseEndsAt: now + first.durationSec * 1000,
    paused: null,
    rounds: Array.from({ length: setup.rounds }, () => ({ extraSec: 0, actualWorkSec: 0, actualRestSec: 0 })),
    startedAt: now,
    done: false,
    endedEarly: false,
    warnedIndex: -1,
  };
}

export const currentPhase = (s: TimerState): Phase => buildPhases(s.setup)[s.phaseIndex];

const remainingMs = (s: TimerState, now: number): number =>
  s.done ? 0 : Math.max(0, s.paused ? s.paused.remainingMs : s.phaseEndsAt - now);

/** Whole seconds left, rounded up so a 3:00 round shows 3:00 at the start and 0:01 until it ends. */
export const remainingSec = (s: TimerState, now: number): number => Math.ceil(remainingMs(s, now) / 1000);

/** True while a work phase (longer than the warning itself) is inside its last 10s and the warning hasn't fired yet. */
export function warningDue(s: TimerState, now: number): boolean {
  if (s.done || s.paused || s.warnedIndex === s.phaseIndex) return false;
  if (currentPhase(s).kind !== "work" || s.phaseTotalMs <= WARNING_SEC * 1000) return false;
  const left = s.phaseEndsAt - now;
  return left > 0 && left <= WARNING_SEC * 1000;
}

const withRound = (s: TimerState, round: number, patch: Partial<RoundStat>): RoundStat[] =>
  s.rounds.map((r, i) => (i === round - 1 ? { ...r, ...patch } : r));

/** Records how long the current phase really ran (`ms`) against its round. Get-ready isn't tracked. */
function recordPhase(s: TimerState, ms: number): RoundStat[] {
  const p = currentPhase(s);
  const sec = Math.round(ms / 1000);
  if (p.kind === "work") return withRound(s, p.round, { actualWorkSec: sec });
  if (p.kind === "rest") return withRound(s, p.round, { actualRestSec: sec });
  return s.rounds;
}

/** Catches up through every phase boundary crossed by `now`. Returns the new state and what happened, in order. */
export function advance(state: TimerState, now: number): { state: TimerState; events: TimerEvent[] } {
  if (state.done || state.paused) return { state, events: [] };
  let s = state;
  const events: TimerEvent[] = [];
  const phases = buildPhases(s.setup);
  while (!s.done && now >= s.phaseEndsAt) {
    const p = phases[s.phaseIndex];
    const rounds = recordPhase(s, s.phaseTotalMs);
    events.push({ type: "phaseEnd", kind: p.kind, round: p.round });
    if (s.phaseIndex === phases.length - 1) {
      s = { ...s, rounds, done: true };
      events.push({ type: "done" });
    } else {
      const next = phases[s.phaseIndex + 1];
      s = { ...s, rounds, phaseIndex: s.phaseIndex + 1, phaseTotalMs: next.durationSec * 1000, phaseEndsAt: s.phaseEndsAt + next.durationSec * 1000 };
      events.push({ type: "phaseStart", kind: next.kind, round: next.round });
    }
  }
  if (warningDue(s, now)) {
    s = { ...s, warnedIndex: s.phaseIndex };
    events.push({ type: "warning" });
  }
  return { state: s, events };
}

export function pause(state: TimerState, now: number): TimerState {
  if (state.done || state.paused) return state;
  return { ...state, paused: { remainingMs: remainingMs(state, now) } };
}

export function resume(state: TimerState, now: number): TimerState {
  if (state.done || !state.paused) return state;
  return { ...state, phaseEndsAt: now + state.paused.remainingMs, paused: null };
}

/** Only during rest: ends the rest now and starts the next round. */
export function skipRest(state: TimerState, now: number): TimerState {
  if (state.done || currentPhase(state).kind !== "rest") return state;
  const rounds = recordPhase(state, state.phaseTotalMs - remainingMs(state, now));
  const next = buildPhases(state.setup)[state.phaseIndex + 1];
  return {
    ...state, rounds, paused: null, phaseIndex: state.phaseIndex + 1,
    phaseTotalMs: next.durationSec * 1000, phaseEndsAt: now + next.durationSec * 1000,
  };
}

/** Lengthens the current phase and records the extra against its round. */
export function addSeconds(state: TimerState, sec = ADD_SECONDS): TimerState {
  if (state.done) return state;
  const p = currentPhase(state);
  const rounds = p.kind === "getReady" ? state.rounds : withRound(state, p.round, { extraSec: state.rounds[p.round - 1].extraSec + sec });
  return {
    ...state, rounds,
    phaseTotalMs: state.phaseTotalMs + sec * 1000,
    phaseEndsAt: state.phaseEndsAt + sec * 1000,
    paused: state.paused ? { remainingMs: state.paused.remainingMs + sec * 1000 } : null,
  };
}

/** Stops now. Finished rounds are kept; the phase in progress keeps the time it actually ran. */
export function endEarly(state: TimerState, now: number): TimerState {
  if (state.done) return state;
  const rounds = recordPhase(state, state.phaseTotalMs - remainingMs(state, now));
  return { ...state, rounds, paused: null, done: true, endedEarly: true };
}

export type RoundResult = {
  round: number;
  plannedWorkSec: number;
  plannedRestSec: number;
  extraSec: number;
  actualWorkSec: number;
  actualRestSec: number;
  /** Ended early inside this round's work phase. */
  partial: boolean;
};

/** The rounds that actually started, for saving. Rounds never reached are left out; a round cut short is marked partial. */
export function roundResults(state: TimerState): RoundResult[] {
  const phases = buildPhases(state.setup);
  const out: RoundResult[] = [];
  state.rounds.forEach((r, i) => {
    const round = i + 1;
    const workIdx = phases.findIndex((p) => p.kind === "work" && p.round === round);
    const reached = workIdx < state.phaseIndex || (workIdx === state.phaseIndex && (state.done || r.actualWorkSec > 0));
    if (!reached) return;
    out.push({
      round, plannedWorkSec: state.setup.workSec, plannedRestSec: state.setup.restSec, extraSec: r.extraSec,
      actualWorkSec: r.actualWorkSec, actualRestSec: r.actualRestSec,
      partial: state.endedEarly && workIdx === state.phaseIndex,
    });
  });
  return out;
}

/** Seconds actually worked + rested (pauses and get-ready excluded). */
export const activeSeconds = (state: TimerState): number =>
  state.rounds.reduce((a, r) => a + r.actualWorkSec + r.actualRestSec, 0);
