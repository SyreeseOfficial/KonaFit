import { kvStore } from "./kvStore";

export const REST_TIMER_KEY = "@konafit_default_rest_seconds";
export const DEFAULT_REST_SECONDS = 90;
export const WEEKLY_GOAL_KEY = "@konafit_weekly_goal";
export const DEFAULT_WEEKLY_GOAL = 4;
export const REST_DAYS_KEY = "@konafit_rest_days";
export const REST_STEP_KEY = "@konafit_rest_step";
export const DEFAULT_REST_STEP = 15;
export const REST_STEP_OPTIONS = [5, 10, 15, 30];

/** Settings that survive "Wipe All Data". */
export const PRESERVED_KEYS = [REST_TIMER_KEY, WEEKLY_GOAL_KEY, REST_DAYS_KEY, REST_STEP_KEY];

/** Parse a saved integer setting; a missing, garbled or out-of-range value (NaN, 0, negative) falls back to the default. */
export function parseSetting(raw: string | null, fallback: number, min: number, max = Infinity): number {
  const n = raw == null ? NaN : parseInt(raw, 10);
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
}

export async function getDefaultRestSeconds(): Promise<number> {
  return parseSetting(await kvStore.getItem(REST_TIMER_KEY), DEFAULT_REST_SECONDS, 1);
}

export async function getWeeklyGoal(): Promise<number> {
  return parseSetting(await kvStore.getItem(WEEKLY_GOAL_KEY), DEFAULT_WEEKLY_GOAL, 1, 7);
}

/** Weekdays (0 = Sunday) the lifter plans to rest; they don't break the streak. */
export async function getRestDays(): Promise<number[]> {
  const raw = await kvStore.getItem(REST_DAYS_KEY);
  return (raw ?? "").split(",").map((d) => parseInt(d, 10)).filter((d) => d >= 0 && d <= 6);
}

/** Seconds each +/- tap moves the running rest timer. */
export async function getRestStep(): Promise<number> {
  const n = parseSetting(await kvStore.getItem(REST_STEP_KEY), DEFAULT_REST_STEP, 1);
  return REST_STEP_OPTIONS.includes(n) ? n : DEFAULT_REST_STEP;
}
