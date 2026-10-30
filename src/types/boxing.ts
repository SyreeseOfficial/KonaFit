/** Work/rest shape of a boxing session (what "6 x 3:00 / 1:00" means). */
export type BoxingPlan = { rounds: number; workSec: number; restSec: number };

export type BoxingSetup = BoxingPlan & { getReadySec: number };

export type BoxingRound = {
  roundNumber: number;
  rpe: number | null;
  /** boxing_focus_chips ids */
  focusTags: number[];
  focusNote: string | null;
  workSeconds: number;
  restSeconds: number;
  /** What actually happened when it differs from the plan (+30s, skipped rest, ended early). */
  actualWorkSeconds: number | null;
  actualRestSeconds: number | null;
};

export type BoxingSession = {
  id?: number;
  name: string;
  /** unix seconds */
  startedAt: number;
  finishedAt: number;
  /** Active time in seconds (pauses excluded). */
  durationSeconds: number;
  rpe: number | null;
  /** Heavy bag, Shadowboxing, Drills, Skipping */
  tags: string[];
  notes: string | null;
  rounds: BoxingRound[];
};

export type FocusChip = {
  id: number;
  name: string;
  group: string;
  isDefault: boolean;
  isHidden: boolean;
  order: number;
};
