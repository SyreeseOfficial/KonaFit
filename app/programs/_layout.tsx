import { Stack } from "expo-router";

export default function ProgramsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }} />
  );
}
