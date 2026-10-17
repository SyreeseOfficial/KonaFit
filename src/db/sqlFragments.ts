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
