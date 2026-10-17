import { getDatabase } from "./database";
import { localDateKey } from "../utils/time";

export type WorkoutSummary = {
  id: number;
  name: string;
  started_at: number;
  finished_at: number;
  duration_seconds: number;
  exercise_count: number;
  set_count: number;
  total_volume: number;
  location: string | null;
};

export type SetRecord = {
  id: number;
  set_number: number;
  weight_lbs: number | null;
  reps: number | null;
  rpe: number | null;
  notes: string | null;
  is_warmup: number;
  is_completed: number;
};

export type ExerciseRecord = {
  id: number;
  exercise_name: string;
  muscle_group: string;
  order_index: number;
  notes: string | null;
  sets: SetRecord[];
};

export type WorkoutDetail = {
  id: number;
  name: string;
  started_at: number;
  finished_at: number;
  duration_seconds: number;
  location: string | null;
  exercises: ExerciseRecord[];
  totalVolume: number;
};

export async function getWorkoutHistory(limit = 20): Promise<WorkoutSummary[]> {
  const db = await getDatabase();
  return db.getAllAsync<WorkoutSummary>(
    `SELECT
       w.id, w.name, w.started_at, w.finished_at, w.location,
       COALESCE(w.duration_seconds, 0) as duration_seconds,
       COUNT(DISTINCT le.id) as exercise_count,
       COUNT(DISTINCT ls.id) as set_count,
       COALESCE(SUM(CASE WHEN ls.is_completed = 1 THEN ls.weight_lbs * ls.reps ELSE 0 END), 0) as total_volume
     FROM workouts w
     LEFT JOIN logged_exercises le ON le.workout_id = w.id
     LEFT JOIN logged_sets ls ON ls.logged_exercise_id = le.id
     WHERE w.finished_at IS NOT NULL
     GROUP BY w.id
     ORDER BY w.started_at DESC
     LIMIT ?`,
    [limit]
  );
}

// Exercises of the most recent finished workout, in order, for "Repeat last workout".
export async function getLastWorkoutExercises(): Promise<
  { exerciseId: number; exerciseName: string; muscleGroup: string; targetSets: number }[]
> {
  const db = await getDatabase();
  return db.getAllAsync(
    `SELECT le.exercise_id as exerciseId, le.exercise_name as exerciseName,
            COALESCE(e.muscle_group, '') as muscleGroup,
            MAX(1, COALESCE(SUM(CASE WHEN ls.is_warmup = 0 THEN 1 ELSE 0 END), 0)) as targetSets
     FROM logged_exercises le
     LEFT JOIN exercises e ON e.id = le.exercise_id
     LEFT JOIN logged_sets ls ON ls.logged_exercise_id = le.id
     WHERE le.exercise_id IS NOT NULL
       AND le.workout_id = (
         SELECT id FROM workouts WHERE finished_at IS NOT NULL ORDER BY started_at DESC LIMIT 1
       )
     GROUP BY le.id
     ORDER BY le.order_index ASC`
  );
}

export async function getWorkoutDetail(workoutId: number): Promise<WorkoutDetail | null> {
  const db = await getDatabase();

  const workout = await db.getFirstAsync<{
    id: number; name: string; started_at: number;
    finished_at: number; duration_seconds: number; location: string | null;
  }>(
    "SELECT id, name, started_at, finished_at, duration_seconds, location FROM workouts WHERE id = ?",
    [workoutId]
  );
  if (!workout) return null;

  const exerciseRows = await db.getAllAsync<{
    id: number; exercise_name: string; muscle_group: string; order_index: number; notes: string | null;
  }>(
    `SELECT le.id, le.exercise_name, COALESCE(e.muscle_group, '') as muscle_group, le.order_index, le.notes
     FROM logged_exercises le
     LEFT JOIN exercises e ON le.exercise_id = e.id
     WHERE le.workout_id = ?
     ORDER BY le.order_index ASC`,
    [workoutId]
  );

  let totalVolume = 0;
  const exercises: ExerciseRecord[] = await Promise.all(
    exerciseRows.map(async (ex) => {
      const sets = await db.getAllAsync<SetRecord>(
        `SELECT id, set_number, weight_lbs, reps, rpe, notes, is_warmup, is_completed
         FROM logged_sets WHERE logged_exercise_id = ? ORDER BY set_number ASC`,
        [ex.id]
      );
      sets.forEach((s) => {
        if (s.is_completed && s.weight_lbs && s.reps) {
          totalVolume += s.weight_lbs * s.reps;
        }
      });
      return { ...ex, notes: ex.notes ?? null, sets };
    })
  );

  return {
    id: workout.id,
    name: workout.name,
    started_at: workout.started_at,
    finished_at: workout.finished_at,
    duration_seconds: workout.duration_seconds ?? 0,
    location: workout.location ?? null,
    exercises,
    totalVolume,
  };
}

