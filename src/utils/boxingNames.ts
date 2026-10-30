/** "Morning Boxing" (before noon), "Afternoon Boxing" (noon to 4:59pm), else "Evening Boxing". Uses the device's local hour. */
export function boxingName(startedAtMs: number): string {
  const h = new Date(startedAtMs).getHours();
  return `${h < 12 ? "Morning" : h < 17 ? "Afternoon" : "Evening"} Boxing`;
}
