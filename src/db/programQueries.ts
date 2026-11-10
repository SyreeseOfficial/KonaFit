import { getDatabase } from "./database";
import { parseJson, isStringArray } from "../utils/safeJson";
import type { Program, ProgramDay, ProgramExercise, ProgramSummary } from "../types/program";

// ─── Programs ─────────────────────────────────────────────────────────────────

export async function getPrograms(): Promise<ProgramSummary[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: number; name: string; description: string | null;
    durationWeeks: number | null; programType: string; difficulty: string | null;
    focusTags: string | null; dayCount: number; exerciseCount: number; updatedAt: number;
  }>(
    `SELECT
       p.id, p.name, p.description,
       p.duration_weeks as durationWeeks,
       COALESCE(p.program_type, 'weekly') as programType,
       p.difficulty,
       p.focus_tags as focusTags,
       p.updated_at as updatedAt,
       COUNT(DISTINCT pd.id) as dayCount,
       COUNT(DISTINCT pe.id) as exerciseCount
     FROM programs p
     LEFT JOIN program_days pd ON pd.program_id = p.id
     LEFT JOIN program_exercises pe ON pe.program_day_id = pd.id
     WHERE (p.archived = 0 OR p.archived IS NULL)
     GROUP BY p.id
     ORDER BY p.updated_at DESC`
  );
  return rows.map((r) => ({
    ...r,
    programType: (r.programType || "weekly") as import("../types/program").ProgramType,
    focusTags: parseJson(r.focusTags, isStringArray, []),
  }));
}

