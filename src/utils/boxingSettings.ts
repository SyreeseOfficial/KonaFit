import { kvStore } from "./kvStore";
import { validateSetup, MAX_GET_READY_SEC } from "./boxingTimer";
import type { BoxingPlan } from "../types/boxing";

const BOXING_BELL_KEY = "@konafit_boxing_bell_enabled";
const BOXING_WARNING_KEY = "@konafit_boxing_warning_enabled";
const BOXING_GET_READY_KEY = "@konafit_boxing_get_ready_sec";
const BOXING_LAST_SETUP_KEY = "@konafit_boxing_last_setup";

const DEFAULT_GET_READY_SEC = 10;
export const DEFAULT_BOXING_PLAN: BoxingPlan = { rounds: 6, workSec: 180, restSec: 60 };

/** Settings that survive "Wipe All Data" (pass alongside the lifting `PRESERVED_KEYS`). */
export const BOXING_PRESERVED_KEYS = [BOXING_BELL_KEY, BOXING_WARNING_KEY, BOXING_GET_READY_KEY, BOXING_LAST_SETUP_KEY];

/** On unless explicitly saved as "0". */
export const parseFlag = (raw: string | null): boolean => raw !== "0";

/** A garbled value falls back to the default; a number outside 0-60 is clamped into range. */
export function parseGetReady(raw: string | null): number {
  const n = raw == null ? NaN : parseInt(raw, 10);
  return Number.isFinite(n) ? Math.min(MAX_GET_READY_SEC, Math.max(0, n)) : DEFAULT_GET_READY_SEC;
}

/** A missing, garbled or invalid saved setup falls back to 6 x 3:00 / 1:00. */
export function parseLastSetup(raw: string | null): BoxingPlan {
  try {
    const p = JSON.parse(raw ?? "null");
    const plan = { rounds: p?.rounds, workSec: p?.workSec, restSec: p?.restSec };
    if (validateSetup({ ...plan, getReadySec: 0 }) === null) return plan;
  } catch { /* fall through */ }
  return DEFAULT_BOXING_PLAN;
}

export const getBellEnabled = async () => parseFlag(await kvStore.getItem(BOXING_BELL_KEY));
export const setBellEnabled = (v: boolean) => kvStore.setItem(BOXING_BELL_KEY, v ? "1" : "0");
export const getWarningEnabled = async () => parseFlag(await kvStore.getItem(BOXING_WARNING_KEY));
export const setWarningEnabled = (v: boolean) => kvStore.setItem(BOXING_WARNING_KEY, v ? "1" : "0");
export const getGetReadySec = async () => parseGetReady(await kvStore.getItem(BOXING_GET_READY_KEY));
export const setGetReadySec = (v: number) => kvStore.setItem(BOXING_GET_READY_KEY, String(parseGetReady(String(v))));
export const getLastSetup = async () => parseLastSetup(await kvStore.getItem(BOXING_LAST_SETUP_KEY));
/** True when the user has ever started a session (so "Repeat last" has something to repeat). */
export const hasLastSetup = async () => (await kvStore.getItem(BOXING_LAST_SETUP_KEY)) != null;
export const setLastSetup = (p: BoxingPlan) => kvStore.setItem(BOXING_LAST_SETUP_KEY, JSON.stringify(p));
