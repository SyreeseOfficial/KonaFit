import { View, Text, Modal, Pressable, TouchableOpacity } from "react-native";
import { Dumbbell, Swords, Repeat } from "lucide-react-native";

type Props = {
  visible: boolean;
  onClose: () => void;
  onLift: () => void;
  onBox: () => void;
  /** e.g. "6 x 3:00 / 1:00"; null hides the repeat row. */
  repeatLabel: string | null;
  onRepeat: () => void;
};

/** The Start picker: what kind of session to begin. */
export function StartSheet({ visible, onClose, onLift, onBox, repeatLabel, onRepeat }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/50 justify-end" onPress={onClose}>
        <Pressable>
          <View className="bg-surface dark:bg-zinc-900 rounded-t-3xl pb-10">
            <View className="px-5 py-5 border-b border-surface-2 dark:border-zinc-800">
              <Text className="font-montserrat-bold text-text-primary dark:text-white text-base">Start</Text>
            </View>
            <TouchableOpacity onPress={onLift} className="flex-row items-center gap-3 px-5 py-4 border-b border-surface-2 dark:border-zinc-800" activeOpacity={0.7}>
              <Dumbbell size={18} color="#64748B" />
              <View className="flex-1">
                <Text className="font-montserrat-semibold text-text-primary dark:text-white text-base">Lift</Text>
                <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-sm mt-0.5">Log exercises and sets</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity onPress={onBox} className={`flex-row items-center gap-3 px-5 py-4 ${repeatLabel ? "border-b border-surface-2 dark:border-zinc-800" : ""}`} activeOpacity={0.7}>
              <Swords size={18} color="#64748B" />
              <View className="flex-1">
                <Text className="font-montserrat-semibold text-text-primary dark:text-white text-base">Box</Text>
                <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-sm mt-0.5">Round timer with effort and focus</Text>
              </View>
            </TouchableOpacity>
            {repeatLabel && (
              <TouchableOpacity onPress={onRepeat} className="flex-row items-center gap-3 px-5 py-4" activeOpacity={0.7}>
                <Repeat size={18} color="#64748B" />
                <View className="flex-1">
                  <Text className="font-montserrat-semibold text-text-primary dark:text-white text-base">Repeat last boxing</Text>
                  <Text className="font-mono text-text-muted dark:text-zinc-500 text-sm mt-0.5">{repeatLabel}</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
