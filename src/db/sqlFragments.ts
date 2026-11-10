import { MAX_1RM_REPS } from "../utils/oneRm";

/**
 * Shared SQL snippets: the one definition of "how heavy is a set" and "what counts" for every stat, PR and goal.
 * Each takes table aliases (defaults `ls` = logged_sets, `le` = logged_exercises, `w` = workouts) and returns a string
 * to splice into a query. Never re-write these rules inline; a test checks stats, history, detail, trend and muscle volume agree.
 *
 * | Fragment                | What it is                                                | Used in                                   |
 * |-------------------------|-----------------------------------------------------------|-------------------------------------------|
 * | `LATEST_BODYWEIGHT_SQL` | latest logged bodyweight (lbs) or NULL                    | `setLoadSql`; historyQueries (bw_lbs)     |
 * | `isBodyweightSql`       | 1 when the exercise's equipment is bodyweight             | `setLoadSql`, `prVolumeSql`; blank-weight default in workoutQueries (`upsertLoggedSet`); historyQueries (`is_bodyweight`) |
 * | `setLoadSql`            | effective lbs: logged weight (+ bodyweight if BW exercise)| goalQueries, historyQueries (PRs), statsQueries (1RM trend), `setVolumeSql` |
 * | `oneRmSql`              | Epley 1RM from a load expr + reps expr                    | goalQueries (1RM goals), historyQueries, statsQueries |
 * | `workingSetSql`         | WHERE clause: ticked, non-warm-up, has weight and reps    | every volume / PR / stats query (stats, history, insight, goal, boxingStats) |
 * | `handsSql`              | 2 for per-hand exercises, else 1                          | `setVolumeSql`                            |
 * | `setVolumeSql`          | load x reps x hands for one set                           | statsQueries, insightQueries, historyQueries |
 * | `prVolumeSql`           | PR score: volume, but BW sets score at least their reps   | historyQueries (PR ranking)               |
 *
 * Rule of thumb: need a weight number -> `setLoadSql`; need "which sets count" -> `workingSetSql`; need a total -> `setVolumeSql`.
 */

/** Latest logged bodyweight in lbs, NULL when nothing is logged. */
export const LATEST_BODYWEIGHT_SQL =
  "(SELECT weight_lbs FROM bodyweight_logs ORDER BY logged_at DESC, id DESC LIMIT 1)";

/** True when the exercise is logged as "added load" on top of bodyweight (pull-ups, dips, push-ups). */
export const isBodyweightSql = (le = "le") =>
  `COALESCE((SELECT LOWER(x.equipment_type) LIKE '%bodyweight%' FROM exercises x WHERE x.id = ${le}.exercise_id), 0)`;

/**
 * Effective load of a set in lbs. Bodyweight exercises log only the added weight (negative when assisted),
 * so the lifter's latest bodyweight is added; never below 0.
 * ponytail: uses the latest bodyweight for all history, not the weight at the time; store it per workout if that matters.
 */
export const setLoadSql = (ls = "ls", le = "le") =>
  `MAX(0, ${ls}.weight_lbs + CASE WHEN ${isBodyweightSql(le)} THEN COALESCE(${LATEST_BODYWEIGHT_SQL}, 0) ELSE 0 END)`;

/** Estimated 1RM (Epley, reps capped at MAX_1RM_REPS). Keep in sync with `estimateOneRm` in utils/oneRm.ts. */
export const oneRmSql = (load: string, reps: string) => `(${load} * (1.0 + MIN(${reps}, ${MAX_1RM_REPS}) / 30.0))`;

/**
 * The one rule for what counts as volume and PRs: a ticked, non-warm-up set with weight and reps.
 * Callers also join `workouts w` and require `w.finished_at IS NOT NULL` (in-progress workouts never count).
 */
export const workingSetSql = (ls = "ls") =>
  `${ls}.is_completed = 1 AND ${ls}.is_warmup = 0 AND ${ls}.weight_lbs IS NOT NULL AND ${ls}.reps IS NOT NULL`;

/** Per-hand exercises (dumbbells, kettlebells) log one hand's weight; a rep moves it twice. */
export const handsSql = (le = "le") =>
  `(CASE WHEN COALESCE((SELECT x.per_hand FROM exercises x WHERE x.id = ${le}.exercise_id), 0) = 1 THEN 2 ELSE 1 END)`;

/** Volume of one set: effective load x reps (x2 when per hand). Only meaningful for rows matching `workingSetSql`. */
export const setVolumeSql = (ls = "ls", le = "le") => `${setLoadSql(ls, le)} * ${ls}.reps * ${handsSql(le)}`;

/**
 * PR score of a set: its volume, except bodyweight sets always score at least their reps
 * (added load 0 would otherwise make every rep PR worth 0). Mirrored live by `volumeScore` in utils/prBadges.ts.
 */
export const prVolumeSql = (ls = "ls", le = "le") =>
  `CASE WHEN ${isBodyweightSql(le)} THEN MAX(1, ${setLoadSql(ls, le)}) ELSE ${ls}.weight_lbs END * ${ls}.reps`;
