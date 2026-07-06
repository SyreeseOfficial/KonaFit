import { useState, useEffect, useRef, useCallback } from "react";
import { formatTime } from "../utils/time";

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

  // Set elapsed to an exact second value — avoids stale-closure issues when
  // the caller doesn't have a reliable snapshot of current elapsed
  const setElapsed = useCallback(
    (targetSecs: number) => {
      const clamped = Math.max(0, targetSecs);
      const now = Date.now();
      setOffsetMs(now - startedAt - clamped * 1000);
      if (isPaused) {
        setFrozenSecs(clamped);
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
    setElapsed,
  };
}
