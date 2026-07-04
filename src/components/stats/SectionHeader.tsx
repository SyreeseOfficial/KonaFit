import { View, Text } from "react-native";

type Props = {
  title: string;
  subtitle?: string;
};

export function SectionHeader({ title, subtitle }: Props) {
  return (
    <View className="mb-6">
      <Text className="font-montserrat-bold text-text-primary dark:text-white text-xl">
        {title}
      </Text>
      {subtitle && (
        <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs uppercase tracking-widest mt-1.5">
          {subtitle}
        </Text>
      )}
    </View>
  );
}
