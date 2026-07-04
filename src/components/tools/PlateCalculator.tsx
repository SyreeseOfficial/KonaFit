import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, useWindowDimensions, Modal, Pressable,
} from "react-native";
import Svg, { Rect, Text as SvgText } from "react-native-svg";
import { Settings2, Plus, X, Check } from "lucide-react-native";
import { kvStore } from "../../utils/kvStore";
import {
  PLATES, BAR_OPTIONS, calculatePlates, CUSTOM_PLATE_COLORS,
  type PlateConfig, type PlateResult,
} from "../../utils/plateCalc";

const PLATE_W = 14;
const BAR_H = 10;
const BAR_Y_CENTER = 50;
const COLLAR_W = 8;
const COLLAR_COLOR = "#94A3B8";

const ENABLED_KEY = "@konafit_plate_enabled";
const CUSTOM_KEY  = "@konafit_custom_plates";

function PlateConfigPanel({
  visible, allPlates, enabled, onToggle, onAddCustom, onDeleteCustom, onClose,
}: {
  visible: boolean;
  allPlates: PlateConfig[];
  enabled: Record<string, boolean>;
  onToggle: (weight: string) => void;
  onAddCustom: (plate: PlateConfig) => void;
  onDeleteCustom: (weight: number) => void;
  onClose: () => void;
}) {
  const [addMode, setAddMode] = useState(false);
  const [customWeight, setCustomWeight] = useState("");
  const [colorIdx, setColorIdx] = useState(0);
  const defaultWeights = new Set(PLATES.map((p) => p.weight));

  const handleAdd = () => {
    const w = parseFloat(customWeight);
    if (isNaN(w) || w <= 0 || allPlates.some((p) => p.weight === w)) return;
    const color = CUSTOM_PLATE_COLORS[colorIdx].hex;
    const newPlate: PlateConfig = {
      weight: w, color, textColor: "#FFFFFF", label: String(w),
      heightPx: Math.min(72, Math.max(18, Math.round(w * 1.2))),
    };
    onAddCustom(newPlate);
    setCustomWeight("");
    setAddMode(false);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 bg-black/60 justify-end" onPress={onClose}>
        <Pressable>
          <View className="bg-surface dark:bg-zinc-900 pb-10 rounded-t-3xl">
            <View className="flex-row items-center justify-between px-5 py-5 border-b border-surface-2 dark:border-zinc-800">
              <Text className="font-montserrat-bold text-text-primary dark:text-white text-lg">Plate Config</Text>
              <TouchableOpacity onPress={onClose} hitSlop={8}><X size={18} color="#94A3B8" /></TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled">
              {allPlates.slice().sort((a, b) => b.weight - a.weight).map((plate) => {
                const key = String(plate.weight);
                const isEnabled = enabled[key] !== false;
                const isCustom = !defaultWeights.has(plate.weight);
                return (
                  <View key={key} className="flex-row items-center px-5 py-4 border-b border-surface-2 dark:border-zinc-800">
                    <View style={{ width: 12, height: 28, backgroundColor: plate.color, marginRight: 12, borderRadius: 3 }} />
                    <Text className="font-mono-medium text-text-primary dark:text-white text-sm flex-1">{plate.label} lb</Text>
                    {isCustom && (
                      <TouchableOpacity onPress={() => onDeleteCustom(plate.weight)} hitSlop={8} className="mr-4">
                        <X size={14} color="#94A3B8" />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      onPress={() => onToggle(key)}
                      className={`w-14 h-8 items-center justify-center rounded-full ${isEnabled ? "bg-crimson dark:bg-blue-500" : "bg-surface-2 dark:bg-zinc-800"}`}
                      activeOpacity={0.7}
                    >
                      <Text className={`font-mono text-xs ${isEnabled ? "text-white" : "text-text-muted dark:text-zinc-500"}`}>
                        {isEnabled ? "ON" : "OFF"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}

              {addMode ? (
                <View className="px-5 py-5 border-b border-surface-2 dark:border-zinc-800">
                  <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs uppercase tracking-widest mb-3">Custom Plate Weight</Text>
                  <View className="flex-row items-center gap-2 mb-4">
                    <TextInput
                      className="flex-1 h-11 bg-surface-2 dark:bg-zinc-800 px-4 font-mono text-text-primary dark:text-white text-base rounded-xl"
                      placeholder="e.g. 1.25"
                      placeholderTextColor="#94A3B8"
                      value={customWeight}
                      onChangeText={setCustomWeight}
                      keyboardType="decimal-pad"
                      autoFocus
                    />
                    <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs">lb</Text>
                  </View>
                  <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs uppercase tracking-widest mb-2">Color</Text>
                  <View className="flex-row gap-2 mb-4">
                    {CUSTOM_PLATE_COLORS.map((c, i) => (
                      <TouchableOpacity
                        key={c.hex}
                        onPress={() => setColorIdx(i)}
                        className="w-9 h-9 items-center justify-center rounded-xl"
                        style={{ backgroundColor: c.hex, borderWidth: colorIdx === i ? 2 : 0, borderColor: "#FFFFFF" }}
                        activeOpacity={0.8}
                      >
                        {colorIdx === i && <Check size={14} color="#FFFFFF" />}
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View className="flex-row gap-2">
                    <TouchableOpacity
                      onPress={handleAdd}
                      disabled={!customWeight.trim()}
                      className={`flex-1 py-3 items-center rounded-xl ${customWeight.trim() ? "bg-crimson dark:bg-blue-500" : "bg-surface-2 dark:bg-zinc-800"}`}
                      activeOpacity={0.85}
                    >
                      <Text className="font-montserrat-bold text-white text-sm">Add Plate</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setAddMode(false)} className="px-5 py-3 bg-surface-2 dark:bg-zinc-800 items-center rounded-xl" activeOpacity={0.7}>
                      <Text className="font-montserrat-semibold text-text-secondary dark:text-zinc-400 text-sm">Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => setAddMode(true)}
                  className="flex-row items-center gap-2 px-5 py-4"
                  activeOpacity={0.7}
                >
                  <Plus size={14} color="#94A3B8" />
                  <Text className="font-montserrat-semibold text-text-secondary dark:text-zinc-400 text-base">Add Custom Plate</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

type Props = { initialWeight?: number };

export function PlateCalculator({ initialWeight }: Props) {
  const { width } = useWindowDimensions();
  const svgWidth = width - 40;

  const [targetInput, setTargetInput] = useState(initialWeight ? String(initialWeight) : "");
  const [barIdx, setBarIdx] = useState(0);
  const [configOpen, setConfigOpen] = useState(false);
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [customPlates, setCustomPlates] = useState<PlateConfig[]>([]);

  useEffect(() => {
    Promise.all([kvStore.getItem(ENABLED_KEY), kvStore.getItem(CUSTOM_KEY)]).then(([e, c]) => {
      if (e) setEnabled(JSON.parse(e));
      if (c) setCustomPlates(JSON.parse(c));
    });
  }, []);

  const allPlates = useMemo(() => [...PLATES, ...customPlates], [customPlates]);
  const activePlates = useMemo(() => allPlates.filter((p) => enabled[String(p.weight)] !== false), [allPlates, enabled]);

  const handleToggle = useCallback(async (key: string) => {
    setEnabled((prev) => {
      const next = { ...prev, [key]: prev[key] === false };
      kvStore.setItem(ENABLED_KEY, JSON.stringify(next)).catch(console.error);
      return next;
    });
  }, []);

  const handleAddCustom = useCallback(async (plate: PlateConfig) => {
    setCustomPlates((prev) => {
      const next = [...prev, plate];
      kvStore.setItem(CUSTOM_KEY, JSON.stringify(next)).catch(console.error);
      return next;
    });
    setEnabled((prev) => {
      const next = { ...prev, [String(plate.weight)]: true };
      kvStore.setItem(ENABLED_KEY, JSON.stringify(next)).catch(console.error);
      return next;
    });
  }, []);

  const handleDeleteCustom = useCallback(async (weight: number) => {
    setCustomPlates((prev) => {
      const next = prev.filter((p) => p.weight !== weight);
      kvStore.setItem(CUSTOM_KEY, JSON.stringify(next)).catch(console.error);
      return next;
    });
  }, []);

  const barWeight = BAR_OPTIONS[barIdx].weight;
  const targetLbs = parseFloat(targetInput);
  const isValid = !isNaN(targetLbs) && targetLbs > 0;

  const results: PlateResult[] | null = useMemo(() => {
    if (!isValid) return null;
    return calculatePlates(targetLbs, barWeight, activePlates);
  }, [targetLbs, barWeight, activePlates]);

  const perSide = isValid ? (targetLbs - barWeight) / 2 : 0;
  const loadable = results !== null;
  const totalPlateWeight = results?.reduce((sum, r) => sum + r.plate.weight * r.count * 2, 0) ?? 0;
  const isExact = Math.abs(totalPlateWeight - (targetLbs - barWeight)) < 0.01;

  const platesPerSide: PlateConfig[] = [];
  results?.forEach(({ plate, count }) => { for (let i = 0; i < count; i++) platesPerSide.push(plate); });

  const centerX = svgWidth / 2;
  const collarOffset = COLLAR_W + 2;
  const svgHeight = 100;

  const rightPlates: { plate: PlateConfig; x: number }[] = [];
  let rightX = centerX + collarOffset;
  for (const plate of platesPerSide) { rightPlates.push({ plate, x: rightX }); rightX += PLATE_W + 1; }

  const leftPlates: { plate: PlateConfig; x: number }[] = [];
  let leftX = centerX - collarOffset - PLATE_W;
  for (const plate of platesPerSide) { leftPlates.push({ plate, x: leftX }); leftX -= PLATE_W + 1; }

  return (
    <View>
      {/* Weight input */}
      <View className="flex-row items-center gap-3 mb-4">
        <TextInput
          className="flex-1 h-13 bg-surface-2 dark:bg-zinc-800 px-4 font-mono-medium text-text-primary dark:text-white text-xl text-center rounded-xl"
          placeholder="Target weight"
          placeholderTextColor="#94A3B8"
          value={targetInput}
          onChangeText={setTargetInput}
          keyboardType="decimal-pad"
          selectTextOnFocus
        />
        <Text className="font-mono text-text-muted dark:text-zinc-500 text-sm">lbs</Text>
      </View>

      {/* Bar selector + config */}
      <View className="flex-row gap-2 mb-5 items-center">
        <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs mr-1">BAR:</Text>
        {BAR_OPTIONS.map((opt, i) => (
          <TouchableOpacity
            key={opt.label}
            onPress={() => setBarIdx(i)}
            className={`px-3 py-2 rounded-full ${barIdx === i ? "bg-crimson dark:bg-blue-500" : "bg-surface-2 dark:bg-zinc-800"}`}
            activeOpacity={0.7}
          >
            <Text className={`font-mono text-xs ${barIdx === i ? "text-white" : "text-text-muted dark:text-zinc-500"}`}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
        <View className="flex-1" />
        <TouchableOpacity
          onPress={() => setConfigOpen(true)}
          className="flex-row items-center gap-1.5 bg-surface-2 dark:bg-zinc-800 px-3 py-2 rounded-xl"
          activeOpacity={0.7}
        >
          <Settings2 size={13} color="#94A3B8" />
          <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs">
            {activePlates.length}/{allPlates.length}
          </Text>
        </TouchableOpacity>
      </View>

      {/* SVG Barbell */}
      {isValid && loadable && results !== null && (
        <View className="bg-surface dark:bg-zinc-900 mb-4 rounded-2xl overflow-hidden">
          <Svg width={svgWidth} height={svgHeight}>
            <Rect x={0} y={BAR_Y_CENTER - BAR_H / 2} width={svgWidth} height={BAR_H} fill="#64748B" />
            <Rect x={centerX - collarOffset - COLLAR_W} y={BAR_Y_CENTER - 14} width={COLLAR_W} height={28} fill={COLLAR_COLOR} />
            <Rect x={centerX + collarOffset} y={BAR_Y_CENTER - 14} width={COLLAR_W} height={28} fill={COLLAR_COLOR} />
            {rightPlates.map(({ plate, x }, i) => {
              const h = plate.heightPx; const y = BAR_Y_CENTER - h / 2;
              return (
                <React.Fragment key={`r-${i}`}>
                  <Rect x={x} y={y} width={PLATE_W} height={h} fill={plate.color} />
                  {i === 0 && (
                    <SvgText x={x + PLATE_W / 2} y={BAR_Y_CENTER + 4} textAnchor="middle" fill={plate.textColor} fontSize={6} fontFamily="JetBrainsMono_400Regular">
                      {plate.label}
                    </SvgText>
                  )}
                </React.Fragment>
              );
            })}
            {leftPlates.map(({ plate, x }, i) => {
              const h = plate.heightPx; const y = BAR_Y_CENTER - h / 2;
              return <Rect key={`l-${i}`} x={x} y={y} width={PLATE_W} height={h} fill={plate.color} />;
            })}
          </Svg>
          <View className="flex-row justify-between px-5 pb-4 pt-1">
            <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs">Bar: {barWeight} lbs</Text>
            <Text className={`font-mono text-xs ${isExact ? "text-text-secondary dark:text-zinc-400" : "text-crimson dark:text-blue-400"}`}>
              {isExact ? `${perSide} lbs/side` : `≈ ${(totalPlateWeight / 2 + barWeight / 2).toFixed(1)} lbs/side`}
            </Text>
          </View>
        </View>
      )}

      {isValid && !loadable && (
        <View className="bg-surface dark:bg-zinc-900 p-4 mb-4 rounded-2xl">
          <Text className="font-montserrat text-rose-500 text-sm text-center">
            Target weight is less than bar weight ({barWeight} lbs)
          </Text>
        </View>
      )}

      {!isExact && isValid && loadable && (
        <View className="bg-surface dark:bg-zinc-900 px-5 py-3 mb-3 rounded-xl">
          <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs text-center">
            Cannot load exactly — closest is {totalPlateWeight + barWeight} lbs
          </Text>
        </View>
      )}

      {/* Plate breakdown */}
      {results && results.length > 0 && (
        <View className="bg-surface dark:bg-zinc-900 rounded-2xl overflow-hidden mb-4">
          <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs uppercase tracking-widest px-5 pt-4 pb-2">Per Side</Text>
          {results.map(({ plate, count }) => (
            <View key={plate.weight} className="flex-row items-center px-5 py-3 border-t border-surface-2 dark:border-zinc-800">
              <View style={{ width: 14, height: 28, backgroundColor: plate.color, marginRight: 12, borderRadius: 3 }} />
              <Text className="font-mono-medium text-text-primary dark:text-white text-sm flex-1">{plate.label} lb</Text>
              <Text className="font-mono text-text-secondary dark:text-zinc-400 text-sm">× {count}</Text>
              <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs ml-4 w-16 text-right">{plate.weight * count} lbs</Text>
            </View>
          ))}
        </View>
      )}

      {/* Active plate legend */}
      <View className="flex-row flex-wrap gap-2">
        {activePlates.map((p) => (
          <View key={p.weight} className="flex-row items-center gap-1.5">
            <View style={{ width: 10, height: 18, backgroundColor: p.color, borderRadius: 2 }} />
            <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs">{p.label}</Text>
          </View>
        ))}
      </View>

      <PlateConfigPanel
        visible={configOpen}
        allPlates={allPlates}
        enabled={enabled}
        onToggle={handleToggle}
        onAddCustom={handleAddCustom}
        onDeleteCustom={handleDeleteCustom}
        onClose={() => setConfigOpen(false)}
      />
    </View>
  );
}
