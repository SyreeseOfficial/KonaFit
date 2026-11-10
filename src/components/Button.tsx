import { Pressable, Text } from "react-native";
import { haptics } from "../utils/haptics";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const BOX: Record<Variant, string> = {
  primary: "bg-crimson dark:bg-blue-500",
  secondary: "bg-surface-2 dark:bg-zinc-800",
  danger: "bg-rose-500",
  ghost: "",
};
const TEXT: Record<Variant, string> = {
  primary: "text-white",
  secondary: "text-text-primary dark:text-white",
  danger: "text-white",
  ghost: "text-text-secondary dark:text-zinc-400",
};

/** The standard text button: 44 px tall, dims while pressed, announced as a button, light tap haptic. */
export function Button({ label, onPress, variant = "primary", disabled, className = "" }: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <Pressable
      onPress={() => { haptics.tap(); onPress(); }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      className={`min-h-[44px] px-6 items-center justify-center rounded-xl active:opacity-70 ${BOX[variant]} ${disabled ? "opacity-40" : ""} ${className}`}
    >
      <Text className={`font-montserrat-bold text-sm ${TEXT[variant]}`}>{label}</Text>
    </Pressable>
  );
}
