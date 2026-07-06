import { useState, useEffect, useRef } from "react";
import { formatTime } from "../utils/time";

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

  return formatTime(elapsed);
}
