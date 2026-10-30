import { useState, useCallback, useRef, useEffect } from "react";
import { AppState, Alert } from "react-native";
import { useFocusEffect } from "expo-router";
import { kvStore } from "../utils/kvStore";
import { haptics } from "../utils/haptics";
import type { ActiveSession, ActiveExercise, ActiveSet } from "../types/workout";
import {
  createWorkout,
  finalizeWorkout,
  type WorkoutFeel,
  deleteWorkout,
  workoutExists,
  createLoggedExercise,
  createLoggedSet,
  upsertLoggedSet,
  deleteLoggedSet,
  getGhostSets,
  updateLoggedExerciseNotes,
  swapLoggedExercise,
  setLoggedExerciseOrder,
  deleteLoggedExercise,
  getExerciseInfo,
  updateExerciseLibraryNote,
  setLoggedExerciseSuperset,
  setExercisePerHand,
} from "../db/workoutQueries";
import { getProgramDayExercises } from "../db/programQueries";
import { getHistPRs, getLastWorkoutExercises } from "../db/historyQueries";
import { computePRBadges, isRealPR } from "../utils/prBadges";
import type { PRBadge } from "../types/workout";
import * as R from "../utils/sessionReducers";
import { warmupRamp } from "../utils/training";
import { APP_VERSION } from "../utils/appVersion";

