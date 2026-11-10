import * as FileSystem from "expo-file-system/legacy";
import { saveProgressPhoto, getPhotoFileNames, findOrphans } from "../db/photoQueries";

// The database stores only the file name; the folder is rebuilt here because the app's container path can change after an update.
const dir = () => `${FileSystem.documentDirectory}konafit/photos/`;

export const photoPath = (fileName: string) => dir() + (fileName.split("/").pop() ?? fileName);

/** Copy a picked/captured image into the app's photo folder and record it. */
export async function addProgressPhoto(uri: string, workoutId?: number): Promise<void> {
  await FileSystem.makeDirectoryAsync(dir(), { intermediates: true });
  const fileName = `photo_${Date.now()}.jpg`;
  await FileSystem.copyAsync({ from: uri, to: photoPath(fileName) });
  await saveProgressPhoto(fileName, workoutId);
}

export async function deletePhotoFile(fileName: string): Promise<void> {
  await FileSystem.deleteAsync(photoPath(fileName), { idempotent: true });
}

/** Delete photo files no row points to (left by a failed save, or by Wipe All Data). */
export async function removeOrphanPhotos(): Promise<void> {
  const info = await FileSystem.getInfoAsync(dir());
  if (!info.exists) return;
  const onDisk = await FileSystem.readDirectoryAsync(dir());
  for (const name of findOrphans(onDisk, await getPhotoFileNames())) await deletePhotoFile(name);
}

export async function photoFileExists(fileName: string): Promise<boolean> {
  return (await FileSystem.getInfoAsync(photoPath(fileName))).exists;
}
