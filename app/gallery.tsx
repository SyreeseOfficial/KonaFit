import { ScrollView, View, Text } from "react-native";
import { Button } from "../src/components/Button";
import { EmptyState } from "../src/components/EmptyState";

// Screenshot harness: Maestro opens konafit://gallery in light and dark (.maestro/gallery.yaml).
// Only reachable in builds made with EXPO_PUBLIC_GALLERY=1. Add a component here to put it under visual review.
export default function Gallery() {
  if (process.env.EXPO_PUBLIC_GALLERY !== "1") return null;
  return (
    <ScrollView className="flex-1 bg-white dark:bg-black" contentContainerClassName="p-4 gap-4">
      <Text className="font-montserrat-bold text-text-primary dark:text-white text-lg">Gallery</Text>
      <View className="gap-2">
        {(["primary", "secondary", "danger", "ghost"] as const).map((v) => (
          <Button key={v} label={v} variant={v} onPress={() => {}} />
        ))}
        <Button label="disabled" disabled onPress={() => {}} />
      </View>
      <EmptyState message="Nothing here yet." actionLabel="Do something" onAction={() => {}} />
    </ScrollView>
  );
}
