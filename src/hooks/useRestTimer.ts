import { useState, useEffect, useRef, useCallback } from "react";

const DEFAULT_SECONDS = 90;
const STEP = 30;

export function useRestTimer() {
  const [remaining, setRemaining] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [totalSeconds, setTotalSeconds] = useState(DEFAULT_SECONDS);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

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
