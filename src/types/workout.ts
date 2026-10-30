export type GhostSet = {
  setNumber: number;
  weightLbs: number | null;
  reps: number | null;
  rpe?: number | null; // absent in sessions cached before overload hints
  at?: number; // unix secs of the workout it came from
};

export type SetType = "drop" | "failure" | "amrap" | "backoff" | "myo";

export type PRBadge = "W" | "R" | "V" | "F"; // Weight, Reps, Volume, First time

export type ActiveSet = {
  localId: string;
  dbId?: number;
  setNumber: number;
  weightLbs: string;
  reps: string;
  rpe: string;
  notes?: string; // optional: sessions cached before per-set notes lack it
  isWarmup: boolean;
  setType?: SetType; // absent = normal working set
  isCompleted: boolean;
  prBadges?: PRBadge[];
  isGhostFilled?: boolean;
};

export type HistPRs = {
  maxWeight: number | null;
  maxReps: number | null;
  maxVolume: number | null;
  repsByWeight?: { weight: number; reps: number }[]; // best reps at each weight; missing in older cached sessions
  bodyweightLbs?: number; // latest bodyweight, added to bodyweight-exercise load for volume PRs; missing in older cached sessions
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
  isDone?: boolean; // manually marked finished (e.g. skipped sets); absent in older cached sessions
  sets: ActiveSet[];
  ghostSets: GhostSet[];
  histPRs: HistPRs;
  perHand?: boolean; // logged weight is one hand's; volume counts it twice
  targetReps?: string | null; // from the program day, e.g. "8-10"
  targetRpe?: number | null;
  isBodyweight?: boolean; // weight is added load on top of bodyweight and may be negative (assisted); absent in older cached sessions
};

export type ActiveSession = {
  workoutId: number;
  startedAt: number;
  exercises: ActiveExercise[];
};

export type Exercise = {
  id: number;
  name: string;
  muscle_group: string;   // comma-separated, e.g. "Chest, Front Delts"
  equipment_type: string; // comma-separated, e.g. "Barbell, Dumbbell"
  target_type: string;    // 'reps' | 'time' | 'distance' | 'weight' | 'calories'
  use_count: number;
  is_custom: number;      // 0 = default seed, 1 = user-created
};
