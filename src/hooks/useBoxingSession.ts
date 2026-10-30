import { useState, useEffect, useRef, useCallback } from "react";
import { AppState } from "react-native";
import {
  createTimer, advance as advanceTimer, cueFor, pause, resume, skipRest, addSeconds, endEarly,
  type TimerSetup, type TimerState,
} from "../utils/boxingTimer";
import { cues, loadCueSettings } from "../utils/boxingCues";
import { saveSnapshot, loadSnapshot, clearSnapshot, updateRoundLog, type RoundLogEntry } from "../utils/boxingSnapshot";

const TICK_MS = 250;

/** advance() plus the one cue its events call for. */
function advance(t: TimerState, at: number): { state: TimerState } {
  const r = advanceTimer(t, at);
  const cue = cueFor(r.events);
  if (cue) cues[cue]();
  return r;
}

const emptyLog = (rounds: number): RoundLogEntry[] =>
  Array.from({ length: rounds }, () => ({ rpe: null, focusTags: [], focusNote: "" }));

type Session = { timer: TimerState; roundLog: RoundLogEntry[]; tagsDraft: string[] };

/**
 * Thin shell over the pure timer in utils/boxingTimer: owns the state, ticks it against the wall clock, and saves a
 * snapshot on every change. Pass `newSetup` to start fresh, or null to resume the saved snapshot.
 * `status` is "none" when there was nothing to resume.
 */
export function useBoxingSession(newSetup: TimerSetup | null) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "none">("loading");
  const [now, setNow] = useState(() => Date.now());
  const ref = useRef<Session | null>(null);

  const commit = useCallback((next: Session) => {
    ref.current = next;
    setSession(next);
    saveSnapshot(next).catch(console.error);
  }, []);

  // Start fresh or restore. Runs once; the setup is fixed for the life of the screen.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let s: Session | null = null;
      if (newSetup) {
        s = { timer: createTimer(newSetup, Date.now()), roundLog: emptyLog(newSetup.rounds), tagsDraft: [] };
      } else {
        const snap = await loadSnapshot();
        if (snap) s = { timer: snap.timer, roundLog: snap.roundLog, tagsDraft: snap.tagsDraft };
      }
      if (cancelled) return;
      if (!s) return setStatus("none");
      await loadCueSettings();
      if (newSetup && s.timer.setup.getReadySec === 0) cues.roundStart(); // no get-ready: round 1 starts right now
      const t = Date.now();
      s = { ...s, timer: advance(s.timer, t).state }; // catch up if the app was away
      commit(s);
      setNow(t);
      setStatus("ready");
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const running = status === "ready" && !!session && !session.timer.done;
  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const cur = ref.current;
      if (!cur) return;
      const t = Date.now();
      const { state } = advance(cur.timer, t);
      if (state !== cur.timer) commit({ ...cur, timer: state });
      setNow(t);
    };
    const id = setInterval(tick, TICK_MS);
    // Timers are throttled in the background: catch up to the true round the moment the app is visible again.
    const sub = AppState.addEventListener("change", (s) => { if (s === "active") tick(); });
    return () => { clearInterval(id); sub.remove(); };
  }, [running, commit]);

  /** Runs a user action on the freshly caught-up timer. */
  const act = useCallback((fn: (t: TimerState, at: number) => TimerState) => {
    const cur = ref.current;
    if (!cur) return;
    const at = Date.now();
    commit({ ...cur, timer: fn(advance(cur.timer, at).state, at) });
    setNow(at);
  }, [commit]);

  const setRoundLog = useCallback((index: number, patch: Partial<RoundLogEntry>) => {
    const cur = ref.current;
    if (!cur) return;
    commit({ ...cur, roundLog: updateRoundLog(cur.roundLog, index, patch) });
  }, [commit]);

  const setTagsDraft = useCallback((tags: string[]) => {
    const cur = ref.current;
    if (cur) commit({ ...cur, tagsDraft: tags });
  }, [commit]);

  return {
    status,
    timer: session?.timer ?? null,
    roundLog: session?.roundLog ?? [],
    tagsDraft: session?.tagsDraft ?? [],
    now,
    pause: () => act(pause),
    resume: () => act(resume),
    skipRest: () => act(skipRest),
    addThirty: () => act((t) => addSeconds(t)),
    endEarly: () => act(endEarly),
    setRoundLog,
    setTagsDraft,
    /** Drops the saved copy (after saving the workout, or when the user abandons the session). */
    clear: clearSnapshot,
  };
}
