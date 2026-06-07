import { getDatabase } from "./database";

export type WorkoutSummary = {
  id: number;
  name: string;
  started_at: number;
  finished_at: number;
  duration_seconds: number;
  exercise_count: number;
  set_count: number;
  total_volume: number;
};

export type SetRecord = {
  id: number;
  set_number: number;
  weight_lbs: number | null;
  reps: number | null;
  rpe: number | null;
  is_warmup: number;
  is_completed: number;
};

export type ExerciseRecord = {
  id: number;
  exercise_name: string;
  muscle_group: string;
  order_index: number;
  sets: SetRecord[];
};

export type WorkoutDetail = {
  id: number;
  name: string;
  started_at: number;
  finished_at: number;
  duration_seconds: number;
  exercises: ExerciseRecord[];
  totalVolume: number;
};

export async function getWorkoutHistory(limit = 20): Promise<WorkoutSummary[]> {
  const db = await getDatabase();
  return db.getAllAsync<WorkoutSummary>(
    `SELECT
       w.id, w.name, w.started_at, w.finished_at,
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

export async function getWorkoutDetail(workoutId: number): Promise<WorkoutDetail | null> {
  const db = await getDatabase();

  const workout = await db.getFirstAsync<{
    id: number; name: string; started_at: number;
    finished_at: number; duration_seconds: number;
  }>(
    "SELECT * FROM workouts WHERE id = ?",
    [workoutId]
  );
  if (!workout) return null;

  const exerciseRows = await db.getAllAsync<{
    id: number; exercise_name: string; muscle_group: string; order_index: number;
  }>(
    `SELECT le.id, le.exercise_name, COALESCE(e.muscle_group, '') as muscle_group, le.order_index
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
        `SELECT id, set_number, weight_lbs, reps, rpe, is_warmup, is_completed
         FROM logged_sets WHERE logged_exercise_id = ? ORDER BY set_number ASC`,
        [ex.id]
      );
      sets.forEach((s) => {
        if (s.is_completed && s.weight_lbs && s.reps) {
          totalVolume += s.weight_lbs * s.reps;
        }
      });
      return { ...ex, sets };
    })
  );

  return {
    id: workout.id,
    name: workout.name,
    started_at: workout.started_at,
    finished_at: workout.finished_at,
    duration_seconds: workout.duration_seconds ?? 0,
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
  is_warmup: string;
  is_completed: string;
};

export async function getAllWorkoutDataForExport(): Promise<CsvRow[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    started_at: number; duration_seconds: number | null; workout_id: number;
    exercise_name: string; muscle_group: string;
    set_number: number; weight_lbs: number | null; reps: number | null;
    rpe: number | null; is_warmup: number; is_completed: number;
  }>(
    `SELECT
       w.started_at, w.duration_seconds, w.id as workout_id,
       le.exercise_name,
       COALESCE(e.muscle_group, '') as muscle_group,
       ls.set_number, ls.weight_lbs, ls.reps, ls.rpe,
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
      date: d.toISOString().slice(0, 10),
      time: d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      duration_min: Math.round((r.duration_seconds ?? 0) / 60),
      workout_id: r.workout_id,
      exercise: r.exercise_name,
      muscle_group: r.muscle_group,
      set_number: r.set_number,
      weight_lbs: r.weight_lbs,
      reps: r.reps,
      rpe: r.rpe,
      is_warmup: r.is_warmup ? "Yes" : "No",
      is_completed: r.is_completed ? "Yes" : "No",
    };
  });
}