export type CsvRow = {
  date: string;
  time: string;
  duration_min: number;
  workout_id: number;
  exercise: string;
  muscle_group: string;
  set_number: number;
  weight_lbs: number | null;
  reps: number | null;
  rpe: number | null;
  notes: string | null;
  is_warmup: string;
  is_completed: string;
};

export async function getAllWorkoutDataForExport(): Promise<CsvRow[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    started_at: number; duration_seconds: number | null; workout_id: number;
    exercise_name: string; muscle_group: string;
    set_number: number; weight_lbs: number | null; reps: number | null;
    rpe: number | null; notes: string | null; is_warmup: number; is_completed: number;
  }>(
    `SELECT
       w.started_at, w.duration_seconds, w.id as workout_id,
       le.exercise_name,
       COALESCE(e.muscle_group, '') as muscle_group,
       ls.set_number, ls.weight_lbs, ls.reps, ls.rpe, ls.notes,
       ls.is_warmup, ls.is_completed
     FROM logged_sets ls
     JOIN logged_exercises le ON ls.logged_exercise_id = le.id
     JOIN workouts w ON le.workout_id = w.id
     LEFT JOIN exercises e ON le.exercise_id = e.id
     WHERE w.finished_at IS NOT NULL
     ORDER BY w.started_at DESC, le.order_index ASC, ls.set_number ASC`
  );

  return rows.map((r) => {
    const d = new Date(r.started_at * 1000);
    return {
      date: localDateKey(d),
      time: d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      duration_min: Math.round((r.duration_seconds ?? 0) / 60),
      workout_id: r.workout_id,
      exercise: r.exercise_name,
      muscle_group: r.muscle_group,
      set_number: r.set_number,
      weight_lbs: r.weight_lbs,
      reps: r.reps,
      rpe: r.rpe,
      notes: r.notes,
      is_warmup: r.is_warmup ? "Yes" : "No",
      is_completed: r.is_completed ? "Yes" : "No",
    };
  });
}

// ─── Edit Workout ─────────────────────────────────────────────────────────────

export async function updateWorkoutName(workoutId: number, name: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("UPDATE workouts SET name = ? WHERE id = ?", [name.trim(), workoutId]);
}

export async function updateLoggedSetValues(
  setId: number,
  weightLbs: number | null,
  reps: number | null,
  rpe: number | null
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE logged_sets SET weight_lbs = ?, reps = ?, rpe = ? WHERE id = ?",
    [weightLbs, reps, rpe, setId]
  );
}

export async function deleteLoggedSetFromHistory(setId: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM logged_sets WHERE id = ?", [setId]);
}

export async function updateWorkoutDateTime(
  workoutId: number,
  startedAt: number,
  durationSeconds: number
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    "UPDATE workouts SET started_at = ?, finished_at = ?, duration_seconds = ? WHERE id = ?",
    [startedAt, startedAt + durationSeconds, durationSeconds, workoutId]
  );
}

export async function addExerciseToHistory(
  workoutId: number,
  exerciseId: number,
  exerciseName: string
): Promise<void> {
  const db = await getDatabase();
  const maxOrder = await db.getFirstAsync<{ max_idx: number | null }>(
    "SELECT MAX(order_index) as max_idx FROM logged_exercises WHERE workout_id = ?",
    [workoutId]
  );
  const orderIndex = (maxOrder?.max_idx ?? -1) + 1;
  const { lastInsertRowId } = await db.runAsync(
    "INSERT INTO logged_exercises (workout_id, exercise_id, exercise_name, order_index) VALUES (?, ?, ?, ?)",
    [workoutId, exerciseId, exerciseName, orderIndex]
  );
  await db.runAsync(
    "INSERT INTO logged_sets (logged_exercise_id, set_number, is_completed) VALUES (?, 1, 1)",
    [lastInsertRowId]
  );
}

// ─── Exercise PRs ─────────────────────────────────────────────────────────────

export type PRSet = {
  weightLbs: number | null;
  reps: number | null;
  achievedAt: number | null; // unix ms
};

export type ExercisePRs = {
  maxWeight: PRSet;
  maxReps: PRSet;
  maxVolume: PRSet;
  lastTrainedAt: number | null; // unix ms
  maxOneRM: PRSet; // heaviest estimated 1RM (Epley); weightLbs/reps are the set that produced it
};

