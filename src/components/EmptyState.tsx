import { View, Text, TouchableOpacity } from "react-native";
import type { ReactNode } from "react";

type Props = { message: string; actionLabel?: string; onAction?: () => void; icon?: ReactNode };

/** Empty list placeholder with one clear next step. */
export function EmptyState({ message, actionLabel, onAction, icon }: Props) {
  return (
    <View className="bg-surface dark:bg-zinc-900 px-5 py-6 rounded-2xl items-center">
      {icon && <View className="mb-2">{icon}</View>}
      <Text className="font-montserrat text-text-secondary dark:text-zinc-500 text-sm text-center">{message}</Text>
      {actionLabel && onAction && (
        <TouchableOpacity
          onPress={onAction}
          className="mt-4 h-11 px-6 items-center justify-center rounded-full bg-crimson dark:bg-blue-500"
          activeOpacity={0.85}
        >
          <Text className="font-montserrat-semibold text-white text-sm">{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
