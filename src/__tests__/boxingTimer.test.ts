import { parseFlag, parseGetReady, parseLastSetup, DEFAULT_BOXING_PLAN, BOXING_PRESERVED_KEYS } from "../utils/boxingSettings";
import {
  createTimer, advance, pause, resume, skipRest, addSeconds, endEarly, remainingSec, currentPhase, warningDue,
  buildPhases, parseClock, roundResults, activeSeconds, plannedTotalSec, validateSetup, type TimerSetup,
} from "../utils/boxingTimer";
jest.mock("expo-sqlite", () => ({})); // boxingSettings -> kvStore -> database; these tests only use the pure parsers

const T0 = 1_000_000_000_000;
const S = 1000;
const std: TimerSetup = { rounds: 6, workSec: 180, restSec: 60, getReadySec: 10 };

describe("phases", () => {
  it("6x3:00/1:00 with get-ready: totals and no rest after the last round", () => {
    const p = buildPhases(std);
    expect(p).toHaveLength(1 + 6 + 5);
    expect(p[p.length - 1]).toEqual({ kind: "work", round: 6, durationSec: 180 });
    expect(plannedTotalSec(std)).toBe(10 + 6 * 180 + 5 * 60);
  });
  it("getReady 0 starts straight in work; 1-round session has no rest", () => {
    const one = { rounds: 1, workSec: 60, restSec: 30, getReadySec: 0 };
    expect(buildPhases(one)).toEqual([{ kind: "work", round: 1, durationSec: 60 }]);
    expect(currentPhase(createTimer(one, T0)).kind).toBe("work");
  });
  it("validates setups", () => {
    expect(validateSetup(std)).toBeNull();
    expect(validateSetup({ ...std, rounds: 0 })).not.toBeNull();
    expect(validateSetup({ ...std, workSec: 9 })).not.toBeNull();
    expect(validateSetup({ ...std, getReadySec: 61 })).not.toBeNull();
    expect(validateSetup({ ...std, restSec: 0 })).toBeNull();
  });
});

describe("parseClock", () => {
  it("reads m:ss and plain seconds, NaN otherwise", () => {
    expect([parseClock("3:00"), parseClock("0:30"), parseClock(" 2:5 "), parseClock("90"), parseClock("")]).toEqual([180, 30, 125, 90, NaN]);
    expect([parseClock("abc"), parseClock("1:2:3"), parseClock("-5")].every(Number.isNaN)).toBe(true);
  });
});

describe("running", () => {
  it("runs a normal session end to end with events in order", () => {
    const setup = { rounds: 2, workSec: 20, restSec: 5, getReadySec: 3 };
    let s = createTimer(setup, T0);
    expect(remainingSec(s, T0)).toBe(3);
    const kinds: string[] = [];
    for (let t = 0; !s.done && t < 100; t++) {
      const r = advance(s, T0 + t * S);
      s = r.state;
      r.events.forEach((e) => kinds.push(e.type === "phaseStart" ? `+${e.kind}${e.round}` : e.type === "phaseEnd" ? `-${e.kind}${e.round}` : e.type));
    }
    expect(kinds).toEqual([
      "-getReady0", "+work1", "warning", "-work1", "+rest1", "-rest1", "+work2", "warning", "-work2", "done",
    ]);
    expect(s.done).toBe(true);
    expect(activeSeconds(s)).toBe(2 * 20 + 5);
  });

  it("advance 5 minutes late lands in the right round and phase, chaining from the old end", () => {
    const s0 = createTimer(std, T0);
    // get-ready 10 + work1 180 + rest 60 = 250s; +300s = 300s in -> 50s into work2 (starts at 250)
    const { state, events } = advance(s0, T0 + 300 * S);
    expect(currentPhase(state)).toEqual({ kind: "work", round: 2, durationSec: 180 });
    expect(remainingSec(state, T0 + 300 * S)).toBe(130);
    expect(state.phaseEndsAt).toBe(T0 + 430 * S); // true time: not "now + 180"
    expect(events.filter((e) => e.type === "phaseStart")).toHaveLength(3);
  });

  it("advance past the end sets done once and stays done", () => {
    const { state, events } = advance(createTimer(std, T0), T0 + 99999 * S);
    expect(state.done).toBe(true);
    expect(state.endedEarly).toBe(false);
    expect(events[events.length - 1]).toEqual({ type: "done" });
    expect(advance(state, T0 + 999999 * S).events).toEqual([]);
    expect(roundResults(state)).toHaveLength(6);
  });

  it("warning fires once, at 10s left of a work phase", () => {
    let s = createTimer({ ...std, getReadySec: 0 }, T0);
    expect(warningDue(s, T0 + 169 * S)).toBe(false);
    expect(warningDue(s, T0 + 171 * S)).toBe(true);
    const a = advance(s, T0 + 171 * S);
    expect(a.events).toEqual([{ type: "warning" }]);
    s = a.state;
    expect(warningDue(s, T0 + 172 * S)).toBe(false);
    expect(advance(s, T0 + 175 * S).events).toEqual([]);
  });

  it("no warning in rest or get-ready", () => {
    const s = createTimer(std, T0);
    expect(warningDue(s, T0 + 5 * S)).toBe(false);
  });
});

