import { kvStore } from "./kvStore";
import { deleteWorkout } from "../db/workoutQueries";
import * as R from "./sessionReducers";
import type { ActiveSession, ActiveSet } from "../types/workout";

const SESSION_KEY = "@konafit_active_session_v1";
// Local ids must stay unique across app restarts (a resumed session keeps its old ids), so no per-run counter.
let localIdFallback = 0;
export const uid = () =>
  `local_${globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}_${++localIdFallback}`}`;

export function defaultSet(setNumber: number): ActiveSet {
  return {
    localId: uid(),
    setNumber,
    weightLbs: "",
    reps: "",
    rpe: "",
    notes: "",
    isWarmup: false,
    isCompleted: false,
  };
}

export async function saveToStorage(session: ActiveSession | null) {
  if (session) {
    await kvStore.setItem(SESSION_KEY, R.serializeSession(session));
  } else {
    await kvStore.removeItem(SESSION_KEY);
  }
}

export async function loadCachedSession(): Promise<ActiveSession | null> {
  try {
    return R.parseSession(await kvStore.getItem(SESSION_KEY));
  } catch {
    return null;
  }
}

/** Throw away a saved session the user chose not to resume: its half-finished workout and the saved copy. */
export async function discardCachedSession(cached: ActiveSession): Promise<void> {
  await deleteWorkout(cached.workoutId);
  await saveToStorage(null);
}
