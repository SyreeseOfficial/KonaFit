import { getDatabase } from "./database";

export type ProgressPhoto = {
  id: number;
  workout_id: number | null;
  workout_name: string | null;
  workout_started_at: number | null;
  photo_uri: string;
  taken_at: number;
};

export async function saveProgressPhoto(photoUri: string, workoutId?: number): Promise<number> {
  const db = await getDatabase();
  const result = await db.runAsync(
    "INSERT INTO progress_photos (photo_uri, workout_id) VALUES (?, ?)",
    [photoUri, workoutId ?? null]
  );
  return result.lastInsertRowId;
}

export async function getProgressPhotos(limit = 50): Promise<ProgressPhoto[]> {
  const db = await getDatabase();
  return db.getAllAsync<ProgressPhoto>(
    `SELECT pp.id, pp.workout_id, pp.photo_uri, pp.taken_at,
            w.name AS workout_name, w.started_at AS workout_started_at
     FROM progress_photos pp
     LEFT JOIN workouts w ON pp.workout_id = w.id
     ORDER BY pp.taken_at DESC
     LIMIT ?`,
    [limit]
  );
}

export async function deleteProgressPhoto(photoId: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM progress_photos WHERE id = ?", [photoId]);
}
