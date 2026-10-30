import type { ActiveSession, ActiveExercise, ActiveSet } from "../types/workout";

// Pure state transitions for an active workout session. No DB, no React: the hook calls these and persists the result.
// Untouched exercises and sets keep their object identity, so callers can diff by reference.

export const reindex = (exercises: ActiveExercise[]): ActiveExercise[] =>
  exercises.map((e, i) => ({ ...e, orderIndex: i }));

const renumber = (sets: ActiveSet[]): ActiveSet[] => sets.map((s, i) => ({ ...s, setNumber: i + 1 }));

const mapExercise = (
  session: ActiveSession,
  exerciseLocalId: string,
  fn: (e: ActiveExercise) => ActiveExercise
): ActiveSession => ({
  ...session,
  exercises: session.exercises.map((e) => (e.localId === exerciseLocalId ? fn(e) : e)),
});

/** Copy weight/reps/rpe from the last filled set into every other incomplete set. */
export function copyLastSetToAll(session: ActiveSession, exerciseLocalId: string): ActiveSession {
  return mapExercise(session, exerciseLocalId, (e) => {
    const src = [...e.sets].reverse().find((s) => (s.weightLbs !== "" || e.isBodyweight) && s.reps !== "");
    if (!src) return e;
    return {
      ...e,
      sets: e.sets.map((s) =>
        s.isCompleted || s.localId === src.localId
          ? s
          : { ...s, weightLbs: src.weightLbs, reps: src.reps, rpe: src.rpe, isGhostFilled: false }
      ),
    };
  });
}

export function toggleExerciseDone(session: ActiveSession, exerciseLocalId: string): ActiveSession {
  return mapExercise(session, exerciseLocalId, (e) => ({ ...e, isDone: !e.isDone }));
}

export function removeSet(session: ActiveSession, exerciseLocalId: string, setLocalId: string): ActiveSession {
  return mapExercise(session, exerciseLocalId, (e) => ({
    ...e,
    sets: renumber(e.sets.filter((s) => s.localId !== setLocalId)),
  }));
}

/** Put a set back at `index` (undo of removeSet). */
export function insertSet(session: ActiveSession, exerciseLocalId: string, set: ActiveSet, index: number): ActiveSession {
  return mapExercise(session, exerciseLocalId, (e) => {
    const sets = [...e.sets];
    sets.splice(Math.min(index, sets.length), 0, set);
    return { ...e, sets: renumber(sets) };
  });
}

export function removeExercise(session: ActiveSession, exerciseLocalId: string): ActiveSession {
  return { ...session, exercises: reindex(session.exercises.filter((e) => e.localId !== exerciseLocalId)) };
}

/** Put an exercise back at `index` (undo of removeExercise). */
export function insertExercise(session: ActiveSession, exercise: ActiveExercise, index: number): ActiveSession {
  const exercises = [...session.exercises];
  exercises.splice(Math.min(index, exercises.length), 0, exercise);
  return { ...session, exercises: reindex(exercises) };
}

/** Insert `exercise` right after `targetLocalId` and put both in the same superset (reusing the target's id when it has one). */
export function addSupersetAfter(
  session: ActiveSession,
  targetLocalId: string,
  exercise: ActiveExercise,
  newSupersetId: string
): ActiveSession {
  const tIdx = session.exercises.findIndex((e) => e.localId === targetLocalId);
  if (tIdx === -1) return session;
  const supersetId = session.exercises[tIdx].supersetId ?? newSupersetId;
  const exercises = [...session.exercises];
  exercises[tIdx] = { ...exercises[tIdx], supersetId };
  exercises.splice(tIdx + 1, 0, { ...exercise, supersetId });
  return { ...session, exercises: reindex(exercises) };
}

export function moveExercise(session: ActiveSession, exerciseLocalId: string, direction: "up" | "down"): ActiveSession {
  const idx = session.exercises.findIndex((e) => e.localId === exerciseLocalId);
  const newIdx = direction === "up" ? idx - 1 : idx + 1;
  if (idx === -1 || newIdx < 0 || newIdx >= session.exercises.length) return session;
  const exercises = [...session.exercises];
  [exercises[idx], exercises[newIdx]] = [exercises[newIdx], exercises[idx]];
  return { ...session, exercises: reindex(exercises) };
}

export type SwapTarget = Pick<ActiveExercise, "exerciseId" | "exerciseName" | "muscleGroup" | "ghostSets" | "histPRs" | "isBodyweight">;

/** Replace the movement but keep the sets. PR badges were earned against the old movement, so they're cleared. */
export function swapExercise(session: ActiveSession, exerciseLocalId: string, target: SwapTarget): ActiveSession {
  return mapExercise(session, exerciseLocalId, (e) => ({
    ...e,
    ...target,
    sets: e.sets.some((s) => s.prBadges) ? e.sets.map((s) => (s.prBadges ? { ...s, prBadges: undefined } : s)) : e.sets,
  }));
}
