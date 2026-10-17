import { useEffect } from "react";
import { View, Text, TouchableOpacity } from "react-native";

type Props = {
  id: string; // a new id restarts the timer
  label: string;
  onUndo: () => void;
  onExpire: () => void;
};

const UNDO_MS = 5000;

export function UndoSnackbar({ id, label, onUndo, onExpire }: Props) {
  useEffect(() => {
    const t = setTimeout(onExpire, UNDO_MS);
    return () => clearTimeout(t);
  }, [id, onExpire]);

  return (
    <View className="flex-row items-center mx-5 mb-2 pl-4 pr-1 bg-zinc-800 dark:bg-zinc-700 rounded-xl">
      <Text className="flex-1 font-montserrat-semibold text-white text-sm py-3" numberOfLines={1}>
        {label}
      </Text>
      <TouchableOpacity onPress={onUndo} className="h-12 px-4 items-center justify-center" activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Undo">
        <Text className="font-montserrat-bold text-blue-400 text-sm uppercase">Undo</Text>
      </TouchableOpacity>
    </View>
  );
}