describe("pause / resume", () => {
  it("pause freezes remaining, resume restores it, paused time isn't counted", () => {
    let s = createTimer({ ...std, getReadySec: 0 }, T0);
    s = pause(advance(s, T0 + 60 * S).state, T0 + 60 * S);
    expect(remainingSec(s, T0 + 60 * S)).toBe(120);
    expect(remainingSec(s, T0 + 9999 * S)).toBe(120);
    expect(advance(s, T0 + 9999 * S).events).toEqual([]);
    s = resume(s, T0 + 500 * S);
    expect(remainingSec(s, T0 + 500 * S)).toBe(120);
    const end = advance(s, T0 + 620 * S);
    expect(currentPhase(end.state).kind).toBe("rest");
    expect(end.state.rounds[0].actualWorkSec).toBe(180); // wall clock was 620s, active work is 180s
  });
  it("pause and resume are no-ops when not applicable", () => {
    const s = createTimer(std, T0);
    expect(resume(s, T0)).toBe(s);
    const p = pause(s, T0);
    expect(pause(p, T0 + S)).toBe(p);
  });
});

describe("controls", () => {
  const running = (t: number) => advance(createTimer({ ...std, getReadySec: 0 }, T0), T0 + t * S).state;

  it("+30s extends the current phase and is recorded", () => {
    let s = addSeconds(running(100));
    expect(remainingSec(s, T0 + 100 * S)).toBe(110);
    expect(s.rounds[0].extraSec).toBe(30);
    s = advance(s, T0 + 215 * S).state; // 210s of work then rest
    expect(s.rounds[0].actualWorkSec).toBe(210);
    expect(currentPhase(s).kind).toBe("rest");
    expect(s.phaseEndsAt).toBe(T0 + 270 * S);
  });
  it("+30s while paused extends the frozen remaining time", () => {
    const s = addSeconds(pause(running(100), T0 + 100 * S));
    expect(remainingSec(s, T0 + 100 * S)).toBe(110);
  });
  it("skip rest jumps to next work and records the real rest", () => {
    const inRest = running(200); // rest 1 began at 180
    expect(currentPhase(inRest).kind).toBe("rest");
    const s = skipRest(inRest, T0 + 200 * S);
    expect(currentPhase(s)).toEqual({ kind: "work", round: 2, durationSec: 180 });
    expect(s.rounds[0].actualRestSec).toBe(20);
    expect(remainingSec(s, T0 + 200 * S)).toBe(180);
  });
  it("skip on a work phase is a no-op", () => {
    const s = running(50);
    expect(skipRest(s, T0 + 50 * S)).toBe(s);
  });
  it("end early keeps completed rounds and marks the in-progress round partial", () => {
    const s = endEarly(running(180 + 60 + 100), T0 + 340 * S); // 100s into round 2
    expect(s.done).toBe(true);
    expect(s.endedEarly).toBe(true);
    const r = roundResults(s);
    expect(r.map((x) => x.round)).toEqual([1, 2]);
    expect(r[0]).toMatchObject({ actualWorkSec: 180, actualRestSec: 60, partial: false });
    expect(r[1]).toMatchObject({ actualWorkSec: 100, partial: true });
    expect(activeSeconds(s)).toBe(180 + 60 + 100);
  });
  it("end early during rest: that round is complete, the next never started", () => {
    const r = roundResults(endEarly(running(200), T0 + 200 * S));
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ round: 1, actualWorkSec: 180, actualRestSec: 20, partial: false });
  });
  it("end early during get-ready saves no rounds", () => {
    const s = endEarly(createTimer(std, T0), T0 + 4 * S);
    expect(roundResults(s)).toEqual([]);
    expect(activeSeconds(s)).toBe(0);
  });
  it("actions after done change nothing", () => {
    const s = endEarly(running(10), T0 + 10 * S);
    expect(addSeconds(s)).toBe(s);
    expect(pause(s, T0)).toBe(s);
    expect(endEarly(s, T0)).toBe(s);
  });
});

describe("boxing settings parsing", () => {
  it("flags default on; only '0' turns them off", () => {
    expect([parseFlag(null), parseFlag("1"), parseFlag("junk"), parseFlag("0")]).toEqual([true, true, true, false]);
  });
  it("get-ready falls back on garbage and clamps to 0-60", () => {
    expect([parseGetReady(null), parseGetReady("abc"), parseGetReady("25"), parseGetReady("-5"), parseGetReady("999")]).toEqual([10, 10, 25, 0, 60]);
  });
  it("last setup falls back on missing, garbled or invalid values", () => {
    const good = { rounds: 3, workSec: 120, restSec: 30 };
    expect(parseLastSetup(JSON.stringify(good))).toEqual(good);
    for (const bad of [null, "{", "[]", JSON.stringify({ rounds: 0, workSec: 120, restSec: 30 }), JSON.stringify({ rounds: 3, workSec: 5, restSec: 30 })])
      expect(parseLastSetup(bad)).toEqual(DEFAULT_BOXING_PLAN);
  });
  it("all four keys are preserved on wipe", () => expect(BOXING_PRESERVED_KEYS).toHaveLength(4));
});
