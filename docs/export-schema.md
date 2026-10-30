# Full JSON export

Settings > Data > Export Everything (JSON). One file, `konafit_full_YYYY-MM-DD.json`.

```jsonc
{
  "format": "konafit-export",
  "formatVersion": 1,          // bumped when a table is added or renamed
  "appVersion": "1.0.0",
  "schemaVersion": 12,         // PRAGMA user_version of the database
  "exportedAt": "2026-10-30T18:00:00.000Z",
  "tables": { "<table>": [ { "<column>": value, ... }, ... ] }
}
```

Each table is a raw dump of the SQLite table (every column, ordered by `id`). Weights are pounds, times are unix seconds,
booleans are 0/1. Foreign keys are the usual `<table>_id` columns.

| Table | Rows are |
|-------|----------|
| `exercises` | Library: `name`, `muscle_group`, `equipment_type`, `per_hand`, `is_custom`, `is_deleted`, ... |
| `workouts` | One per workout: `started_at`, `finished_at`, `duration_seconds`, `rating`, `energy`, `sleep_hours`, `location`, `app_version` |
| `logged_exercises` | An exercise in a workout (`workout_id`, `exercise_id`, `order_index`, `superset_id`, `notes`) |
| `logged_sets` | A set (`logged_exercise_id`, `set_number`, `weight_lbs`, `reps`, `rpe`, `is_warmup`, `set_type`, `is_completed`, `completed_at`, `rest_seconds`, `notes`) |
| `session_events` | `start` / `pause` / `resume` / `finish` stamps per workout |
| `programs`, `program_days`, `program_exercises` | Saved programs, their days and target sets/reps/RPE |
| `goals` | Lift, bodyweight and custom goals |
| `bodyweight_logs` | `weight_lbs`, `logged_at` |
| `readiness_checkins` | One per local day: `day` (YYYY-MM-DD), `sleep`, `soreness`, `mood` (1-5) |
| `locations` | Gyms |
| `progress_photos` | `photo_uri` is a file name only; the images are not included |

`set_type` is empty for a normal set, else one of `drop`, `failure`, `amrap`, `backoff`, `myo`.