export async function createProgram(
  name: string,
  opts?: {
    description?: string;
    durationWeeks?: number;
    programType?: string;
    workoutDurationMin?: number;
    focusTags?: string[];
    equipment?: string;
    difficulty?: string;
  }
): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    `INSERT INTO programs
       (name, description, duration_weeks, program_type, workout_duration_min, focus_tags, equipment, difficulty)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      name.trim(),
      opts?.description?.trim() ?? null,
      opts?.durationWeeks ?? null,
      opts?.programType ?? "weekly",
      opts?.workoutDurationMin ?? null,
      opts?.focusTags?.length ? JSON.stringify(opts.focusTags) : null,
      opts?.equipment ?? null,
      opts?.difficulty ?? null,
    ]
  );
  return result.lastInsertRowId;
}

export async function updateProgram(
  id: number,
  patch: { name?: string; description?: string; durationWeeks?: number }
): Promise<void> {
  const db = await getDatabase();
  const sets: string[] = ["updated_at = unixepoch()"];
  const args: (string | number | null)[] = [];
  if (patch.name !== undefined) { sets.push("name = ?"); args.push(patch.name.trim()); }
  if (patch.description !== undefined) { sets.push("description = ?"); args.push(patch.description.trim() || null); }
  if (patch.durationWeeks !== undefined) { sets.push("duration_weeks = ?"); args.push(patch.durationWeeks); }
  args.push(id);
  await db.runAsync(`UPDATE programs SET ${sets.join(", ")} WHERE id = ?`, args);
}

export async function deleteProgram(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM programs WHERE id = ?", [id]);
}

export async function archiveProgram(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("UPDATE programs SET archived = 1 WHERE id = ?", [id]);
}

export async function unarchiveProgram(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("UPDATE programs SET archived = 0 WHERE id = ?", [id]);
}

export async function getArchivedPrograms(): Promise<ProgramSummary[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: number; name: string; description: string | null;
    durationWeeks: number | null; programType: string; difficulty: string | null;
    focusTags: string | null; dayCount: number; exerciseCount: number; updatedAt: number;
  }>(
    `SELECT
       p.id, p.name, p.description,
       p.duration_weeks as durationWeeks,
       COALESCE(p.program_type, 'weekly') as programType,
       p.difficulty,
       p.focus_tags as focusTags,
       p.updated_at as updatedAt,
       COUNT(DISTINCT pd.id) as dayCount,
       COUNT(DISTINCT pe.id) as exerciseCount
     FROM programs p
     LEFT JOIN program_days pd ON pd.program_id = p.id
     LEFT JOIN program_exercises pe ON pe.program_day_id = pd.id
     WHERE p.archived = 1
     GROUP BY p.id
     ORDER BY p.updated_at DESC`
  );
  return rows.map((r) => ({
    ...r,
    programType: (r.programType || "weekly") as import("../types/program").ProgramType,
    focusTags: parseJson(r.focusTags, isStringArray, []),
  }));
}

export async function cloneProgram(id: number): Promise<number> {
  const db = await getDatabase();
  const original = await getProgramWithDays(id);
  if (!original) throw new Error("Program not found");

  const newId = await createProgram(`${original.name} (Copy)`, {
    description: original.description ?? undefined,
    durationWeeks: original.durationWeeks ?? undefined,
    programType: original.programType,
    workoutDurationMin: original.workoutDurationMin ?? undefined,
    focusTags: original.focusTags,
    equipment: original.equipment ?? undefined,
    difficulty: original.difficulty ?? undefined,
  });

  for (const day of original.days) {
    const newDayId = await createProgramDay(newId, day.name, day.orderIndex);
    for (const ex of day.exercises) {
      await addProgramExercise(
        newDayId, ex.exerciseId, ex.exerciseName, ex.muscleGroup,
        ex.orderIndex, ex.targetSets ?? undefined,
        ex.targetReps ?? undefined, ex.targetRpe ?? undefined
      );
    }
  }
  return newId;
}

// ─── Program with days (full detail load) ─────────────────────────────────────

export async function getProgramWithDays(id: number): Promise<Program | null> {
  const db = await getDatabase();

  const prog = await db.getFirstAsync<{
    id: number; name: string; description: string | null;
    duration_weeks: number | null; created_at: number; updated_at: number;
    program_type: string | null;
    workout_duration_min: number | null;
    focus_tags: string | null;
    equipment: string | null;
    difficulty: string | null;
  }>("SELECT * FROM programs WHERE id = ?", [id]);
  if (!prog) return null;

  const dayRows = await db.getAllAsync<{
    id: number; program_id: number; name: string; order_index: number;
  }>("SELECT * FROM program_days WHERE program_id = ? ORDER BY order_index ASC", [id]);

  const days: ProgramDay[] = await Promise.all(
    dayRows.map(async (d) => {
      const exercises = await getProgramDayExercises(d.id);
      return {
        id: d.id,
        programId: d.program_id,
        name: d.name,
        orderIndex: d.order_index,
        exercises,
      };
    })
  );

  return {
    id: prog.id,
    name: prog.name,
    description: prog.description,
    durationWeeks: prog.duration_weeks,
    programType: (prog.program_type ?? "weekly") as import("../types/program").ProgramType,
    workoutDurationMin: prog.workout_duration_min,
    focusTags: parseJson(prog.focus_tags, isStringArray, []),
    equipment: prog.equipment,
    difficulty: prog.difficulty,
    createdAt: prog.created_at,
    updatedAt: prog.updated_at,
    days,
  };
}

// ─── Days ─────────────────────────────────────────────────────────────────────

export async function createProgramDay(
  programId: number,
  name: string,
  orderIndex: number
): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    "INSERT INTO program_days (program_id, name, order_index) VALUES (?, ?, ?)",
    [programId, name.trim(), orderIndex]
  );
  await db.runAsync("UPDATE programs SET updated_at = unixepoch() WHERE id = ?", [programId]);
  return result.lastInsertRowId;
}

export async function deleteProgramDay(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM program_days WHERE id = ?", [id]);
}

// ─── Program exercises ────────────────────────────────────────────────────────

export async function getProgramDayExercises(dayId: number): Promise<ProgramExercise[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: number; program_day_id: number; exercise_id: number;
    exercise_name: string; muscle_group: string; order_index: number;
    target_sets: number | null; target_reps: string | null; target_rpe: number | null;
  }>(
    `SELECT pe.*, e.muscle_group
     FROM program_exercises pe
     JOIN exercises e ON pe.exercise_id = e.id
     WHERE pe.program_day_id = ?
     ORDER BY pe.order_index ASC`,
    [dayId]
  );
  return rows.map((r) => ({
    id: r.id,
    programDayId: r.program_day_id,
    exerciseId: r.exercise_id,
    exerciseName: r.exercise_name,
    muscleGroup: r.muscle_group,
    orderIndex: r.order_index,
    targetSets: r.target_sets,
    targetReps: r.target_reps,
    targetRpe: r.target_rpe,
  }));
}

export async function addProgramExercise(
  programDayId: number,
  exerciseId: number,
  exerciseName: string,
  muscleGroup: string,
  orderIndex: number,
  targetSets?: number,
  targetReps?: string,
  targetRpe?: number
): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    `INSERT INTO program_exercises
       (program_day_id, exercise_id, exercise_name, order_index, target_sets, target_reps, target_rpe)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [programDayId, exerciseId, exerciseName, orderIndex,
     targetSets ?? null, targetReps ?? null, targetRpe ?? null]
  );
  return result.lastInsertRowId;
}

