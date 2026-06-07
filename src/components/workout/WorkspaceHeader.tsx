import { View, Text, TouchableOpacity } from "react-native";
import { Calculator } from "lucide-react-native";
import { useElapsedTimer } from "../../hooks/useElapsedTimer";

type Props = {
  startedAt: number;
  onFinish: () => void;
  onTools?: () => void;
};

export function WorkspaceHeader({ startedAt, onFinish, onTools }: Props) {
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
        <View className="flex-row items-center gap-3">
          {onTools && (
            <TouchableOpacity onPress={onTools} hitSlop={8} activeOpacity={0.7}>
              <Calculator size={18} color="#606060" />
            </TouchableOpacity>
          )}
          <Text className="font-mono-medium text-white text-xl tracking-wider">
            {elapsed}
          </Text>
        </View>
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
