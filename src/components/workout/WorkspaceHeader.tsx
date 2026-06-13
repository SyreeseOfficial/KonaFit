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
      <View className="flex-row items-start justify-between px-4 pt-4 pb-4 border-b border-surface-2">
        <View>
          <Text className="font-anton text-white text-3xl tracking-widest uppercase">
            Train
          </Text>
        </View>

        <View className="items-end gap-2">
          {/* Timer row */}
          <View className="flex-row items-center gap-3">
            {onTools && (
              <TouchableOpacity onPress={onTools} hitSlop={8} activeOpacity={0.7}>
                <Calculator size={17} color="#606060" />
              </TouchableOpacity>
            )}

            {onCamera && (
              <TouchableOpacity onPress={onCamera} hitSlop={8} activeOpacity={0.7}>
                <Camera size={17} color="#606060" />
              </TouchableOpacity>
            )}

            {isPaused && (
              <TouchableOpacity onPress={reset} hitSlop={8} activeOpacity={0.7}>
                <RotateCcw size={15} color="#606060" />
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={isPaused ? resume : pause}
              hitSlop={8}
              activeOpacity={0.7}
            >
              {isPaused ? (
                <Play size={17} color="#FF0000" fill="#FF0000" />
              ) : (
                <Pause size={17} color="#606060" />
              )}
            </TouchableOpacity>

            {/* Tappable timer — opens scroll wheel picker */}
            <TouchableOpacity onPress={openAdjust} hitSlop={4} activeOpacity={0.7}>
              <Text
                className={`font-mono-medium text-xl tracking-wider ${
                  isPaused ? "text-text-muted" : "text-white"
                }`}
              >
                {formattedTime}
              </Text>
            </TouchableOpacity>
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

      {/* Timer scroll wheel modal */}
      <Modal visible={adjustOpen} transparent animationType="fade" onRequestClose={() => setAdjustOpen(false)}>
        <Pressable className="flex-1 bg-black/70 justify-end" onPress={() => setAdjustOpen(false)}>
          <Pressable>
            <View className="bg-surface-2 px-4 pt-5 pb-10">
              <View className="flex-row items-center justify-between mb-5">
                <Text className="font-mono text-text-muted text-xs tracking-widest uppercase">
                  Set Timer
                </Text>
                <TouchableOpacity onPress={() => setAdjustOpen(false)} hitSlop={8}>
                  <X size={18} color="#606060" />
                </TouchableOpacity>
              </View>

              {/* Scroll wheel */}
              <View style={{ height: ITEM_H * (SIDE_ITEMS * 2 + 1), overflow: "hidden" }}>
                {/* Center bracket lines */}
                <View
                  style={{
                    position: "absolute",
                    top: ITEM_H * SIDE_ITEMS,
                    left: 0,
                    right: 0,
                    height: ITEM_H,
                    borderTopWidth: 1,
                    borderBottomWidth: 1,
                    borderColor: "#3A3A3A",
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
                      <Text className="font-mono text-text-secondary text-xl tracking-wider">
                        {minuteLabel(item)}
                      </Text>
                    </View>
                  )}
                  snapToInterval={ITEM_H}
                  decelerationRate="fast"
                  showsVerticalScrollIndicator={false}
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

              {/* Selected value display */}
              <Text className="font-mono-medium text-white text-4xl tracking-widest text-center mt-4 mb-5">
                {minuteLabel(pickerDisplay)}
              </Text>

              <TouchableOpacity
                onPress={handleSetTime}
                className="bg-crimson py-3 items-center"
                activeOpacity={0.8}
              >
                <Text className="font-montserrat-bold text-white text-xs tracking-widest uppercase">
                  Set Time
                </Text>
              </TouchableOpacity>

              <Text className="font-mono text-text-muted text-xs text-center mt-3">
                Scroll to adjust · tap timer to open
              </Text>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
