import { useState, useEffect, useRef, useCallback } from "react";

function formatTime(secs: number): string {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function useWorkoutTimer(startedAt: number) {
  const [isPaused, setIsPaused] = useState(false);
  // Total milliseconds spent paused (accumulated across multiple pauses)
  const [offsetMs, setOffsetMs] = useState(0);
  // Elapsed seconds frozen at the moment of pause
  const [frozenSecs, setFrozenSecs] = useState(0);
  // Drives re-renders every second when running
  const [, setTick] = useState(0);
  const pausedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (isPaused) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [isPaused]);

  const liveElapsed = Math.max(0, Math.floor((Date.now() - startedAt - offsetMs) / 1000));
  const elapsed = isPaused ? frozenSecs : liveElapsed;

  const pause = useCallback(() => {
    const now = Date.now();
    pausedAtRef.current = now;
    setFrozenSecs(Math.max(0, Math.floor((now - startedAt - offsetMs) / 1000)));
    setIsPaused(true);
  }, [startedAt, offsetMs]);

  const resume = useCallback(() => {
    if (pausedAtRef.current !== null) {
      setOffsetMs((prev) => prev + (Date.now() - pausedAtRef.current!));
      pausedAtRef.current = null;
    }
    setIsPaused(false);
  }, []);

  const reset = useCallback(() => {
    // Shift the offset so elapsed reads 0 from this moment
    setOffsetMs(Date.now() - startedAt);
    setFrozenSecs(0);
    pausedAtRef.current = null;
    setIsPaused(false);
  }, [startedAt]);

  // Positive deltaSecs = add time to timer (e.g. forgot to pause)
  // Negative deltaSecs = remove time from timer
  const adjustElapsed = useCallback(
    (deltaSecs: number) => {
      setOffsetMs((prev) => {
        const newOffset = prev - deltaSecs * 1000;
        return Math.max(-(Date.now() - startedAt), newOffset);
      });
      if (isPaused) {
        setFrozenSecs((prev) => Math.max(0, prev + deltaSecs));
      }
    },
    [isPaused, startedAt]
  );

  return {
    elapsed,
    formattedTime: formatTime(elapsed),
    isPaused,
    pause,
    resume,
    reset,
    adjustElapsed,
  };
}
