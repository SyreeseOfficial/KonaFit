import { getDatabase } from "./database";

export type Location = {
  id: number;
  name: string;
  use_count: number;
};

export async function getLocations(): Promise<Location[]> {
  const db = await getDatabase();
  return db.getAllAsync<Location>(
    "SELECT id, name, use_count FROM locations ORDER BY use_count DESC, name ASC"
  );
}

export async function saveWorkoutLocation(
  workoutId: number,
  name: string
): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) return;
  const db = await getDatabase();

  // Upsert: insert or increment use_count
  await db.runAsync(
    `INSERT INTO locations (name, use_count)
     VALUES (?, 1)
     ON CONFLICT(name) DO UPDATE SET use_count = use_count + 1`,
    [trimmed]
  );

  // Save to workout record
  await db.runAsync(
    "UPDATE workouts SET location = ? WHERE id = ?",
    [trimmed, workoutId]
  );
}