const SESSION_KEY = "@konafit_active_session_v1";
const OLD_SESSION_KEY = "@kinetic_active_session"; // pre-versioning format; never read, just cleaned up
// Local ids must stay unique across app restarts (a resumed session keeps its old ids), so no per-run counter.
let localIdFallback = 0;
const uid = () =>
  `local_${globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}_${++localIdFallback}`}`;

// Write the order the user sees (array position) to the DB in one transaction.
const persistOrder = (exercises: ActiveExercise[]) =>
  setLoggedExerciseOrder(exercises.flatMap((e) => (e.dbId != null ? [e.dbId] : []))).catch(console.error);

function defaultSet(setNumber: number): ActiveSet {
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

async function saveToStorage(session: ActiveSession | null) {
  if (session) {
    await kvStore.setItem(SESSION_KEY, R.serializeSession(session));
  } else {
    await kvStore.removeItem(SESSION_KEY);
  }
}

export async function loadCachedSession(): Promise<ActiveSession | null> {
  try {
    await kvStore.removeItem(OLD_SESSION_KEY);
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

export function useWorkoutSession() {
  const [session, setSession] = useState<ActiveSession | null>(null);
  // Last destructive action, restorable until the snackbar's 5 s run out or something newer replaces it.
  const [pendingUndo, setPendingUndo] = useState<{ id: string; label: string; run: () => Promise<void> } | null>(null);
  const clearUndo = useCallback(() => setPendingUndo(null), []);
  const runUndo = useCallback(async () => {
    const undo = pendingUndo;
    setPendingUndo(null);
    await undo?.run().catch(console.error);
  }, [pendingUndo]);

  // The snapshot in kv_store is debounced (trailing 500 ms) and flushed when the app leaves the foreground.
  const pendingRef = useRef<ActiveSession | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelPending = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    pendingRef.current = null;
  }, []);
  const flushPending = useCallback(() => {
    const pending = pendingRef.current;
    cancelPending();
    if (pending) saveToStorage(pending).catch(console.error);
  }, [cancelPending]);
  // Typing in a set row marks it dirty; its DB row is written once typing pauses (400 ms), on blur, on Finish, or when the app backgrounds.
  const latestRef = useRef<ActiveSession | null>(null);
  const dirtyRef = useRef(new Map<string, string>()); // set localId -> exercise localId
  const dirtyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushDirty = useCallback(async () => {
    if (dirtyTimerRef.current) clearTimeout(dirtyTimerRef.current);
    dirtyTimerRef.current = null;
    const dirty = [...dirtyRef.current];
    dirtyRef.current.clear();
    const cur = latestRef.current;
    if (!cur) return;
    await Promise.all(dirty.map(([setLocalId, exerciseLocalId]) => {
      const e = cur.exercises.find((x) => x.localId === exerciseLocalId);
      const set = e?.sets.find((x) => x.localId === setLocalId);
      return e?.dbId && set ? upsertLoggedSet({ ...set, loggedExerciseId: e.dbId }).catch(console.error) : undefined;
    }));
  }, []);
  const markDirty = useCallback((exerciseLocalId: string, setLocalId: string, delayMs: number) => {
    dirtyRef.current.set(setLocalId, exerciseLocalId);
    if (dirtyTimerRef.current) clearTimeout(dirtyTimerRef.current);
    dirtyTimerRef.current = setTimeout(flushDirty, delayMs);
  }, [flushDirty]);
  const dropDirty = useCallback(() => {
    if (dirtyTimerRef.current) clearTimeout(dirtyTimerRef.current);
    dirtyTimerRef.current = null;
    dirtyRef.current.clear();
  }, []);
  useEffect(() => { latestRef.current = session; }, [session]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") { flushDirty(); flushPending(); }
    });
    return () => { sub.remove(); flushDirty(); flushPending(); };
  }, [flushPending, flushDirty]);

  // The workout can be deleted behind our back (Settings > Wipe All Data); drop the stale session.
  const activeWorkoutId = session?.workoutId;
  useFocusEffect(useCallback(() => {
    if (activeWorkoutId == null) return;
    workoutExists(activeWorkoutId).then((ok) => {
      if (!ok) setSession((cur) => (cur?.workoutId === activeWorkoutId ? null : cur));
    });
  }, [activeWorkoutId]));

  const updateSession = useCallback(
    (updater: (prev: ActiveSession) => ActiveSession) => {
      setSession((prev) => {
        if (!prev) return prev;
        const next = updater(prev);
        latestRef.current = next;
        pendingRef.current = next;
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(flushPending, 500);
        return next;
      });
    },
    [flushPending]
  );

  const startWorkout = useCallback(async () => {
    const workoutId = await createWorkout(undefined, APP_VERSION);
    const newSession: ActiveSession = {
      workoutId,
      startedAt: Date.now(),
      exercises: [],
    };
    setSession(newSession);
    await saveToStorage(newSession);
  }, []);

  const resumeSession = useCallback((cached: ActiveSession) => {
    // Ensure histPRs exists on all exercises (may be missing if cached before this field was added)
    const defaultPRs = { maxWeight: null, maxReps: null, maxVolume: null };
    const normalized: ActiveSession = {
      ...cached,
      exercises: cached.exercises.map((e) => ({
        ...e,
        histPRs: e.histPRs ?? defaultPRs,
      })),
    };
    setSession(normalized);
  }, []);

  const finishWorkout = useCallback(async (location?: string, feel?: WorkoutFeel) => {
    if (!session) return;
    await flushDirty(); // the last typed values must be in the DB before the finish is stamped
    await finalizeWorkout(session.workoutId, location, feel);
    setPendingUndo(null);
    cancelPending();
    await saveToStorage(null);
    setSession(null);
  }, [session, cancelPending, flushDirty]);

  const discardWorkout = useCallback(async () => {
    if (!session) return;
    dropDirty();
    await deleteWorkout(session.workoutId);
    setPendingUndo(null);
    cancelPending();
    await saveToStorage(null);
    setSession(null);
  }, [session, cancelPending, dropDirty]);

  const addExercise = useCallback(
    async (exerciseId: number, exerciseName: string, muscleGroup: string) => {
      if (!session) return;
      const orderIndex = session.exercises.length;
      const dbId = await createLoggedExercise(
        session.workoutId,
        exerciseId,
        exerciseName,
        orderIndex
      );
      const [ghost, histPRs, info] = await Promise.all([
        getGhostSets(exerciseId, session.workoutId),
        getHistPRs(exerciseId, session.workoutId),
        getExerciseInfo(exerciseId),
      ]);
      const libraryNote = info.note;

      if (libraryNote) {
        updateLoggedExerciseNotes(dbId, libraryNote).catch(console.error);
      }

      const setCount = ghost.length > 0 ? ghost.length : 1;
      const sets: ActiveSet[] = [];
      for (let i = 1; i <= setCount; i++) {
        const setDbId = await createLoggedSet(dbId, i);
        const g = ghost.find((gs) => gs.setNumber === i);
        sets.push({
          ...defaultSet(i),
          dbId: setDbId,
          ...(g?.weightLbs != null && g?.reps != null
            ? { weightLbs: String(g.weightLbs), reps: String(g.reps), isGhostFilled: true }
            : {}),
        });
      }

      const newExercise: ActiveExercise = {
        localId: uid(),
        dbId,
        exerciseId,
        exerciseName,
        muscleGroup,
        orderIndex,
        notes: libraryNote,
        sets,
        ghostSets: ghost,
        histPRs,
        isBodyweight: info.isBodyweight,
            perHand: info.perHand,
      };

      updateSession((prev) => ({
        ...prev,
        exercises: [...prev.exercises, newExercise],
      }));
    },
    [session, updateSession]
  );

  const addExerciseAsSuperset = useCallback(
    async (targetLocalId: string, exerciseId: number, exerciseName: string, muscleGroup: string) => {
      if (!session) return;
      const target = session.exercises.find((e) => e.localId === targetLocalId);
      if (!target?.dbId) return;
      const supersetId = target.supersetId ?? uid();
      const targetIndex = session.exercises.findIndex((e) => e.localId === targetLocalId);
      const orderIndex = targetIndex + 1;
      const dbId = await createLoggedExercise(session.workoutId, exerciseId, exerciseName, orderIndex);
      const [ghost, histPRs, info] = await Promise.all([
        getGhostSets(exerciseId, session.workoutId),
        getHistPRs(exerciseId, session.workoutId),
        getExerciseInfo(exerciseId),
      ]);
      const libraryNote = info.note;
      if (libraryNote) {
        updateLoggedExerciseNotes(dbId, libraryNote).catch(console.error);
      }
      const setCount = ghost.length > 0 ? ghost.length : 1;
      const sets: ActiveSet[] = [];
      for (let i = 1; i <= setCount; i++) {
        const setDbId = await createLoggedSet(dbId, i);
        const g = ghost.find((gs) => gs.setNumber === i);
        sets.push({
          ...defaultSet(i),
          dbId: setDbId,
          ...(g?.weightLbs != null && g?.reps != null
            ? { weightLbs: String(g.weightLbs), reps: String(g.reps), isGhostFilled: true }
            : {}),
        });
      }
      const newExercise: ActiveExercise = {
        localId: uid(),
        dbId,
        exerciseId,
        exerciseName,
        muscleGroup,
        orderIndex,
        supersetId,
        notes: libraryNote,
        sets,
        ghostSets: ghost,
        histPRs,
        isBodyweight: info.isBodyweight,
            perHand: info.perHand,
      };
      setLoggedExerciseSuperset([target.dbId, dbId], supersetId).catch(console.error);
      updateSession((prev) => {
        const next = R.addSupersetAfter(prev, targetLocalId, newExercise, supersetId);
        persistOrder(next.exercises);
        return next;
      });
    },
    [session, updateSession]
  );

  const addSet = useCallback(
    async (exerciseLocalId: string) => {
      const exercise = session?.exercises.find((e) => e.localId === exerciseLocalId);
      if (!exercise?.dbId) return;
      const setNumber = exercise.sets.length + 1;
      const dbId = await createLoggedSet(exercise.dbId, setNumber);
      // Copy lbs/reps/rpe from the last set so the user doesn't retype them
      const lastSet = exercise.sets[exercise.sets.length - 1];
      const prefill = lastSet
        ? { weightLbs: lastSet.weightLbs, reps: lastSet.reps, rpe: lastSet.rpe, isGhostFilled: false }
        : {};
      updateSession((prev) => ({
        ...prev,
        exercises: prev.exercises.map((e) =>
          e.localId === exerciseLocalId
            ? { ...e, sets: [...e.sets, { ...defaultSet(setNumber), dbId, ...prefill }] }
            : e
        ),
      }));
    },
    [session, updateSession]
  );

  const removeSet = useCallback(
    async (exerciseLocalId: string, setLocalId: string) => {
      const exercise = session?.exercises.find((e) => e.localId === exerciseLocalId);
      const index = exercise ? exercise.sets.findIndex((s) => s.localId === setLocalId) : -1;
      if (!exercise || index === -1) return;
      const set = exercise.sets[index];
      if (set.dbId) await deleteLoggedSet(set.dbId);
      updateSession((prev) => R.removeSet(prev, exerciseLocalId, setLocalId));

      setPendingUndo({
        id: uid(),
        label: "Set removed",
        run: async () => {
          let restored = set;
          if (exercise.dbId) {
            const dbId = await createLoggedSet(exercise.dbId, index + 1);
            restored = { ...set, dbId, setNumber: index + 1 };
            await upsertLoggedSet({ ...restored, loggedExerciseId: exercise.dbId });
          }
          updateSession((prev) => R.insertSet(prev, exerciseLocalId, restored, index));
        },
      });
    },
    [session, updateSession]
  );

  const updateSet = useCallback(
    (
      exerciseLocalId: string,
      setLocalId: string,
      patch: Partial<Pick<ActiveSet, "weightLbs" | "reps" | "rpe" | "notes" | "isWarmup" | "isCompleted" | "setType">>
    ) => {
      updateSession((prev) => ({
        ...prev,
        exercises: prev.exercises.map((e) => {
          if (e.localId !== exerciseLocalId) return e;
          return {
            ...e,
            sets: e.sets.map((s) => {
              if (s.localId !== setLocalId) return s;
              const isEditingValue = "weightLbs" in patch || "reps" in patch;
              return { ...s, ...patch, ...(isEditingValue ? { isGhostFilled: false } : {}) };
            }),
          };
        }),
      }));
      // Text edits wait for a pause in typing; a tick or warm-up toggle is written right away.
      markDirty(exerciseLocalId, setLocalId, "isCompleted" in patch || "isWarmup" in patch ? 0 : 400);
    },
    [updateSession, markDirty]
  );

  const toggleExerciseDone = useCallback(
    (exerciseLocalId: string) => updateSession((prev) => R.toggleExerciseDone(prev, exerciseLocalId)),
    [updateSession]
  );

  // Write the sets a reducer changed (by identity) for one exercise.
  const persistChanged = (prev: ActiveSession, next: ActiveSession, exerciseLocalId: string) => {
    const before = prev.exercises.find((e) => e.localId === exerciseLocalId);
    const after = next.exercises.find((e) => e.localId === exerciseLocalId);
    if (after?.dbId) {
      after.sets.forEach((s, i) => {
        if (s !== before?.sets[i]) upsertLoggedSet({ ...s, loggedExerciseId: after.dbId! }).catch(console.error);
      });
    }
  };

  // Copy weight/reps/rpe from the last filled set into every other incomplete set.
  const copyLastSetToAll = useCallback(
    (exerciseLocalId: string) => {
      updateSession((prev) => {
        const next = R.copyLastSetToAll(prev, exerciseLocalId);
        persistChanged(prev, next, exerciseLocalId);
        return next;
      });
    },
    [updateSession]
  );

  const applySuggestion = useCallback(
    (exerciseLocalId: string, weight: number, reps: number) => {
      updateSession((prev) => {
        const next = R.applySuggestion(prev, exerciseLocalId, weight, reps);
        persistChanged(prev, next, exerciseLocalId);
        return next;
      });
    },
    [updateSession]
  );

  const applyRpeToAll = useCallback(
    (exerciseLocalId: string) => {
      updateSession((prev) => {
        const next = R.applyRpeToAll(prev, exerciseLocalId);
        persistChanged(prev, next, exerciseLocalId);
        return next;
      });
    },
    [updateSession]
  );

  /** Ramp sets from the heaviest working weight entered (or last time's). Returns false when there's no weight to build from. */
  const addWarmups = useCallback(
    async (exerciseLocalId: string): Promise<boolean> => {
      const exercise = session?.exercises.find((e) => e.localId === exerciseLocalId);
      if (!exercise?.dbId) return false;
      const weights = [
        ...exercise.sets.filter((s) => !s.isWarmup).map((s) => parseFloat(s.weightLbs)),
        ...exercise.ghostSets.map((g) => g.weightLbs ?? NaN),
      ].filter((w) => Number.isFinite(w));
      const ramp = warmupRamp(weights.length ? Math.max(...weights) : 0);
      if (ramp.length === 0) return false;
      const warmups: ActiveSet[] = [];
      for (const r of ramp) {
        warmups.push({
          ...defaultSet(0),
          dbId: await createLoggedSet(exercise.dbId, 0),
          weightLbs: String(r.weight),
          reps: String(r.reps),
          isWarmup: true,
        });
      }
      updateSession((prev) => {
        const next = R.insertWarmups(prev, exerciseLocalId, warmups);
        const after = next.exercises.find((e) => e.localId === exerciseLocalId)!;
        after.sets.forEach((s) => upsertLoggedSet({ ...s, loggedExerciseId: after.dbId! }).catch(console.error)); // new rows and renumbered old ones
        return next;
      });
      return true;
    },
    [session, updateSession]
  );

  const togglePerHand = useCallback(
    (exerciseLocalId: string) => {
      const exercise = session?.exercises.find((e) => e.localId === exerciseLocalId);
      if (!exercise) return;
      const perHand = !exercise.perHand;
      setExercisePerHand(exercise.exerciseId, perHand).catch(console.error);
      updateSession((prev) => ({
        ...prev,
        exercises: prev.exercises.map((e) => (e.exerciseId === exercise.exerciseId ? { ...e, perHand } : e)),
      }));
    },
    [session, updateSession]
  );

  // Re-evaluate PR badges for an already-completed set after its values were edited.
  const recheckSetPR = useCallback(
    (exerciseLocalId: string, setLocalId: string) => {
      flushDirty(); // blur: write what was typed now
      updateSession((prev) => ({
        ...prev,
        exercises: prev.exercises.map((e) => {
          if (e.localId !== exerciseLocalId) return e;
          return {
            ...e,
            sets: e.sets.map((s) => {
              if (s.localId !== setLocalId || !s.isCompleted) return s;
              const weight = s.weightLbs === "" && e.isBodyweight ? 0 : parseFloat(s.weightLbs);
              const reps = parseInt(s.reps, 10);
              const valid = !s.isWarmup && !isNaN(weight) && !isNaN(reps);
              return { ...s, prBadges: valid ? computePRBadges(e, s.localId, weight, reps, e.histPRs) : undefined };
            }),
          };
        }),
      }));
    },
    [updateSession, flushDirty]
  );

  const toggleSetComplete = useCallback(
    (exerciseLocalId: string, setLocalId: string): boolean => {
      let nowComplete = false;
      updateSession((prev) => ({
        ...prev,
        exercises: prev.exercises.map((e) => {
          if (e.localId !== exerciseLocalId) return e;
          return {
            ...e,
            sets: e.sets.map((s) => {
              if (s.localId !== setLocalId) return s;
              nowComplete = !s.isCompleted;
              const weight = s.weightLbs === "" ? (e.isBodyweight ? 0 : null) : parseFloat(s.weightLbs);
              const reps = s.reps === "" ? null : parseInt(s.reps, 10);

              let prBadges: PRBadge[] | undefined;
              if (nowComplete && !s.isWarmup && weight != null && reps != null) {
                prBadges = computePRBadges(e, s.localId, weight, reps, e.histPRs);
                if (isRealPR(prBadges)) haptics.success();
              }

              const updated = { ...s, isCompleted: nowComplete, isGhostFilled: false, prBadges: nowComplete ? prBadges : undefined };
              if (e.dbId) {
                upsertLoggedSet({ ...updated, loggedExerciseId: e.dbId }).catch(console.error);
              }
              return updated;
            }),
          };
        }),
      }));
      return nowComplete;
    },
    [updateSession]
  );

  const toggleSetWarmup = useCallback(
    (exerciseLocalId: string, setLocalId: string) => {
      updateSession((prev) => ({
        ...prev,
        exercises: prev.exercises.map((e) => {
          if (e.localId !== exerciseLocalId) return e;
          return {
            ...e,
            sets: e.sets.map((s) => {
              if (s.localId !== setLocalId) return s;
              const updated = { ...s, isWarmup: !s.isWarmup };
              if (e.dbId) {
                upsertLoggedSet({ ...updated, loggedExerciseId: e.dbId }).catch(
                  console.error
                );
              }
              return updated;
            }),
          };
        }),
      }));
    },
    [updateSession]
  );

  const updateExerciseNotes = useCallback(
    // The note belongs to this workout; only `saveAsDefault` also makes it the prefilled note for future workouts.
    (exerciseLocalId: string, notes: string, saveAsDefault = false) => {
      updateSession((prev) => ({
        ...prev,
        exercises: prev.exercises.map((e) => {
          if (e.localId !== exerciseLocalId) return e;
          if (e.dbId) updateLoggedExerciseNotes(e.dbId, notes).catch(console.error);
          if (saveAsDefault) updateExerciseLibraryNote(e.exerciseId, notes).catch(console.error);
          return { ...e, notes };
        }),
      }));
    },
    [updateSession]
  );

  const moveExercise = useCallback(
    (exerciseLocalId: string, direction: "up" | "down") => {
      updateSession((prev) => {
        const next = R.moveExercise(prev, exerciseLocalId, direction);
        if (next !== prev) persistOrder(next.exercises);
        return next;
      });
    },
    [updateSession]
  );

  const swapExercise = useCallback(
    async (exerciseLocalId: string, newExerciseId: number, newExerciseName: string, newMuscleGroup: string) => {
      const exercise = session?.exercises.find((e) => e.localId === exerciseLocalId);
      if (!exercise?.dbId) return;
      await swapLoggedExercise(exercise.dbId, newExerciseId, newExerciseName);
      const [ghost, histPRs, info] = await Promise.all([
        getGhostSets(newExerciseId, session!.workoutId),
        getHistPRs(newExerciseId, session!.workoutId),
        getExerciseInfo(newExerciseId),
      ]);
      updateSession((prev) =>
        R.swapExercise(prev, exerciseLocalId, {
          exerciseId: newExerciseId,
          exerciseName: newExerciseName,
          muscleGroup: newMuscleGroup,
          ghostSets: ghost,
          histPRs,
          isBodyweight: info.isBodyweight,
            perHand: info.perHand,
        })
      );
    },
    [session, updateSession]
  );

  const removeExercise = useCallback(
    async (exerciseLocalId: string) => {
      const index = session ? session.exercises.findIndex((e) => e.localId === exerciseLocalId) : -1;
      if (!session || index === -1) return;
      const exercise = session.exercises[index];
      const workoutId = session.workoutId;
      if (exercise.dbId) await deleteLoggedExercise(exercise.dbId);
      updateSession((prev) => {
        const next = R.removeExercise(prev, exerciseLocalId);
        persistOrder(next.exercises);
        return next;
      });

      setPendingUndo({
        id: uid(),
        label: `${exercise.exerciseName} removed`,
        run: async () => {
          const dbId = await createLoggedExercise(workoutId, exercise.exerciseId, exercise.exerciseName, index);
          if (exercise.notes) await updateLoggedExerciseNotes(dbId, exercise.notes);
          const sets: ActiveSet[] = [];
          for (const s of exercise.sets) {
            const restored = { ...s, dbId: await createLoggedSet(dbId, s.setNumber) };
            await upsertLoggedSet({ ...restored, loggedExerciseId: dbId });
            sets.push(restored);
          }
          updateSession((prev) => {
            const next = R.insertExercise(prev, { ...exercise, dbId, sets }, index);
            persistOrder(next.exercises);
            return next;
          });
        },
      });
    },
    [session, updateSession]
  );

  const launchFromExercises = useCallback(async (
    programExercises: {
      exerciseId: number; exerciseName: string; muscleGroup: string; targetSets: number | null;
      warmupSets?: number; supersetId?: string | null; targetReps?: string | null; targetRpe?: number | null;
    }[],
    programDayId?: number
  ) => {
    const workoutId = await createWorkout(programDayId, APP_VERSION);
    try {
      const supersetIds = new Map<string, string>(); // saved superset id -> this workout's own id
      const exercises: ActiveExercise[] = await Promise.all(
        programExercises.map(async (pe, orderIndex) => {
          const dbId = await createLoggedExercise(
            workoutId, pe.exerciseId, pe.exerciseName, orderIndex
          );
          const [ghost, histPRs, info] = await Promise.all([
            getGhostSets(pe.exerciseId, workoutId),
            getHistPRs(pe.exerciseId, workoutId),
            getExerciseInfo(pe.exerciseId),
          ]);
          const libraryNote = info.note;
          if (libraryNote) {
            updateLoggedExerciseNotes(dbId, libraryNote).catch(console.error);
          }
          const warmups = pe.warmupSets ?? 0;
          const working = ghost.length > 0 ? ghost.length : (pe.targetSets ?? 3);
          const sets: ActiveSet[] = [];
          for (let i = 1; i <= warmups + working; i++) {
            const setDbId = await createLoggedSet(dbId, i);
            const isWarmup = i <= warmups;
            const g = isWarmup ? undefined : ghost[i - warmups - 1]; // ghost sets are the last session's working sets, in order
            sets.push({
              ...defaultSet(i),
              dbId: setDbId,
              isWarmup,
              ...(g?.weightLbs != null && g?.reps != null
                ? { weightLbs: String(g.weightLbs), reps: String(g.reps), isGhostFilled: true }
                : {}),
            });
          }
          let supersetId: string | undefined;
          if (pe.supersetId) {
            supersetId = supersetIds.get(pe.supersetId) ?? uid();
            supersetIds.set(pe.supersetId, supersetId);
          }
          return {
            localId: uid(),
            dbId,
            exerciseId: pe.exerciseId,
            exerciseName: pe.exerciseName,
            muscleGroup: pe.muscleGroup,
            orderIndex,
            supersetId,
            notes: libraryNote,
            sets,
            ghostSets: ghost,
            histPRs,
            isBodyweight: info.isBodyweight,
            perHand: info.perHand,
            targetReps: pe.targetReps,
            targetRpe: pe.targetRpe,
          };
        })
      );
      for (const [, id] of supersetIds) {
        await setLoggedExerciseSuperset(exercises.filter((e) => e.supersetId === id).map((e) => e.dbId!), id);
      }

      const newSession: ActiveSession = { workoutId, startedAt: Date.now(), exercises };
      await saveToStorage(newSession);
      setSession(newSession);
    } catch (e) {
      // All or nothing: a half-built workout would otherwise linger in the DB and in history queries.
      console.error("Failed to start workout", e);
      await deleteWorkout(workoutId).catch(console.error);
      Alert.alert("Couldn't start workout", "Nothing was saved. Please try again.");
    }
  }, []);

  const launchFromProgramDay = useCallback(
    async (programDayId: number) =>
      launchFromExercises(await getProgramDayExercises(programDayId), programDayId),
    [launchFromExercises]
  );

  // Start a workout pre-loaded with the last finished workout's exercises (ghost sets fill the numbers).
  const repeatLastWorkout = useCallback(async () => {
    const last = await getLastWorkoutExercises();
    if (last.length > 0) await launchFromExercises(last);
  }, [launchFromExercises]);

  return {
    session,
    pendingUndo,
    runUndo,
    clearUndo,
    startWorkout,
    resumeSession,
    finishWorkout,
    discardWorkout,
    addExercise,
    addExerciseAsSuperset,
    addSet,
    removeSet,
    updateSet,
    copyLastSetToAll,
    applySuggestion,
    applyRpeToAll,
    addWarmups,
    togglePerHand,
    toggleExerciseDone,
    recheckSetPR,
    toggleSetComplete,
    toggleSetWarmup,
    updateExerciseNotes,
    removeExercise,
    launchFromProgramDay,
    repeatLastWorkout,
    swapExercise,
    moveExercise,
  };
}