export async function updateProgramExercise(
  id: number,
  patch: { targetSets?: number | null; targetReps?: string | null; targetRpe?: number | null }
): Promise<void> {
  const db = await getDatabase();
  const sets: string[] = [];
  const args: (number | string | null)[] = [];
  if ("targetSets" in patch) { sets.push("target_sets = ?"); args.push(patch.targetSets ?? null); }
  if ("targetReps" in patch) { sets.push("target_reps = ?"); args.push(patch.targetReps ?? null); }
  if ("targetRpe" in patch) { sets.push("target_rpe = ?"); args.push(patch.targetRpe ?? null); }
  if (sets.length === 0) return;
  args.push(id);
  await db.runAsync(`UPDATE program_exercises SET ${sets.join(", ")} WHERE id = ?`, args);
}

export async function createProgramFromWorkout(
  workoutId: number,
  programName: string
): Promise<number> {
  const db = await getDatabase();
  let programId = 0;
  // One transaction: a failure must not leave an empty program behind.
  await db.withTransactionAsync(async () => {
    const progResult = await db.runAsync(
      "INSERT INTO programs (name) VALUES (?)",
      [programName.trim()]
    );
    programId = progResult.lastInsertRowId;

    const dayResult = await db.runAsync(
      "INSERT INTO program_days (program_id, name, order_index) VALUES (?, 'Day A', 0)",
      [programId]
    );

    // At least 1 set per exercise, even if none were ticked.
    await db.runAsync(
      `INSERT INTO program_exercises (program_day_id, exercise_id, exercise_name, order_index, target_sets)
       SELECT
         ? as program_day_id,
         le.exercise_id,
         le.exercise_name,
         le.order_index,
         MAX(1, COUNT(CASE WHEN ls.is_completed = 1 AND ls.is_warmup = 0 THEN 1 END)) as target_sets
       FROM logged_exercises le
       LEFT JOIN logged_sets ls ON ls.logged_exercise_id = le.id
       WHERE le.workout_id = ?
       GROUP BY le.id
       ORDER BY le.order_index`,
      [dayResult.lastInsertRowId, workoutId]
    );
  });

  return programId;
}

export async function getLastUsedDatesByDay(
  programId: number
): Promise<Record<number, number>> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ day_id: number; last_used: number }>(
    `SELECT pd.id as day_id, MAX(w.started_at) as last_used
     FROM program_days pd
     JOIN workouts w ON w.program_day_id = pd.id AND w.finished_at IS NOT NULL
     WHERE pd.program_id = ?
     GROUP BY pd.id`,
    [programId]
  );
  return Object.fromEntries(rows.map((r) => [r.day_id, r.last_used]));
}

export async function deleteProgramExercise(id: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM program_exercises WHERE id = ?", [id]);
}
