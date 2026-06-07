import * as SQLite from "expo-sqlite";

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync("konafit.db");
  return db;
}

export async function initializeDatabase(): Promise<void> {
  const database = await getDatabase();

  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      muscle_group TEXT NOT NULL,
      equipment_type TEXT NOT NULL DEFAULT 'barbell',
      use_count INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS exercises_fts USING fts5(
      name,
      content=exercises,
      content_rowid=id
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

    CREATE TABLE IF NOT EXISTS lifestyle_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      logged_at INTEGER NOT NULL DEFAULT (unixepoch()),
      hydration_oz REAL,
      pre_workout INTEGER NOT NULL DEFAULT 0,
      location TEXT
    );
  `);

  await seedDefaultExercises(database);
}

async function seedDefaultExercises(
  database: SQLite.SQLiteDatabase
): Promise<void> {
  const existing = await database.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM exercises"
  );
  if (existing && existing.count > 0) return;

  const defaults = [
    ["Barbell Back Squat", "Legs", "barbell"],
    ["Barbell Bench Press", "Chest", "barbell"],
    ["Deadlift", "Back", "barbell"],
    ["Overhead Press", "Shoulders", "barbell"],
    ["Barbell Row", "Back", "barbell"],
    ["Pull-Up", "Back", "bodyweight"],
    ["Dip", "Chest", "bodyweight"],
    ["Incline Dumbbell Press", "Chest", "dumbbell"],
    ["Dumbbell Curl", "Arms", "dumbbell"],
    ["Tricep Pushdown", "Arms", "cable"],
    ["Leg Press", "Legs", "machine"],
    ["Leg Curl", "Legs", "machine"],
    ["Calf Raise", "Legs", "machine"],
    ["Lat Pulldown", "Back", "cable"],
    ["Cable Row", "Back", "cable"],
    ["Romanian Deadlift", "Legs", "barbell"],
    ["Dumbbell Shoulder Press", "Shoulders", "dumbbell"],
    ["Lateral Raise", "Shoulders", "dumbbell"],
    ["Face Pull", "Shoulders", "cable"],
    ["Hip Thrust", "Legs", "barbell"],
  ];

  for (const [name, muscle_group, equipment_type] of defaults) {
    await database.runAsync(
      "INSERT INTO exercises (name, muscle_group, equipment_type) VALUES (?, ?, ?)",
      [name, muscle_group, equipment_type]
    );
  }
}