const PR_BASE = `
  FROM logged_sets ls
  JOIN logged_exercises le ON ls.logged_exercise_id = le.id
  JOIN workouts w ON le.workout_id = w.id
  WHERE le.exercise_id = ?
    AND ls.is_completed = 1 AND ls.is_warmup = 0
    AND ls.weight_lbs IS NOT NULL AND ls.reps IS NOT NULL
    AND w.finished_at IS NOT NULL
`;

export type RawHistPRs = {
  maxWeight: number | null;
  maxReps: number | null;
  maxVolume: number | null;
  repsByWeight: { weight: number; reps: number }[];
};

export async function getHistPRs(exerciseId: number, excludeWorkoutId: number): Promise<RawHistPRs> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ mw: number | null; mr: number | null; mv: number | null }>(
    `SELECT
       MAX(ls.weight_lbs) AS mw,
       MAX(ls.reps) AS mr,
       MAX(ls.weight_lbs * ls.reps) AS mv
     FROM logged_sets ls
     JOIN logged_exercises le ON ls.logged_exercise_id = le.id
     JOIN workouts w ON le.workout_id = w.id
     WHERE le.exercise_id = ?
       AND w.id != ?
       AND w.finished_at IS NOT NULL
       AND ls.is_completed = 1 AND ls.is_warmup = 0
       AND ls.weight_lbs IS NOT NULL AND ls.reps IS NOT NULL`,
    [exerciseId, excludeWorkoutId]
  );
  const repsByWeight = await db.getAllAsync<{ weight: number; reps: number }>(
    `SELECT ls.weight_lbs AS weight, MAX(ls.reps) AS reps
     FROM logged_sets ls
     JOIN logged_exercises le ON ls.logged_exercise_id = le.id
     JOIN workouts w ON le.workout_id = w.id
     WHERE le.exercise_id = ?
       AND w.id != ?
       AND w.finished_at IS NOT NULL
       AND ls.is_completed = 1 AND ls.is_warmup = 0
       AND ls.weight_lbs IS NOT NULL AND ls.reps IS NOT NULL
     GROUP BY ls.weight_lbs`,
    [exerciseId, excludeWorkoutId]
  );
  return { maxWeight: row?.mw ?? null, maxReps: row?.mr ?? null, maxVolume: row?.mv ?? null, repsByWeight };
}

export async function getExercisePRs(exerciseId: number): Promise<ExercisePRs> {
  const db = await getDatabase();

  const maxWeightRow = await db.getFirstAsync<{ weight_lbs: number; reps: number; started_at: number }>(
    `SELECT ls.weight_lbs, ls.reps, w.started_at ${PR_BASE}
     ORDER BY ls.weight_lbs DESC, ls.reps DESC LIMIT 1`,
    [exerciseId]
  );

  const maxRepsRow = await db.getFirstAsync<{ weight_lbs: number; reps: number; started_at: number }>(
    `SELECT ls.weight_lbs, ls.reps, w.started_at ${PR_BASE}
     ORDER BY ls.reps DESC, ls.weight_lbs DESC LIMIT 1`,
    [exerciseId]
  );

  const maxVolumeRow = await db.getFirstAsync<{ weight_lbs: number; reps: number; started_at: number }>(
    `SELECT ls.weight_lbs, ls.reps, w.started_at ${PR_BASE}
     ORDER BY (ls.weight_lbs * ls.reps) DESC LIMIT 1`,
    [exerciseId]
  );

  const maxOneRMRow = await db.getFirstAsync<{ weight_lbs: number; reps: number; started_at: number }>(
    `SELECT ls.weight_lbs, ls.reps, w.started_at ${PR_BASE} AND ls.reps > 0
     ORDER BY ls.weight_lbs * (1.0 + ls.reps / 30.0) DESC LIMIT 1`,
    [exerciseId]
  );

  const lastRow = await db.getFirstAsync<{ t: number | null }>(
    `SELECT MAX(w.started_at) AS t ${PR_BASE}`,
    [exerciseId]
  );

  const toSet = (row: { weight_lbs: number; reps: number; started_at: number } | null): PRSet => ({
    weightLbs: row?.weight_lbs ?? null,
    reps: row?.reps ?? null,
    achievedAt: row ? row.started_at * 1000 : null,
  });

  return {
    maxWeight: toSet(maxWeightRow ?? null),
    maxReps: toSet(maxRepsRow ?? null),
    maxVolume: toSet(maxVolumeRow ?? null),
    maxOneRM: toSet(maxOneRMRow ?? null),
    lastTrainedAt: lastRow?.t ? lastRow.t * 1000 : null,
  };
}

// kept for potential future use — not used by ExerciseHistoryModal anymore
