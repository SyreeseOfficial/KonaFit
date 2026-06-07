import { View, Text, TouchableOpacity } from "react-native";
import { useElapsedTimer } from "../../hooks/useElapsedTimer";

type Props = {
  startedAt: number;
  onFinish: () => void;
};

export function WorkspaceHeader({ startedAt, onFinish }: Props) {
  const elapsed = useElapsedTimer(startedAt);

  return (
    <View className="flex-row items-start justify-between px-4 pt-2 pb-3 border-b border-surface-2">
      <View>
        <Text className="font-anton text-white text-3xl tracking-widest uppercase">
          The Workspace
        </Text>
        <Text className="font-mono text-text-muted text-xs tracking-widest uppercase">
          Train
        </Text>
      </View>
      <View className="items-end gap-2">
        <Text className="font-mono-medium text-white text-xl tracking-wider">
          {elapsed}
        </Text>
        <TouchableOpacity
          onPress={onFinish}
          className="bg-crimson px-4 py-1.5"
          activeOpacity={0.8}
        >
          <Text className="font-montserrat-bold text-white text-xs tracking-widest uppercase">
            Finish
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
