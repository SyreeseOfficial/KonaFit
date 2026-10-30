import { validateSetup, type TimerSetup } from "./boxingTimer";

/** Navigation target that starts a session with this setup. */
export const sessionHref = (s: TimerSetup) =>
  ({
    pathname: "/boxing/session",
    params: { rounds: String(s.rounds), workSec: String(s.workSec), restSec: String(s.restSec), getReadySec: String(s.getReadySec) },
  }) as never;

/** Setup from the route params, or null if they are missing or invalid. */
export function setupFromParams(p: Record<string, string | string[] | undefined>): TimerSetup | null {
  const n = (k: string) => (typeof p[k] === "string" ? parseInt(p[k] as string, 10) : NaN);
  const setup = { rounds: n("rounds"), workSec: n("workSec"), restSec: n("restSec"), getReadySec: n("getReadySec") };
  return validateSetup(setup) === null ? setup : null;
}
