import * as SQLite from "expo-sqlite";

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync("konafit.db");
  return db;
}

// Numbered migrations, tracked by PRAGMA user_version. Append only; never edit a shipped one.
// Installs that predate versioning already have these columns, so ALTERs check table_info first.
async function addColumn(database: SQLite.SQLiteDatabase, table: string, column: string, def: string) {
  const cols = await database.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  if (!cols.some((c) => c.name === column)) {
    await database.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
  }
}

const MIGRATIONS: ((database: SQLite.SQLiteDatabase) => Promise<void>)[] = [
  // 1: columns added after the initial schema + one-time backfill of is_completed
  async (database) => {
    await addColumn(database, "exercises", "target_type", "TEXT NOT NULL DEFAULT 'reps'");
    await addColumn(database, "lifestyle_logs", "caffeine_mg", "INTEGER NOT NULL DEFAULT 0");
    await addColumn(database, "programs", "program_type", "TEXT NOT NULL DEFAULT 'weekly'");
    await addColumn(database, "programs", "workout_duration_min", "INTEGER");
    await addColumn(database, "programs", "focus_tags", "TEXT");
    await addColumn(database, "programs", "equipment", "TEXT");
    await addColumn(database, "programs", "difficulty", "TEXT");
    await addColumn(database, "programs", "archived", "INTEGER NOT NULL DEFAULT 0");
    await addColumn(database, "exercises", "is_custom", "INTEGER NOT NULL DEFAULT 0");
    await addColumn(database, "goals", "target_reps", "INTEGER");
    await addColumn(database, "exercises", "is_deleted", "INTEGER NOT NULL DEFAULT 0");
    await addColumn(database, "exercises", "notes", "TEXT");
    await addColumn(database, "workouts", "program_day_id", "INTEGER REFERENCES program_days(id) ON DELETE SET NULL");
    // Backfill runs once here; running it every launch re-completed sets users had un-checked.
    await database.execAsync(
      `UPDATE logged_sets SET is_completed = 1
       WHERE is_completed = 0
         AND weight_lbs IS NOT NULL AND reps IS NOT NULL AND reps > 0
         AND logged_exercise_id IN (
           SELECT le.id FROM logged_exercises le
           JOIN workouts w ON le.workout_id = w.id
           WHERE w.finished_at IS NOT NULL
         )`
    );
  },
  // 2: exercises_fts was never queried (search uses LIKE)
  async (database) => {
    await database.execAsync("DROP TABLE IF EXISTS exercises_fts");
  },
  // 3: per-set notes
  async (database) => {
    await addColumn(database, "logged_sets", "notes", "TEXT");
  },
  // 4: bodyweight sets with reps but a blank weight now store 0 added load (they used to be NULL and counted for nothing)
  async (database) => {
    await database.execAsync(
      `UPDATE logged_sets SET weight_lbs = 0
       WHERE weight_lbs IS NULL AND reps IS NOT NULL
         AND logged_exercise_id IN (
           SELECT le.id FROM logged_exercises le
           JOIN exercises x ON x.id = le.exercise_id
           WHERE LOWER(x.equipment_type) LIKE '%bodyweight%'
         )`
    );
  },
  // 5: when each set was ticked (true workout length), and where a bodyweight goal started (progress + cut/bulk direction)
  async (database) => {
    await addColumn(database, "logged_sets", "completed_at", "INTEGER");
    await addColumn(database, "goals", "start_value", "REAL");
    await addColumn(database, "goals", "direction", "TEXT");
    await database.execAsync(
      `UPDATE goals SET start_value = (
         SELECT b.weight_lbs FROM bodyweight_logs b WHERE b.logged_at <= goals.created_at ORDER BY b.logged_at DESC, b.id DESC LIMIT 1
       ) WHERE type = 'bodyweight' AND start_value IS NULL;
       UPDATE goals SET direction = CASE WHEN target_value < start_value THEN 'down' ELSE 'up' END
       WHERE type = 'bodyweight' AND start_value IS NOT NULL AND target_value IS NOT NULL AND direction IS NULL;`
    );
  },
  // 6: indexes for history, PR and ghost-set lookups
  async (database) => {
    await database.execAsync(
      `CREATE INDEX IF NOT EXISTS idx_le_exercise ON logged_exercises(exercise_id);
       CREATE INDEX IF NOT EXISTS idx_le_workout ON logged_exercises(workout_id);
       CREATE INDEX IF NOT EXISTS idx_ls_exercise ON logged_sets(logged_exercise_id);
       CREATE INDEX IF NOT EXISTS idx_workouts_finished ON workouts(finished_at);`
    );
  },
  // 7: progress_photos.photo_uri keeps only the file name; the folder is rebuilt at read time (full paths break when the app container moves)
  async (database) => {
    const rows = await database.getAllAsync<{ id: number; photo_uri: string }>("SELECT id, photo_uri FROM progress_photos");
    for (const r of rows) {
      const name = r.photo_uri.split("/").pop() ?? r.photo_uri;
      if (name !== r.photo_uri) await database.runAsync("UPDATE progress_photos SET photo_uri = ? WHERE id = ?", [name, r.id]);
    }
  },
  // 8: which app version / when a workout was created, for bug reports
  async (database) => {
    await addColumn(database, "workouts", "app_version", "TEXT");
    await addColumn(database, "workouts", "created_at", "INTEGER");
    await database.execAsync("UPDATE workouts SET created_at = started_at WHERE created_at IS NULL");
  },
  // 9: when an exercise was soft-deleted, so old ones with no history can be purged. Existing ones start their 30 days now.
  async (database) => {
    await addColumn(database, "exercises", "deleted_at", "INTEGER");
    await database.execAsync("UPDATE exercises SET deleted_at = unixepoch() WHERE is_deleted = 1 AND deleted_at IS NULL");
  },
  // 10: how the workout felt (1-5 each) and last night's sleep
  async (database) => {
    await addColumn(database, "workouts", "rating", "INTEGER");
    await addColumn(database, "workouts", "energy", "INTEGER");
    await addColumn(database, "workouts", "sleep_hours", "REAL");
  },
  // 11: seconds rested before each set, and a start/pause/resume/finish log per workout
  async (database) => {
    await addColumn(database, "logged_sets", "rest_seconds", "INTEGER");
    await database.execAsync(
      `CREATE TABLE IF NOT EXISTS session_events (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
         type TEXT NOT NULL,
         at INTEGER NOT NULL DEFAULT (unixepoch())
       );
       CREATE INDEX IF NOT EXISTS idx_se_workout ON session_events(workout_id);`
    );
  },
  // 12: set types (drop, failure, AMRAP...), per-hand dumbbell/kettlebell weights, daily readiness check-ins
  async (database) => {
    await addColumn(database, "logged_sets", "set_type", "TEXT");
    await addColumn(database, "exercises", "per_hand", "INTEGER NOT NULL DEFAULT 0");
    await database.execAsync(
      `CREATE TABLE IF NOT EXISTS readiness_checkins (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         day TEXT NOT NULL UNIQUE,
         sleep INTEGER NOT NULL,
         soreness INTEGER NOT NULL,
         mood INTEGER NOT NULL,
         created_at INTEGER NOT NULL DEFAULT (unixepoch())
       );`
    );
  },
  // 13: activity type on workouts ('lift' | 'boxing'; old rows are lifts), session RPE and tags. duration_seconds and notes already exist.
  async (database) => {
    await addColumn(database, "workouts", "type", "TEXT NOT NULL DEFAULT 'lift'");
    await addColumn(database, "workouts", "rpe", "INTEGER");
    await addColumn(database, "workouts", "session_tags", "TEXT");
    await database.execAsync("CREATE INDEX IF NOT EXISTS idx_workouts_type_finished ON workouts(type, finished_at)");
  },
  // 14: boxing rounds (one row per round of a boxing workout) and the focus chips used to tag them
  async (database) => {
    await database.execAsync(
      `CREATE TABLE IF NOT EXISTS boxing_rounds (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
         round_number INTEGER NOT NULL,
         rpe INTEGER,
         focus_tags TEXT,
         focus_note TEXT,
         work_seconds INTEGER NOT NULL,
         rest_seconds INTEGER NOT NULL,
         actual_work_seconds INTEGER,
         actual_rest_seconds INTEGER
       );
       CREATE INDEX IF NOT EXISTS idx_br_workout ON boxing_rounds(workout_id);
       CREATE TABLE IF NOT EXISTS boxing_focus_chips (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         name TEXT NOT NULL,
         group_name TEXT NOT NULL,
         is_default INTEGER NOT NULL DEFAULT 0,
         is_hidden INTEGER NOT NULL DEFAULT 0,
         order_index INTEGER NOT NULL DEFAULT 0
       );`
    );
    await seedBoxingChips(database);
  },
  // 15: goals can have a date range (boxing goals: a fight camp, 8 weeks); null = open-ended like the older goal types
  async (database) => {
    await addColumn(database, "goals", "start_date", "INTEGER");
    await addColumn(database, "goals", "end_date", "INTEGER");
  },
  // 16: time / distance / calories exercises log their own values (distance in miles); weight_lbs and reps stay null for them
  async (database) => {
    await addColumn(database, "logged_sets", "duration_sec", "INTEGER");
    await addColumn(database, "logged_sets", "distance_mi", "REAL");
    await addColumn(database, "logged_sets", "calories", "INTEGER");
  },
];

