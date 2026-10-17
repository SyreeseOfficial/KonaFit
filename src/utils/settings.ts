import { kvStore } from "./kvStore";

export const REST_TIMER_KEY = "@konafit_default_rest_seconds";
export const DEFAULT_REST_SECONDS = 90;
export const WEEKLY_GOAL_KEY = "@konafit_weekly_goal";
export const DEFAULT_WEEKLY_GOAL = 4;

export async function getDefaultRestSeconds(): Promise<number> {
  const raw = await kvStore.getItem(REST_TIMER_KEY);
  return raw ? parseInt(raw, 10) : DEFAULT_REST_SECONDS;
}

export async function getWeeklyGoal(): Promise<number> {
  const raw = await kvStore.getItem(WEEKLY_GOAL_KEY);
  return raw ? parseInt(raw, 10) : DEFAULT_WEEKLY_GOAL;
}
