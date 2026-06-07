import { useState, useEffect, useRef } from "react";

export function useElapsedTimer(startedAt: number | null): string {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (startedAt === null) {
      setElapsed(0);
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    const tick = () => setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    tick();
    intervalRef.current = setInterval(tick, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [startedAt]);

  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;

  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
