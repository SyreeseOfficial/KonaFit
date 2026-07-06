import { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, Image, TouchableOpacity, Modal, Alert,
} from "react-native";
import { Camera, X, Trash2 } from "lucide-react-native";
import * as FileSystem from "expo-file-system/legacy";
import { getProgressPhotos, saveProgressPhoto, deleteProgressPhoto, type ProgressPhoto } from "../../db/photoQueries";

type Props = { refreshKey?: number };

function formatDate(unixtimeSec: number): string {
  return new Date(unixtimeSec * 1000).toLocaleDateString([], {
    month: "short", day: "numeric", year: "numeric",
  });
}

async function persistAndSave(uri: string, workoutId?: number): Promise<void> {
  const dir = `${FileSystem.documentDirectory}konafit/photos/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const dest = `${dir}photo_${Date.now()}.jpg`;
  await FileSystem.copyAsync({ from: uri, to: dest });
  await saveProgressPhoto(dest, workoutId);
}

export function ProgressPhotoGallery({ refreshKey }: Props) {
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [selected, setSelected] = useState<ProgressPhoto | null>(null);

  const load = useCallback(async () => {
    setPhotos(await getProgressPhotos(50));
  }, []);

  useEffect(() => { load(); }, [refreshKey, load]);

  const handleAdd = useCallback(async () => {
    const ImagePicker = require("expo-image-picker") as typeof import("expo-image-picker");
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Enable photo access in Settings.");
      return;
    }
    Alert.alert("Add Progress Photo", "Choose source", [
      {
        text: "Camera",
        onPress: async () => {
          const cam = await ImagePicker.requestCameraPermissionsAsync();
          if (cam.status !== "granted") return;
          const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
          if (!result.canceled && result.assets[0]) { await persistAndSave(result.assets[0].uri); load(); }
        },
      },
      {
        text: "Photo Library",
        onPress: async () => {
          const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8 });
          if (!result.canceled && result.assets[0]) { await persistAndSave(result.assets[0].uri); load(); }
        },
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [load]);

  const handleDelete = useCallback(async (photo: ProgressPhoto) => {
    Alert.alert("Delete Photo", "Remove this progress photo?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          await deleteProgressPhoto(photo.id);
          try { await FileSystem.deleteAsync(photo.photo_uri, { idempotent: true }); } catch {}
          setSelected(null);
          load();
        },
      },
    ]);
  }, [load]);

  return (
    <View className="px-5">
      <View className="flex-row items-end justify-between mb-4">
        <View>
          <Text className="font-montserrat-bold text-text-primary dark:text-white text-xl">
            Progress Photos
          </Text>
          <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs mt-0.5">
            {photos.length} photo{photos.length !== 1 ? "s" : ""}
          </Text>
        </View>
        <TouchableOpacity
          onPress={handleAdd}
          className="flex-row items-center gap-1.5 bg-surface dark:bg-zinc-900 px-4 py-2.5 rounded-xl"
          activeOpacity={0.7}
        >
          <Camera size={14} color="#94A3B8" />
          <Text className="font-montserrat-semibold text-text-secondary dark:text-zinc-400 text-sm">
            Add
          </Text>
        </TouchableOpacity>
      </View>

      {photos.length === 0 ? (
        <View className="bg-surface dark:bg-zinc-900 p-6 items-center rounded-2xl">
          <Camera size={28} color="#94A3B8" />
          <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-sm mt-2 text-center">
            No progress photos yet.{"\n"}Add one during a workout or tap Add.
          </Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-3">
            {photos.map((photo) => (
              <TouchableOpacity key={photo.id} onPress={() => setSelected(photo)} activeOpacity={0.85}>
                <Image
                  source={{ uri: photo.photo_uri }}
                  style={{ width: 96, height: 116, borderRadius: 12 }}
                  resizeMode="cover"
                />
                <Text
                  className="font-mono text-text-muted dark:text-zinc-500 text-xs text-center mt-1"
                  style={{ width: 96 }}
                  numberOfLines={1}
                >
                  {formatDate(photo.taken_at)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}

      {/* Full-screen viewer */}
      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <View className="flex-1 bg-black">
          {selected && (
            <>
              <Image source={{ uri: selected.photo_uri }} className="flex-1" resizeMode="contain" />
              <View className="absolute top-0 left-0 right-0 flex-row items-center justify-between px-5 pt-14 pb-4">
                <TouchableOpacity onPress={() => setSelected(null)} hitSlop={12} activeOpacity={0.7}>
                  <X size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(selected)} hitSlop={12} activeOpacity={0.7}>
                  <Trash2 size={20} color="#EF4444" />
                </TouchableOpacity>
              </View>
              <View className="absolute bottom-0 left-0 right-0 px-5 pb-12 pt-4 bg-black/60">
                <Text className="font-mono-medium text-white text-sm">
                  {formatDate(selected.taken_at)}
                </Text>
                {selected.workout_name && (
                  <Text className="font-mono text-zinc-400 text-xs mt-0.5">
                    {selected.workout_name} · {selected.workout_started_at ? formatDate(selected.workout_started_at) : ""}
                  </Text>
                )}
              </View>
            </>
          )}
        </View>
      </Modal>
    </View>
  );
}
