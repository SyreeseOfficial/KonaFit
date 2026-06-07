import { useState, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ActiveSession, ActiveExercise, ActiveSet } from "../types/workout";
import {
  createWorkout,
  finalizeWorkout,
  deleteWorkout,
  createLoggedExercise,
  createLoggedSet,
  upsertLoggedSet,
  deleteLoggedSet,
  getGhostSets,
  updateLoggedExerciseNotes,
} from "../db/workoutQueries";
import { getProgramDayExercises } from "../db/programQueries";

const SESSION_KEY = "@kinetic_active_session";
let localIdCounter = 0;
const uid = () => `local_${++localIdCounter}_${Date.now()}`;

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
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } else {
    await AsyncStorage.removeItem(SESSION_KEY);
  }
}

export async function loadCachedSession(): Promise<ActiveSession | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as ActiveSession) : null;
  } catch {
    return null;
  }
}

export function useWorkoutSession() {
  const [session, setSession] = useState<ActiveSession | null>(null);
  const saveRef = useRef(saveToStorage);
  saveRef.current = saveToStorage;

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
    setSession(cached);
  }, []);

  const finishWorkout = useCallback(async () => {
    if (!session) return;
    await finalizeWorkout(session.workoutId);
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
      const firstSetDbId = await createLoggedSet(dbId, 1);
      const ghost = await getGhostSets(exerciseId, session.workoutId);

      const newExercise: ActiveExercise = {
        localId: uid(),
        dbId,
        exerciseId,
        exerciseName,
        muscleGroup,
        orderIndex,
        notes: "",
        sets: [{ ...defaultSet(1), dbId: firstSetDbId }],
        ghostSets: ghost,
      };

      updateSession((prev) => ({
        ...prev,
        exercises: [...prev.exercises, newExercise],
      }));
    },
    [session, updateSession]
  );

  const addSet = useCallback(
    async (exerciseLocalId: string) => {
      const exercise = session?.exercises.find((e) => e.localId === exerciseLocalId);
      if (!exercise?.dbId) return;
      const setNumber = exercise.sets.length + 1;
      const dbId = await createLoggedSet(exercise.dbId, setNumber);
      updateSession((prev) => ({
        ...prev,
        exercises: prev.exercises.map((e) =>
          e.localId === exerciseLocalId
            ? { ...e, sets: [...e.sets, { ...defaultSet(setNumber), dbId }] }
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
              const updated = { ...s, ...patch };
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
              const updated = { ...s, isCompleted: nowComplete };
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
          return { ...e, notes };
        }),
      }));
    },
    [updateSession]
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

  const launchFromProgramDay = useCallback(async (programDayId: number) => {
    const programExercises = await getProgramDayExercises(programDayId);
    const workoutId = await createWorkout();

    const exercises: ActiveExercise[] = await Promise.all(
      programExercises.map(async (pe, orderIndex) => {
        const dbId = await createLoggedExercise(
          workoutId, pe.exerciseId, pe.exerciseName, orderIndex
        );
        const setCount = pe.targetSets ?? 3;
        const sets: ActiveSet[] = [];
        for (let i = 1; i <= setCount; i++) {
          const setDbId = await createLoggedSet(dbId, i);
          sets.push({ ...defaultSet(i), dbId: setDbId });
        }
        const ghost = await getGhostSets(pe.exerciseId, workoutId);
        return {
          localId: uid(),
          dbId,
          exerciseId: pe.exerciseId,
          exerciseName: pe.exerciseName,
          muscleGroup: pe.muscleGroup,
          orderIndex,
          notes: "",
          sets,
          ghostSets: ghost,
        };
      })
    );

    const newSession: ActiveSession = { workoutId, startedAt: Date.now(), exercises };
    setSession(newSession);
    await saveToStorage(newSession);
  }, []);

  return {
    session,
    startWorkout,
    resumeSession,
    finishWorkout,
    discardWorkout,
    addExercise,
    addSet,
    removeSet,
    updateSet,
    toggleSetComplete,
    toggleSetWarmup,
    updateExerciseNotes,
    removeExercise,
    launchFromProgramDay,
  };
}