export const DEFAULT_BOXING_CHIPS: [group: string, names: string[]][] = [
  ["Punches", ["Jab", "Cross", "Hooks", "Uppercuts"]],
  ["Movement", ["Footwork", "Head movement", "Defense"]],
  ["Intent", ["Power", "Speed", "Endurance"]],
  ["Technical", ["Combos", "Counters", "Body shots"]],
];

/** Inserts the 13 default chips; does nothing if the table already has rows. */
export async function seedBoxingChips(database: SQLite.SQLiteDatabase) {
  const row = await database.getFirstAsync<{ n: number }>("SELECT COUNT(*) n FROM boxing_focus_chips");
  if (row && row.n > 0) return;
  let order = 0;
  for (const [group, names] of DEFAULT_BOXING_CHIPS) {
    for (const name of names) {
      await database.runAsync(
        "INSERT INTO boxing_focus_chips (name, group_name, is_default, order_index) VALUES (?, ?, 1, ?)",
        [name, group, order++]
      );
    }
  }
}

async function runMigrations(database: SQLite.SQLiteDatabase) {
  const row = await database.getFirstAsync<{ user_version: number }>("PRAGMA user_version");
  const current = row?.user_version ?? 0;
  for (let v = current; v < MIGRATIONS.length; v++) {
    try {
      await database.withTransactionAsync(async () => {
        await MIGRATIONS[v](database);
        await database.execAsync(`PRAGMA user_version = ${v + 1}`);
      });
    } catch (e) {
      console.error(`DB migration ${v + 1} failed`, e);
      throw e;
    }
  }
}

