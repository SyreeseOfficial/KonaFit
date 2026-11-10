import { useState, useEffect, useRef, useCallback } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "expo-router";
import { haptics } from "../utils/haptics";
import { formatTime } from "../utils/time";
import { DEFAULT_REST_SECONDS, DEFAULT_REST_STEP, getDefaultRestSeconds, getRestStep } from "../utils/settings";

const MAX_REST_SECONDS = 20 * 60;

export function useRestTimer() {
  const [remaining, setRemaining] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [totalSeconds, setTotalSeconds] = useState(DEFAULT_REST_SECONDS);
  const [step, setStep] = useState(DEFAULT_REST_STEP);
  // Wall-clock end time, so backgrounding or a late tick can't make the countdown drift.
  const endTimeRef = useRef(0);
  const tickedRef = useRef(0); // last countdown second that buzzed, so a 250 ms poll buzzes once

  // Reload the Settings default on focus (Train stays mounted while Settings is open).
  // Skipped while running; the cleanup drops a late result if a run starts first.
  useFocusEffect(useCallback(() => {
    if (isRunning) return;
    let cancelled = false;
    getDefaultRestSeconds().then((s) => { if (!cancelled) setTotalSeconds(s); });
    getRestStep().then((s) => { if (!cancelled) setStep(s); });
    return () => { cancelled = true; };
  }, [isRunning]));

  const stop = useCallback(() => {
    setIsRunning(false);
    setRemaining(0);
  }, []);

  const start = useCallback((seconds?: number) => {
    const duration = Math.min(seconds ?? totalSeconds, MAX_REST_SECONDS);
    endTimeRef.current = Date.now() + duration * 1000;
    tickedRef.current = 0;
    setTotalSeconds(duration);
    setRemaining(duration);
    setIsRunning(true);
  }, [totalSeconds]);

  // +/- only makes sense while counting down, and the clock never goes past MAX_REST_SECONDS.
  const adjust = useCallback((delta: number) => {
    if (!isRunning) return;
    const now = Date.now();
    endTimeRef.current = Math.min(now + MAX_REST_SECONDS * 1000, Math.max(now, endTimeRef.current + delta * 1000));
    setRemaining(Math.ceil((endTimeRef.current - now) / 1000));
    setTotalSeconds((prev) => Math.min(MAX_REST_SECONDS, Math.max(step, prev + delta)));
  }, [isRunning, step]);

  useEffect(() => {
    if (!isRunning) return;
    const tick = () => {
      const left = Math.ceil((endTimeRef.current - Date.now()) / 1000);
      if (left <= 0) {
        if (endTimeRef.current === 0) return; // already finished (the interval and a foreground tick can both land here)
        endTimeRef.current = 0;
        setRemaining(0);
        setIsRunning(false);
        haptics.restEnd();
      } else {
        if ((left === 10 || left === 5) && tickedRef.current !== left) { tickedRef.current = left; haptics.tap(); }
        setRemaining(left);
      }
    };
    const id = setInterval(tick, 250);
    // Timers are throttled in the background; catch up the moment the app is visible again.
    const sub = AppState.addEventListener("change", (state) => { if (state === "active") tick(); });
    return () => { clearInterval(id); sub.remove(); };
  }, [isRunning]);

  return {
    remaining,
    isRunning,
    totalSeconds,
    formattedTime: formatTime(remaining),
    start,
    stop,
    adjust,
    STEP: step,
  };
}
