import { Stack } from "expo-router";

// ponytail: Stack replaces the bottom tab bar; Stats is pushed from the Train header.
export default function TabLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