export async function initializeDatabase(): Promise<void> {
  const database = await getDatabase();

  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS kv_store (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      muscle_group TEXT NOT NULL,
      equipment_type TEXT NOT NULL DEFAULT 'barbell',
      use_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS workouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL DEFAULT 'Workout',
      started_at INTEGER NOT NULL DEFAULT (unixepoch()),
      finished_at INTEGER,
      duration_seconds INTEGER,
      location TEXT,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS logged_exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
      exercise_id INTEGER NOT NULL REFERENCES exercises(id),
      exercise_name TEXT NOT NULL,
      order_index INTEGER NOT NULL DEFAULT 0,
      superset_id TEXT,
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS logged_sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      logged_exercise_id INTEGER NOT NULL REFERENCES logged_exercises(id) ON DELETE CASCADE,
      set_number INTEGER NOT NULL,
      weight_lbs REAL,
      reps INTEGER,
      rpe REAL,
      is_warmup INTEGER NOT NULL DEFAULT 0,
      is_completed INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS programs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      duration_weeks INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS program_days (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      program_id INTEGER NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      order_index INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS program_exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      program_day_id INTEGER NOT NULL REFERENCES program_days(id) ON DELETE CASCADE,
      exercise_id INTEGER NOT NULL REFERENCES exercises(id),
      exercise_name TEXT NOT NULL,
      order_index INTEGER NOT NULL DEFAULT 0,
      target_sets INTEGER,
      target_reps TEXT,
      target_rpe REAL,
      superset_id TEXT
    );

    CREATE TABLE IF NOT EXISTS bodyweight_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      weight_lbs REAL NOT NULL,
      logged_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    -- Unused: the hydration/pre-workout screens were removed. Kept (and still wiped) so existing logs aren't dropped.
    CREATE TABLE IF NOT EXISTS lifestyle_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      logged_at INTEGER NOT NULL DEFAULT (unixepoch()),
      hydration_oz REAL,
      pre_workout INTEGER NOT NULL DEFAULT 0,
      location TEXT
    );

    CREATE TABLE IF NOT EXISTS progress_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workout_id INTEGER REFERENCES workouts(id) ON DELETE SET NULL,
      photo_uri TEXT NOT NULL,
      taken_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      use_count INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      exercise_id INTEGER REFERENCES exercises(id) ON DELETE SET NULL,
      exercise_name TEXT,
      target_value REAL,
      notes TEXT,
      is_achieved INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      achieved_at INTEGER
    );
  `);

  await runMigrations(database);

  await seedDefaultExercises(database);
  await seedExpandedExercises(database);
}

// ─── Master exercise list ─────────────────────────────────────────────────────
// [name, muscle_group, equipment_type]
// muscle_group matches AddExerciseSheet filter options for proper filtering; an exercise that
// trains two groups lists both ("Hamstrings, Lower Back") rather than appearing twice. Names must be unique.
// All default to target_type = 'reps' via column default.

const ALL_EXERCISES: [string, string, string][] = [
  // ── CHEST ──────────────────────────────────────────────────────────────────
  ["Barbell Bench Press",           "Chest", "barbell"],
  ["Incline Barbell Bench Press",   "Chest", "barbell"],
  ["Decline Barbell Bench Press",   "Chest", "barbell"],
  ["Incline Dumbbell Press",        "Chest", "dumbbell"],
  ["Flat Dumbbell Press",           "Chest", "dumbbell"],
  ["Decline Dumbbell Press",        "Chest", "dumbbell"],
  ["Dumbbell Fly",                  "Chest", "dumbbell"],
  ["Cable Fly",                     "Chest", "cable"],
  ["Incline Cable Fly",             "Chest", "cable"],
  ["Decline Cable Fly",             "Chest", "cable"],
  ["Low Cable Fly",                 "Chest", "cable"],
  ["Cable Crossover",               "Chest", "cable"],
  ["Pec Deck Machine",              "Chest", "machine"],
  ["Machine Chest Press",           "Chest", "machine"],
  ["Smith Machine Bench Press",     "Chest", "machine"],
  ["Dip",                           "Chest", "bodyweight"],
  ["Push-Up",                       "Chest", "bodyweight"],
  ["Wide Push-Up",                  "Chest", "bodyweight"],
  ["Archer Push-Up",                "Chest", "bodyweight"],
  ["Ring Push-Up",                  "Chest", "bodyweight"],
  ["Weighted Push-Up",              "Chest", "bodyweight"],
  ["Landmine Press",                "Chest", "barbell"],
  ["Svend Press",                   "Chest", "weight plates"],

  // ── LATS ───────────────────────────────────────────────────────────────────
  ["Pull-Up",                       "Lats", "bodyweight"],
  ["Chin-Up",                       "Lats", "bodyweight"],
  ["Neutral-Grip Pull-Up",          "Lats", "bodyweight"],
  ["Inverted Row",                  "Lats", "bodyweight"],
  ["Weighted Pull-Up",              "Lats", "bodyweight"],
  ["Lat Pulldown",                  "Lats", "cable"],
  ["Close-Grip Lat Pulldown",       "Lats", "cable"],
  ["Single-Arm Cable Row",          "Lats", "cable"],
  ["Wide-Grip Seated Cable Row",    "Lats", "cable"],
  ["Straight-Arm Pulldown",         "Lats", "cable"],
  ["Cable Row",                     "Lats", "cable"],
  ["Barbell Row",                   "Lats", "barbell"],
  ["Pendlay Row",                   "Lats", "barbell"],
  ["T-Bar Row",                     "Lats", "barbell"],
  ["Meadows Row",                   "Lats", "barbell"],
  ["Seal Row",                      "Lats", "barbell"],
  ["Single-Arm Dumbbell Row",       "Lats", "dumbbell"],
  ["Chest-Supported Dumbbell Row",  "Lats", "dumbbell"],
  ["Renegade Row",                  "Lats", "dumbbell"],
  ["Machine Row",                   "Lats", "machine"],
  ["Rack Pull",                     "Lats", "barbell"],
  ["Snatch-Grip Deadlift",          "Lats", "barbell"],
  ["Jefferson Curl",                "Lats", "barbell"],

  // ── UPPER BACK ─────────────────────────────────────────────────────────────
  ["Barbell Shrug",                 "Upper Back", "barbell"],
  ["Dumbbell Shrug",                "Upper Back", "dumbbell"],
  ["Trap Bar Shrug",                "Upper Back", "barbell"],
  ["Behind-the-Neck Pulldown",      "Upper Back", "cable"],
  ["Prone Y Raise",                 "Upper Back", "dumbbell"],
  ["Prone T Raise",                 "Upper Back", "dumbbell"],
  ["Prone W Raise",                 "Upper Back", "dumbbell"],
  ["Band Pull-Apart",               "Upper Back", "resistance bands"],

  // ── LOWER BACK ─────────────────────────────────────────────────────────────
  ["Deadlift",                      "Lower Back", "barbell"],
  ["Sumo Deadlift",                 "Lower Back", "barbell"],
  ["Trap Bar Deadlift",             "Lower Back", "barbell"],
  ["Back Extension",                "Lower Back", "bodyweight"],
  ["45-Degree Back Extension",      "Lower Back", "machine"],
  ["Reverse Hyperextension",        "Lower Back", "machine"],

  // ── REAR DELTS ─────────────────────────────────────────────────────────────
  ["Face Pull",                     "Rear Delts", "cable"],
  ["Dumbbell Rear Delt Fly",        "Rear Delts", "dumbbell"],
  ["Cable Rear Delt Fly",           "Rear Delts", "cable"],
  ["Reverse Pec Deck",              "Rear Delts", "machine"],
  ["Dumbbell Rear Delt Row",        "Rear Delts", "dumbbell"],
  ["Wide-Grip Cable Pull",          "Rear Delts", "cable"],

  // ── MID DELTS ──────────────────────────────────────────────────────────────
  ["Overhead Press",                "Mid Delts", "barbell"],
  ["Dumbbell Shoulder Press",       "Mid Delts", "dumbbell"],
  ["Arnold Press",                  "Mid Delts", "dumbbell"],
  ["Lateral Raise",                 "Mid Delts", "dumbbell"],
  ["Cable Lateral Raise",           "Mid Delts", "cable"],
  ["Machine Lateral Raise",         "Mid Delts", "machine"],
  ["Machine Shoulder Press",        "Mid Delts", "machine"],
  ["Smith Machine Overhead Press",  "Mid Delts", "machine"],
  ["Push Press",                    "Mid Delts", "barbell"],
  ["Behind-the-Neck Press",         "Mid Delts", "barbell"],
  ["Bradford Press",                "Mid Delts", "barbell"],
  ["Z-Press",                       "Mid Delts", "barbell"],
  ["Upright Row",                   "Mid Delts", "barbell"],
  ["Log Press",                     "Mid Delts", "other"],
  ["Viking Press",                  "Mid Delts", "other"],
  ["Klokov Press",                  "Mid Delts", "barbell"],
  ["Plate Raise",                   "Mid Delts", "weight plates"],

  // ── FRONT DELTS ────────────────────────────────────────────────────────────
  ["Front Raise",                   "Front Delts", "dumbbell"],
  ["Cable Front Raise",             "Front Delts", "cable"],
  ["Plate Front Raise",             "Front Delts", "weight plates"],
  ["Barbell Front Raise",           "Front Delts", "barbell"],
  ["Landmine Lateral Raise",        "Front Delts", "barbell"],

  // ── BICEPS ─────────────────────────────────────────────────────────────────
  ["Dumbbell Curl",                 "Biceps", "dumbbell"],
  ["Barbell Curl",                  "Biceps", "barbell"],
  ["EZ-Bar Curl",                   "Biceps", "barbell"],
  ["Hammer Curl",                   "Biceps", "dumbbell"],
  ["Incline Dumbbell Curl",         "Biceps", "dumbbell"],
  ["Spider Curl",                   "Biceps", "dumbbell"],
  ["Prone Incline Curl",            "Biceps", "dumbbell"],
  ["Concentration Curl",            "Biceps", "dumbbell"],
  ["Cross-Body Hammer Curl",        "Biceps", "dumbbell"],
  ["Zottman Curl",                  "Biceps", "dumbbell"],
  ["Dumbbell Scott Curl",           "Biceps", "dumbbell"],
  ["Cable Curl",                    "Biceps", "cable"],
  ["Cable Hammer Curl",             "Biceps", "cable"],
  ["Bayesian Curl",                 "Biceps", "cable"],
  ["Preacher Curl",                 "Biceps", "barbell"],
  ["Reverse Curl",                  "Biceps, Forearms", "barbell"],
  ["Drag Curl",                     "Biceps", "barbell"],
  ["21s",                           "Biceps", "barbell"],
  ["Cheat Curl",                    "Biceps", "barbell"],
  ["Machine Curl",                  "Biceps", "machine"],
  ["TRX Curl",                      "Biceps", "bodyweight"],

  // ── TRICEPS ────────────────────────────────────────────────────────────────
  ["Tricep Pushdown",               "Triceps", "cable"],
  ["Rope Pushdown",                 "Triceps", "cable"],
  ["Single-Arm Cable Pushdown",     "Triceps", "cable"],
  ["Overhead Cable Tricep Extension","Triceps", "cable"],
  ["Reverse-Grip Pushdown",         "Triceps", "cable"],
  ["Skullcrusher",                  "Triceps", "barbell"],
  ["Close-Grip Bench Press",        "Triceps", "barbell"],
  ["Lying Tricep Extension",        "Triceps", "barbell"],
  ["JM Press",                      "Triceps", "barbell"],
  ["California Press",              "Triceps", "barbell"],
  ["Board Press",                   "Triceps", "barbell"],
  ["Pin Press",                     "Triceps", "barbell"],
  ["Overhead Tricep Extension",     "Triceps", "dumbbell"],
  ["Tate Press",                    "Triceps", "dumbbell"],
  ["Tricep Kickback",               "Triceps", "dumbbell"],
  ["Incline Tricep Extension",      "Triceps", "dumbbell"],
  ["Machine Dip",                   "Triceps", "machine"],
  ["Weighted Dip",                  "Triceps", "bodyweight"],
  ["Diamond Push-Up",               "Triceps", "bodyweight"],
  ["Narrow-Grip Push-Up",           "Triceps", "bodyweight"],
  ["Bodyweight Tricep Extension",   "Triceps", "bodyweight"],

  // ── FOREARMS ───────────────────────────────────────────────────────────────
  ["Wrist Curl",                    "Forearms", "barbell"],
  ["Reverse Wrist Curl",            "Forearms", "barbell"],
  ["Behind-the-Back Wrist Curl",    "Forearms", "barbell"],
  ["Dead Hang",                     "Forearms", "bodyweight"],
  ["Towel Pull-Up",                 "Forearms", "bodyweight"],
  ["Farmer's Carry",                "Forearms", "dumbbell"],
  ["Plate Pinch",                   "Forearms", "weight plates"],
  ["Wrist Roller",                  "Forearms", "other"],
  ["Rice Bucket",                   "Forearms", "other"],

  // ── QUADS ──────────────────────────────────────────────────────────────────
  ["Barbell Back Squat",            "Quads", "barbell"],
  ["Front Squat",                   "Quads", "barbell"],
  ["Box Squat",                     "Quads", "barbell"],
  ["Pause Squat",                   "Quads", "barbell"],
  ["Safety Bar Squat",              "Quads", "barbell"],
  ["Cyclist Squat",                 "Quads", "barbell"],
  ["Leg Press",                     "Quads", "machine"],
  ["Hack Squat",                    "Quads", "machine"],
  ["Pendulum Squat",                "Quads", "machine"],
  ["Belt Squat",                    "Quads", "machine"],
  ["Leg Extension",                 "Quads", "machine"],
  ["Terminal Knee Extension",       "Quads", "resistance bands"],
  ["Spanish Squat",                 "Quads", "resistance bands"],
  ["Bulgarian Split Squat",         "Quads", "dumbbell"],
  ["Goblet Squat",                  "Quads", "dumbbell"],
  ["Walking Lunge",                 "Quads", "dumbbell"],
  ["Reverse Lunge",                 "Quads", "dumbbell"],
  ["Step-Up",                       "Quads", "dumbbell"],
  ["Pistol Squat",                  "Quads", "bodyweight"],
  ["Sissy Squat",                   "Quads", "bodyweight"],
  ["Skater Squat",                  "Quads", "bodyweight"],
  ["Box Jump",                      "Quads", "bodyweight"],

  // ── HAMSTRINGS ─────────────────────────────────────────────────────────────
  ["Romanian Deadlift",             "Hamstrings", "barbell"],
  ["Trap Bar Romanian Deadlift",    "Hamstrings", "barbell"],
  ["Stiff-Leg Deadlift",            "Hamstrings, Lower Back", "barbell"],
  ["Good Morning",                  "Hamstrings, Lower Back", "barbell"],
  ["Lying Leg Curl",                "Hamstrings", "machine"],
  ["Seated Leg Curl",               "Hamstrings", "machine"],
  ["Nordic Hamstring Curl",         "Hamstrings", "bodyweight"],
  ["Glute-Ham Raise",               "Hamstrings", "bodyweight"],
  ["Sliding Leg Curl",              "Hamstrings", "bodyweight"],
  ["Swiss Ball Leg Curl",           "Hamstrings", "other"],
  ["Single-Leg Romanian Deadlift",  "Hamstrings", "dumbbell"],

  // ── GLUTES ─────────────────────────────────────────────────────────────────
  ["Hip Thrust",                    "Glutes", "barbell"],
  ["Banded Hip Thrust",             "Glutes", "resistance bands"],
  ["Glute Bridge",                  "Glutes", "barbell"],
  ["Single-Leg Hip Thrust",         "Glutes", "bodyweight"],
  ["Frog Pump",                     "Glutes", "bodyweight"],
  ["Donkey Kick",                   "Glutes", "bodyweight"],
  ["Clamshell",                     "Glutes", "resistance bands"],
  ["Lateral Band Walk",             "Glutes", "resistance bands"],
  ["Cable Kickback",                "Glutes", "cable"],
  ["Abduction Machine",             "Glutes", "machine"],
  ["Reverse Hyper",                 "Glutes", "machine"],
  ["Sumo Squat",                    "Glutes", "dumbbell"],
  ["Kettlebell Swing",              "Glutes", "kettlebell"],

  // ── CALVES ─────────────────────────────────────────────────────────────────
  ["Calf Raise",                    "Calves", "machine"],
  ["Seated Calf Raise",             "Calves", "machine"],
  ["Donkey Calf Raise",             "Calves", "machine"],
  ["Leg Press Calf Raise",          "Calves", "machine"],
  ["Smith Machine Calf Raise",      "Calves", "machine"],
  ["Single-Leg Calf Raise",         "Calves", "bodyweight"],
  ["Tibialis Raise",                "Calves", "bodyweight"],

  // ── ABS ────────────────────────────────────────────────────────────────────
  ["Crunch",                        "Abs", "bodyweight"],
  ["Bicycle Crunch",                "Abs", "bodyweight"],
  ["Plank",                         "Abs", "bodyweight"],
  ["Side Plank",                    "Abs", "bodyweight"],
  ["Copenhagen Plank",              "Abs", "bodyweight"],
  ["Hollow Body Hold",              "Abs", "bodyweight"],
  ["Dead Bug",                      "Abs", "bodyweight"],
  ["V-Up",                          "Abs", "bodyweight"],
  ["Leg Raise",                     "Abs", "bodyweight"],
  ["Flutter Kick",                  "Abs", "bodyweight"],
  ["Hanging Leg Raise",             "Abs", "bodyweight"],
  ["Hanging Knee Raise",            "Abs", "bodyweight"],
  ["Toes-to-Bar",                   "Abs", "bodyweight"],
  ["L-Sit",                         "Abs", "bodyweight"],
  ["Dragon Flag",                   "Abs", "bodyweight"],
  ["Decline Sit-Up",                "Abs", "bodyweight"],
  ["Russian Twist",                 "Abs", "bodyweight"],
  ["Windshield Wiper",              "Abs", "bodyweight"],
  ["Weighted Crunch",               "Abs", "bodyweight"],
  ["Cable Crunch",                  "Abs", "cable"],
  ["Pallof Press",                  "Abs", "cable"],
  ["Cable Side Bend",               "Abs", "cable"],
  ["Landmine Rotation",             "Abs", "barbell"],
  ["Ab Wheel Rollout",              "Abs", "other"],
  ["GHD Sit-Up",                    "Abs", "machine"],

  // ── NECK ───────────────────────────────────────────────────────────────────
  ["Neck Curl",                     "Neck", "bodyweight"],
  ["Neck Extension",                "Neck", "bodyweight"],
  ["Lateral Neck Flexion",          "Neck", "bodyweight"],
  ["Wrestler's Bridge",             "Neck", "bodyweight"],
  ["Plate Neck Curl",               "Neck", "weight plates"],
  ["Band Neck Flexion",             "Neck", "resistance bands"],
  ["Harness Neck Extension",        "Neck", "other"],
  ["Iron Neck",                     "Neck", "other"],

  // ── OLYMPIC ────────────────────────────────────────────────────────────────
  ["Clean and Jerk",                "Olympic", "barbell"],
  ["Snatch",                        "Olympic", "barbell"],
  ["Power Clean",                   "Olympic", "barbell"],
  ["Hang Clean",                    "Olympic", "barbell"],
  ["Block Clean",                   "Olympic", "barbell"],
  ["Muscle Clean",                  "Olympic", "barbell"],
  ["Clean Pull",                    "Olympic", "barbell"],
  ["Clean High Pull",               "Olympic", "barbell"],
  ["Power Snatch",                  "Olympic", "barbell"],
  ["Hang Snatch",                   "Olympic", "barbell"],
  ["Block Snatch",                  "Olympic", "barbell"],
  ["Muscle Snatch",                 "Olympic", "barbell"],
  ["Snatch Pull",                   "Olympic", "barbell"],
  ["Snatch High Pull",              "Olympic", "barbell"],
  ["Overhead Squat",                "Olympic", "barbell"],
  ["Split Jerk",                    "Olympic", "barbell"],
  ["Power Jerk",                    "Olympic", "barbell"],

  // ── FULL BODY ──────────────────────────────────────────────────────────────
  ["Turkish Get-Up",                "Full Body", "kettlebell"],
  ["Man Maker",                     "Full Body", "dumbbell"],
  ["Thruster",                      "Full Body", "barbell"],
  ["Clean and Press",               "Full Body", "barbell"],
  ["Devil Press",                   "Full Body", "dumbbell"],
  ["Burpee",                        "Full Body", "bodyweight"],
  ["Broad Jump",                    "Full Body", "bodyweight"],
  ["Sled Push",                     "Full Body", "other"],
  ["Sled Pull",                     "Full Body", "other"],
  ["Prowler Push",                  "Full Body", "other"],
  ["Tire Flip",                     "Full Body", "other"],
  ["Sandbag Carry",                 "Full Body", "other"],
  ["Battle Ropes",                  "Full Body", "other"],
  ["Wall Ball",                     "Full Body", "other"],
  ["Assault Bike",                  "Full Body", "other"],
];

async function seedDefaultExercises(
  database: SQLite.SQLiteDatabase
): Promise<void> {
  const existing = await database.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM exercises"
  );
  if (existing && existing.count > 0) return;

  for (const [name, muscle_group, equipment_type] of ALL_EXERCISES) {
    await database.runAsync(
      "INSERT INTO exercises (name, muscle_group, equipment_type) VALUES (?, ?, ?)",
      [name, muscle_group, equipment_type]
    );
  }

  // Mark expansion as done so seedExpandedExercises skips for fresh installs
  await database.runAsync(
    "INSERT OR REPLACE INTO kv_store (key, value) VALUES ('@konafit_exercises_v2', '1')"
  );
}

// Runs once on existing installs to add all new exercises without duplicates
async function seedExpandedExercises(
  database: SQLite.SQLiteDatabase
): Promise<void> {
  const flag = await database.getFirstAsync<{ value: string }>(
    "SELECT value FROM kv_store WHERE key = '@konafit_exercises_v2'"
  );
  if (flag) return;

  for (const [name, muscle_group, equipment_type] of ALL_EXERCISES) {
    await database.runAsync(
      `INSERT INTO exercises (name, muscle_group, equipment_type)
       SELECT ?, ?, ? WHERE NOT EXISTS (
         SELECT 1 FROM exercises WHERE LOWER(name) = LOWER(?)
       )`,
      [name, muscle_group, equipment_type, name]
    );
  }

  await database.runAsync(
    "INSERT OR REPLACE INTO kv_store (key, value) VALUES ('@konafit_exercises_v2', '1')"
  );
}
