export type ProgramExercise = {
  id: number;
  programDayId: number;
  exerciseId: number;
  exerciseName: string;
  muscleGroup: string;
  orderIndex: number;
  targetSets: number | null;
  targetReps: string | null;
  targetRpe: number | null;
};

export type ProgramDay = {
  id: number;
  programId: number;
  name: string;
  orderIndex: number;
  exercises: ProgramExercise[];
};

export type Program = {
  id: number;
  name: string;
  description: string | null;
  durationWeeks: number | null;
  createdAt: number;
  updatedAt: number;
  days: ProgramDay[];
};

export type ProgramSummary = {
  id: number;
  name: string;
  description: string | null;
  durationWeeks: number | null;
  dayCount: number;
  exerciseCount: number;
  updatedAt: number;
};
