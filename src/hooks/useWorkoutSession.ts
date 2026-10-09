import { useState, useCallback, useRef } from "react";
import { useFocusEffect } from "expo-router";
import { kvStore } from "../utils/kvStore";
import { haptics } from "../utils/haptics";
import type { ActiveSession, ActiveExercise, ActiveSet } from "../types/workout";
import {
  createWorkout,
  finalizeWorkout,
  deleteWorkout,
  workoutExists,
  createLoggedExercise,
  createLoggedSet,
  upsertLoggedSet,
  deleteLoggedSet,
  getGhostSets,
  updateLoggedExerciseNotes,
  swapLoggedExercise,
  updateLoggedExerciseOrder,
  getExerciseLibraryNote,
  updateExerciseLibraryNote,
} from "../db/workoutQueries";
import { getProgramDayExercises } from "../db/programQueries";
import { getHistPRs, getLastWorkoutExercises } from "../db/historyQueries";
import type { PRBadge, HistPRs } from "../types/workout";

const SESSION_KEY = "@kinetic_active_session";
let localIdCounter = 0;
const uid = () => `local_${++localIdCounter}_${Date.now()}`;

function computePRBadges(
  exercise: ActiveExercise,
  excludeSetLocalId: string,
  weight: number,
  reps: number,
  hist: HistPRs
): PRBadge[] {
  const otherCompleted = exercise.sets.filter(
    (s) => s.localId !== excludeSetLocalId && s.isCompleted && !s.isWarmup &&
    s.weightLbs !== "" && s.reps !== ""
  );
  const sessionMaxWeight = otherCompleted.length > 0
    ? Math.max(...otherCompleted.map((s) => parseFloat(s.weightLbs)))
    : null;
  const sessionMaxReps = otherCompleted.length > 0
    ? Math.max(...otherCompleted.map((s) => parseInt(s.reps, 10)))
    : null;
  const sessionMaxVolume = otherCompleted.length > 0
    ? Math.max(...otherCompleted.map((s) => parseFloat(s.weightLbs) * parseInt(s.reps, 10)))
    : null;

  const allTimeWeight = Math.max(hist.maxWeight ?? 0, sessionMaxWeight ?? 0);
  const allTimeReps = Math.max(hist.maxReps ?? 0, sessionMaxReps ?? 0);
  const allTimeVolume = Math.max(hist.maxVolume ?? 0, sessionMaxVolume ?? 0);

  const badges: PRBadge[] = [];
  if (weight > allTimeWeight) badges.push("W");
  if (reps > allTimeReps) badges.push("R");
  if (weight * reps > allTimeVolume) badges.push("V");
  return badges;
}

function defaultSet(setNumber: number): ActiveSet {
  return {
    localId: uid(),
    setNumber,
    weightLbs: "",
    reps: "",
    rpe: "",
    isWarmup: false,
    isCompleted: false,
  };
}

async function saveToStorage(session: ActiveSession | null) {
  if (session) {
    await kvStore.setItem(SESSION_KEY, JSON.stringify(session));
  } else {
    await kvStore.removeItem(SESSION_KEY);
  }
}

export async function loadCachedSession(): Promise<ActiveSession | null> {
  try {
    const raw = await kvStore.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as ActiveSession) : null;
  } catch {
    return null;
  }
}

