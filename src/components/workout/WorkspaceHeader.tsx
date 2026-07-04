import { useState, useRef, useCallback } from "react";
import { View, Text, TouchableOpacity, Modal, Pressable, FlatList } from "react-native";
import { Calculator, Pause, Play, RotateCcw, Camera, X } from "lucide-react-native";
import { useWorkoutTimer } from "../../hooks/useWorkoutTimer";

type Props = {
  startedAt: number;
  onFinish: () => void;
  onTools?: () => void;
  onCamera?: () => void;
};

const ITEM_H = 56;
const SIDE_ITEMS = 2;
const MAX_MINS = 360;

const minuteLabel = (m: number): string => {
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h === 0) return `${min}m`;
  if (min === 0) return `${h}h`;
  return `${h}h ${min}m`;
};

const MINUTES = Array.from({ length: MAX_MINS + 1 }, (_, i) => i);

export function WorkspaceHeader({ startedAt, onFinish, onTools, onCamera }: Props) {
  const { elapsed, formattedTime, isPaused, pause, resume, reset, adjustElapsed } = useWorkoutTimer(startedAt);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [pickerDisplay, setPickerDisplay] = useState(0);
  const pickerRef = useRef(0);
  const listRef = useRef<FlatList>(null);

  const openAdjust = useCallback(() => {
    const mins = Math.min(MAX_MINS, Math.max(0, Math.round(elapsed / 60)));
    pickerRef.current = mins;
    setPickerDisplay(mins);
    setAdjustOpen(true);
    setTimeout(() => {
      listRef.current?.scrollToOffset({ offset: mins * ITEM_H, animated: false });
    }, 150);
  }, [elapsed]);

  const onScrollEnd = useCallback((e: { nativeEvent: { contentOffset: { y: number } } }) => {
    const idx = Math.max(0, Math.min(MAX_MINS, Math.round(e.nativeEvent.contentOffset.y / ITEM_H)));
    pickerRef.current = idx;
    setPickerDisplay(idx);
  }, []);

  const handleSetTime = useCallback(() => {
    const targetSecs = pickerRef.current * 60;
    adjustElapsed(targetSecs - elapsed);
    setAdjustOpen(false);
  }, [elapsed, adjustElapsed]);

  return (
    <>
      <View className="flex-row items-center justify-between px-5 pt-4 pb-4 border-b border-surface-2 dark:border-zinc-800 bg-surface dark:bg-zinc-900">
        <Text className="font-montserrat-bold text-text-primary dark:text-white text-2xl">
          Train
        </Text>

        <View className="items-end gap-2">
          <View className="flex-row items-center gap-3">
            {onTools && (
              <TouchableOpacity onPress={onTools} hitSlop={8} activeOpacity={0.7}>
                <Calculator size={18} color="#94A3B8" />
              </TouchableOpacity>
            )}

            {onCamera && (
              <TouchableOpacity onPress={onCamera} hitSlop={8} activeOpacity={0.7}>
                <Camera size={18} color="#94A3B8" />
              </TouchableOpacity>
            )}

            {isPaused && (
              <TouchableOpacity onPress={reset} hitSlop={8} activeOpacity={0.7}>
                <RotateCcw size={16} color="#94A3B8" />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={isPaused ? resume : pause}
              hitSlop={8}
              activeOpacity={0.7}
            >
              {isPaused ? (
                <Play size={18} color="#2563EB" fill="#2563EB" />
              ) : (
                <Pause size={18} color="#94A3B8" />
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={openAdjust} hitSlop={4} activeOpacity={0.7}>
              <Text
                className={`font-mono-medium text-xl tracking-wider ${
                  isPaused ? "text-text-muted dark:text-zinc-500" : "text-text-primary dark:text-white"
                }`}
              >
                {formattedTime}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            onPress={onFinish}
            className="bg-crimson dark:bg-blue-500 px-5 py-2 rounded-xl"
            activeOpacity={0.85}
          >
            <Text className="font-montserrat-bold text-white text-sm">
              Finish
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Timer scroll wheel modal */}
      <Modal visible={adjustOpen} transparent animationType="fade" onRequestClose={() => setAdjustOpen(false)}>
        <Pressable className="flex-1 bg-black/50 justify-end" onPress={() => setAdjustOpen(false)}>
          <Pressable>
            <View className="bg-surface dark:bg-zinc-900 rounded-t-3xl px-5 pt-5 pb-10">
              <View className="flex-row items-center justify-between mb-5">
                <Text className="font-montserrat-bold text-text-primary dark:text-white text-lg">
                  Set Timer
                </Text>
                <TouchableOpacity onPress={() => setAdjustOpen(false)} hitSlop={8}>
                  <X size={20} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              <View style={{ height: ITEM_H * (SIDE_ITEMS * 2 + 1), overflow: "hidden" }}>
                <View
                  style={{
                    position: "absolute",
                    top: ITEM_H * SIDE_ITEMS,
                    left: 0,
                    right: 0,
                    height: ITEM_H,
                    borderTopWidth: 1,
                    borderBottomWidth: 1,
                    borderColor: "#E2E8F0",
                    zIndex: 1,
                  }}
                  pointerEvents="none"
                />
                <FlatList
                  ref={listRef}
                  data={MINUTES}
                  keyExtractor={(item) => String(item)}
                  renderItem={({ item }) => (
                    <View style={{ height: ITEM_H, justifyContent: "center", alignItems: "center" }}>
                      <Text className="font-mono text-text-secondary dark:text-zinc-400 text-xl tracking-wider">
                        {minuteLabel(item)}
                      </Text>
                    </View>
                  )}
                  snapToInterval={ITEM_H}
                  decelerationRate="fast"
                  showsVerticalScrollIndicator={false}
                  nestedScrollEnabled
                  onMomentumScrollEnd={onScrollEnd}
                  onScrollEndDrag={onScrollEnd}
                  ListHeaderComponent={<View style={{ height: ITEM_H * SIDE_ITEMS }} />}
                  ListFooterComponent={<View style={{ height: ITEM_H * SIDE_ITEMS }} />}
                  getItemLayout={(_, index) => ({
                    length: ITEM_H,
                    offset: ITEM_H * SIDE_ITEMS + ITEM_H * index,
                    index,
                  })}
                />
              </View>

              <Text className="font-mono-medium text-text-primary dark:text-white text-4xl tracking-widest text-center mt-4 mb-5">
                {minuteLabel(pickerDisplay)}
              </Text>

              <TouchableOpacity
                onPress={handleSetTime}
                className="bg-crimson dark:bg-blue-500 py-4 items-center rounded-2xl"
                activeOpacity={0.85}
              >
                <Text className="font-montserrat-bold text-white text-base">
                  Set Time
                </Text>
              </TouchableOpacity>

              <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-sm text-center mt-3">
                Scroll to adjust · tap timer to open
              </Text>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
