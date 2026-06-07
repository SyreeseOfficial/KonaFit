export type GhostSet = {
  setNumber: number;
  weightLbs: number | null;
  reps: number | null;
};

export type ActiveSet = {
  localId: string;
  dbId?: number;
  setNumber: number;
  weightLbs: string;
  reps: string;
  rpe: string;
  isWarmup: boolean;
  isCompleted: boolean;
};

export type ActiveExercise = {
  localId: string;
  dbId?: number;
  exerciseId: number;
  exerciseName: string;
  muscleGroup: string;
  orderIndex: number;
  supersetId?: string;
  notes: string;
  sets: ActiveSet[];
  ghostSets: GhostSet[];
};

export type ActiveSession = {
  workoutId: number;
  startedAt: number;
  exercises: ActiveExercise[];
};

export type Exercise = {
  id: number;
  name: string;
  muscle_group: string;
  equipment_type: string;
  use_count: number;
};