export function useWorkoutSession() {
  const [session, setSession] = useState<ActiveSession | null>(null);
  const saveRef = useRef(saveToStorage);
  saveRef.current = saveToStorage;

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
        saveRef.current(next).catch(console.error);
        return next;
      });
    },
    []
  );

  const startWorkout = useCallback(async () => {
    const workoutId = await createWorkout();
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

  const finishWorkout = useCallback(async (location?: string) => {
    if (!session) return;
    await finalizeWorkout(session.workoutId, location);
    await saveToStorage(null);
    setSession(null);
  }, [session]);

  const discardWorkout = useCallback(async () => {
    if (!session) return;
    await deleteWorkout(session.workoutId);
    await saveToStorage(null);
    setSession(null);
  }, [session]);

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
      const [ghost, histPRs, libraryNote] = await Promise.all([
        getGhostSets(exerciseId, session.workoutId),
        getHistPRs(exerciseId, session.workoutId),
        getExerciseLibraryNote(exerciseId),
      ]);

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
      const [ghost, histPRs, libraryNote] = await Promise.all([
        getGhostSets(exerciseId, session.workoutId),
        getHistPRs(exerciseId, session.workoutId),
        getExerciseLibraryNote(exerciseId),
      ]);
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
      };
      updateSession((prev) => {
        const exercises = [...prev.exercises];
        const tIdx = exercises.findIndex((e) => e.localId === targetLocalId);
        exercises[tIdx] = { ...exercises[tIdx], supersetId };
        exercises.splice(tIdx + 1, 0, newExercise);
        return { ...prev, exercises };
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
      if (!exercise) return;
      const set = exercise.sets.find((s) => s.localId === setLocalId);
      if (set?.dbId) await deleteLoggedSet(set.dbId);

      updateSession((prev) => ({
        ...prev,
        exercises: prev.exercises.map((e) =>
          e.localId === exerciseLocalId
            ? {
                ...e,
                sets: e.sets
                  .filter((s) => s.localId !== setLocalId)
                  .map((s, i) => ({ ...s, setNumber: i + 1 })),
              }
            : e
        ),
      }));
    },
    [session, updateSession]
  );

  const updateSet = useCallback(
    (
      exerciseLocalId: string,
      setLocalId: string,
      patch: Partial<Pick<ActiveSet, "weightLbs" | "reps" | "rpe" | "isWarmup" | "isCompleted">>
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
              const updated = { ...s, ...patch, ...(isEditingValue ? { isGhostFilled: false } : {}) };
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

  // Copy weight/reps/rpe from the last filled set into every other incomplete set.
  const copyLastSetToAll = useCallback(
    (exerciseLocalId: string) => {
      updateSession((prev) => ({
        ...prev,
        exercises: prev.exercises.map((e) => {
          if (e.localId !== exerciseLocalId) return e;
          const src = [...e.sets].reverse().find((s) => s.weightLbs !== "" && s.reps !== "");
          if (!src) return e;
          return {
            ...e,
            sets: e.sets.map((s) => {
              if (s.isCompleted || s.localId === src.localId) return s;
              const updated = { ...s, weightLbs: src.weightLbs, reps: src.reps, rpe: src.rpe, isGhostFilled: false };
              if (e.dbId) upsertLoggedSet({ ...updated, loggedExerciseId: e.dbId }).catch(console.error);
              return updated;
            }),
          };
        }),
      }));
    },
    [updateSession]
  );

  // Re-evaluate PR badges for an already-completed set after its values were edited.
  const recheckSetPR = useCallback(
    (exerciseLocalId: string, setLocalId: string) => {
      updateSession((prev) => ({
        ...prev,
        exercises: prev.exercises.map((e) => {
          if (e.localId !== exerciseLocalId) return e;
          return {
            ...e,
            sets: e.sets.map((s) => {
              if (s.localId !== setLocalId || !s.isCompleted) return s;
              const weight = parseFloat(s.weightLbs);
              const reps = parseInt(s.reps, 10);
              const valid = !s.isWarmup && !isNaN(weight) && !isNaN(reps);
              return { ...s, prBadges: valid ? computePRBadges(e, s.localId, weight, reps, e.histPRs) : undefined };
            }),
          };
        }),
      }));
    },
    [updateSession]
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
              const weight = s.weightLbs === "" ? null : parseFloat(s.weightLbs);
              const reps = s.reps === "" ? null : parseInt(s.reps, 10);

              let prBadges: PRBadge[] | undefined;
              if (nowComplete && !s.isWarmup && weight != null && reps != null) {
                prBadges = computePRBadges(e, s.localId, weight, reps, e.histPRs);
                if (prBadges.length > 0) haptics.success();
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
    (exerciseLocalId: string, notes: string) => {
      updateSession((prev) => ({
        ...prev,
        exercises: prev.exercises.map((e) => {
          if (e.localId !== exerciseLocalId) return e;
          if (e.dbId) updateLoggedExerciseNotes(e.dbId, notes).catch(console.error);
          updateExerciseLibraryNote(e.exerciseId, notes).catch(console.error);
          return { ...e, notes };
        }),
      }));
    },
    [updateSession]
  );

  const moveExercise = useCallback(
    async (exerciseLocalId: string, direction: "up" | "down") => {
      if (!session) return;
      const idx = session.exercises.findIndex((e) => e.localId === exerciseLocalId);
      if (idx === -1) return;
      const newIdx = direction === "up" ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= session.exercises.length) return;

      updateSession((prev) => {
        const exercises = [...prev.exercises];
        [exercises[idx], exercises[newIdx]] = [exercises[newIdx], exercises[idx]];
        exercises[idx] = { ...exercises[idx], orderIndex: idx };
        exercises[newIdx] = { ...exercises[newIdx], orderIndex: newIdx };
        if (exercises[idx].dbId) updateLoggedExerciseOrder(exercises[idx].dbId!, idx).catch(console.error);
        if (exercises[newIdx].dbId) updateLoggedExerciseOrder(exercises[newIdx].dbId!, newIdx).catch(console.error);
        return { ...prev, exercises };
      });
    },
    [session, updateSession]
  );

  const swapExercise = useCallback(
    async (exerciseLocalId: string, newExerciseId: number, newExerciseName: string, newMuscleGroup: string) => {
      const exercise = session?.exercises.find((e) => e.localId === exerciseLocalId);
      if (!exercise?.dbId) return;
      await swapLoggedExercise(exercise.dbId, newExerciseId, newExerciseName);
      const [ghost, histPRs] = await Promise.all([
        getGhostSets(newExerciseId, session!.workoutId),
        getHistPRs(newExerciseId, session!.workoutId),
      ]);
      updateSession((prev) => ({
        ...prev,
        exercises: prev.exercises.map((e) =>
          e.localId === exerciseLocalId
            ? { ...e, exerciseId: newExerciseId, exerciseName: newExerciseName, muscleGroup: newMuscleGroup, ghostSets: ghost, histPRs }
            : e
        ),
      }));
    },
    [session, updateSession]
  );

  const removeExercise = useCallback(
    (exerciseLocalId: string) => {
      updateSession((prev) => ({
        ...prev,
        exercises: prev.exercises
          .filter((e) => e.localId !== exerciseLocalId)
          .map((e, i) => ({ ...e, orderIndex: i })),
      }));
    },
    [updateSession]
  );

  const launchFromExercises = useCallback(async (
    programExercises: { exerciseId: number; exerciseName: string; muscleGroup: string; targetSets: number | null }[],
    programDayId?: number
  ) => {
    const workoutId = await createWorkout(programDayId);

    const exercises: ActiveExercise[] = await Promise.all(
      programExercises.map(async (pe, orderIndex) => {
        const dbId = await createLoggedExercise(
          workoutId, pe.exerciseId, pe.exerciseName, orderIndex
        );
        const [ghost, histPRs, libraryNote] = await Promise.all([
          getGhostSets(pe.exerciseId, workoutId),
          getHistPRs(pe.exerciseId, workoutId),
          getExerciseLibraryNote(pe.exerciseId),
        ]);
        if (libraryNote) {
          updateLoggedExerciseNotes(dbId, libraryNote).catch(console.error);
        }
        const setCount = ghost.length > 0 ? ghost.length : (pe.targetSets ?? 3);
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
        return {
          localId: uid(),
          dbId,
          exerciseId: pe.exerciseId,
          exerciseName: pe.exerciseName,
          muscleGroup: pe.muscleGroup,
          orderIndex,
          notes: libraryNote,
          sets,
          ghostSets: ghost,
          histPRs,
        };
      })
    );

    const newSession: ActiveSession = { workoutId, startedAt: Date.now(), exercises };
    setSession(newSession);
    await saveToStorage(newSession);
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
