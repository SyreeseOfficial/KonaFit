import { useState, useEffect, useRef, useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { formatTime } from "../utils/time";
import { DEFAULT_REST_SECONDS, getDefaultRestSeconds } from "../../app/settings";

const STEP = 15;

export function useRestTimer() {
  const [remaining, setRemaining] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [totalSeconds, setTotalSeconds] = useState(DEFAULT_REST_SECONDS);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reload the Settings default on focus (Train stays mounted while Settings is open).
  // Skipped while running; the cleanup drops a late result if a run starts first.
  useFocusEffect(useCallback(() => {
    if (isRunning) return;
    let cancelled = false;
    getDefaultRestSeconds().then((s) => { if (!cancelled) setTotalSeconds(s); });
    return () => { cancelled = true; };
  }, [isRunning]));

  const stop = useCallback(() => {
    setIsRunning(false);
    setRemaining(0);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  const start = useCallback((seconds?: number) => {
    const duration = seconds ?? totalSeconds;
    setTotalSeconds(duration);
    setRemaining(duration);
    setIsRunning(true);
  }, [totalSeconds]);

  const adjust = useCallback((delta: number) => {
    setRemaining((prev) => Math.max(0, prev + delta));
    setTotalSeconds((prev) => Math.max(STEP, prev + delta));
  }, []);

  useEffect(() => {
    if (!isRunning) return;
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          setIsRunning(false);
          clearInterval(intervalRef.current!);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  return {
    remaining,
    isRunning,
    totalSeconds,
    formattedTime: formatTime(remaining),
    start,
    stop,
    adjust,
    STEP,
  };
}
