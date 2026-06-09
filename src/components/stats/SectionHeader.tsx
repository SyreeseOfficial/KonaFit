import { View, Text } from "react-native";

type Props = {
  title: string;
  subtitle?: string;
};

export function SectionHeader({ title, subtitle }: Props) {
  return (
    <View className="mb-5">
      <Text className="font-anton text-white text-xl tracking-widest uppercase">
        {title}
      </Text>
      {subtitle && (
        <Text className="font-mono text-text-muted text-xs tracking-widest uppercase mt-1">
          {subtitle}
        </Text>
      )}
    </View>
  );
}
