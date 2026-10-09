import { useState, useEffect, useRef, useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { formatTime } from "../utils/time";
import { DEFAULT_REST_SECONDS, getDefaultRestSeconds } from "../../app/settings";

const STEP = 15;

export function useRestTimer() {
  const [remaining, setRemaining] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [totalSeconds, setTotalSeconds] = useState(DEFAULT_REST_SECONDS);
  // Wall-clock end time, so backgrounding or a late tick can't make the countdown drift.
  const endTimeRef = useRef(0);

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
  }, []);

  const start = useCallback((seconds?: number) => {
    const duration = seconds ?? totalSeconds;
    endTimeRef.current = Date.now() + duration * 1000;
    setTotalSeconds(duration);
    setRemaining(duration);
    setIsRunning(true);
  }, [totalSeconds]);

  const adjust = useCallback((delta: number) => {
    endTimeRef.current = Math.max(Date.now(), endTimeRef.current + delta * 1000);
    setRemaining(Math.ceil((endTimeRef.current - Date.now()) / 1000));
    setTotalSeconds((prev) => Math.max(STEP, prev + delta));
  }, []);

  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => {
      const left = Math.ceil((endTimeRef.current - Date.now()) / 1000);
      if (left <= 0) {
        setRemaining(0);
        setIsRunning(false);
      } else {
        setRemaining(left);
      }
    }, 250);
    return () => clearInterval(id);
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
