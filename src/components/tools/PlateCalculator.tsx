import { useState, useMemo } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, useWindowDimensions } from "react-native";
import Svg, { Rect, Text as SvgText } from "react-native-svg";
import {
  PLATES,
  BAR_OPTIONS,
  calculatePlates,
  type PlateResult,
} from "../../utils/plateCalc";

const PLATE_W = 14;
const BAR_H = 10;
const BAR_Y_CENTER = 50; // within SVG height of 100
const COLLAR_W = 8;
const COLLAR_COLOR = "#888888";

type Props = {
  initialWeight?: number;
};

export function PlateCalculator({ initialWeight }: Props) {
  const { width } = useWindowDimensions();
  const svgWidth = width - 32;

  const [targetInput, setTargetInput] = useState(
    initialWeight ? String(initialWeight) : ""
  );
  const [barIdx, setBarIdx] = useState(0);

  const barWeight = BAR_OPTIONS[barIdx].weight;
  const targetLbs = parseFloat(targetInput);
  const isValid = !isNaN(targetLbs) && targetLbs > 0;

  const results: PlateResult[] | null = useMemo(() => {
    if (!isValid) return null;
    return calculatePlates(targetLbs, barWeight);
  }, [targetLbs, barWeight]);

  const perSide = isValid ? (targetLbs - barWeight) / 2 : 0;
  const loadable = results !== null;
  const totalPlateWeight =
    results?.reduce((sum, r) => sum + r.plate.weight * r.count * 2, 0) ?? 0;
  const isExact = Math.abs(totalPlateWeight - (targetLbs - barWeight)) < 0.01;

  // Build flat list of plates per side for SVG (largest → smallest, left to right from center)
  const platesPerSide: PlateConfig[] = [];
  results?.forEach(({ plate, count }) => {
    for (let i = 0; i < count; i++) platesPerSide.push(plate);
  });

  // SVG layout
  const centerX = svgWidth / 2;
  const collarOffset = COLLAR_W + 2;
  const svgHeight = 100;

  // Build plate positions for right side
  const rightPlates: { plate: PlateConfig; x: number }[] = [];
  let rightX = centerX + collarOffset;
  for (const plate of platesPerSide) {
    rightPlates.push({ plate, x: rightX });
    rightX += PLATE_W + 1;
  }

  // Left side is mirrored
  const leftPlates: { plate: PlateConfig; x: number }[] = [];
  let leftX = centerX - collarOffset - PLATE_W;
  for (const plate of platesPerSide) {
    leftPlates.push({ plate, x: leftX });
    leftX -= PLATE_W + 1;
  }

  return (
    <View>
      {/* Weight input */}
      <View className="flex-row items-center gap-2 mb-4">
        <TextInput
          className="flex-1 h-12 bg-surface-2 px-4 font-mono-medium text-white text-xl text-center"
          placeholder="Target weight"
          placeholderTextColor="#606060"
          value={targetInput}
          onChangeText={setTargetInput}
          keyboardType="decimal-pad"
          selectTextOnFocus
        />
        <Text className="font-mono text-text-muted text-sm">lbs</Text>
      </View>

      {/* Bar selector */}
      <View className="flex-row gap-1 mb-5">
        <Text className="font-mono text-text-muted text-xs tracking-wider self-center mr-2">
          BAR:
        </Text>
        {BAR_OPTIONS.map((opt, i) => (
          <TouchableOpacity
            key={opt.label}
            onPress={() => setBarIdx(i)}
            className={`px-3 py-1.5 ${barIdx === i ? "bg-crimson" : "bg-surface-2"}`}
            activeOpacity={0.7}
          >
            <Text className={`font-mono text-xs ${barIdx === i ? "text-white" : "text-text-muted"}`}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* SVG Barbell */}
      {isValid && loadable && results !== null && (
        <View className="bg-surface mb-4 overflow-hidden">
          <Svg width={svgWidth} height={svgHeight}>
            {/* Full bar */}
            <Rect
              x={0}
              y={BAR_Y_CENTER - BAR_H / 2}
              width={svgWidth}
              height={BAR_H}
              fill="#555555"
            />

            {/* Left collar */}
            <Rect
              x={centerX - collarOffset - COLLAR_W}
              y={BAR_Y_CENTER - 14}
              width={COLLAR_W}
              height={28}
              fill={COLLAR_COLOR}
            />
            {/* Right collar */}
            <Rect
              x={centerX + collarOffset}
              y={BAR_Y_CENTER - 14}
              width={COLLAR_W}
              height={28}
              fill={COLLAR_COLOR}
            />

            {/* Right plates */}
            {rightPlates.map(({ plate, x }, i) => {
              const h = plate.heightPx;
              const y = BAR_Y_CENTER - h / 2;
              return (
                <React.Fragment key={`r-${i}`}>
                  <Rect x={x} y={y} width={PLATE_W} height={h} fill={plate.color} />
                  {i === 0 && (
                    <SvgText
                      x={x + PLATE_W / 2}
                      y={BAR_Y_CENTER + 4}
                      textAnchor="middle"
                      fill={plate.textColor}
                      fontSize={6}
                      fontFamily="JetBrainsMono_400Regular"
                    >
                      {plate.label}
                    </SvgText>
                  )}
                </React.Fragment>
              );
            })}

            {/* Left plates */}
            {leftPlates.map(({ plate, x }, i) => {
              const h = plate.heightPx;
              const y = BAR_Y_CENTER - h / 2;
              return (
                <Rect key={`l-${i}`} x={x} y={y} width={PLATE_W} height={h} fill={plate.color} />
              );
            })}
          </Svg>

          {/* Total info */}
          <View className="flex-row justify-between px-4 pb-3 pt-1">
            <Text className="font-mono text-text-muted text-xs">
              Bar: {barWeight} lbs
            </Text>
            <Text className={`font-mono text-xs ${isExact ? "text-text-secondary" : "text-crimson"}`}>
              {isExact
                ? `${perSide} lbs/side`
                : `≈ ${(totalPlateWeight / 2 + barWeight / 2).toFixed(1)} lbs/side`}
            </Text>
          </View>
        </View>
      )}

      {/* Error states */}
      {isValid && !loadable && (
        <View className="bg-surface p-4 mb-4">
          <Text className="font-montserrat text-crimson text-xs text-center">
            Target weight is less than bar weight ({barWeight} lbs)
          </Text>
        </View>
      )}

      {!isExact && isValid && loadable && (
        <View className="bg-surface px-4 py-2 mb-3">
          <Text className="font-mono text-text-muted text-xs text-center">
            Cannot load exactly — closest is {totalPlateWeight + barWeight} lbs
          </Text>
        </View>
      )}

      {/* Plate breakdown */}
      {results && results.length > 0 && (
        <View className="bg-surface">
          <Text className="font-mono text-text-muted text-xs tracking-widest uppercase px-4 pt-3 pb-2">
            Per Side
          </Text>
          {results.map(({ plate, count }) => (
            <View
              key={plate.weight}
              className="flex-row items-center px-4 py-2.5 border-t border-surface-2"
            >
              <View
                style={{ width: 14, height: 28, backgroundColor: plate.color, marginRight: 12 }}
              />
              <Text className="font-mono-medium text-white text-sm flex-1">
                {plate.label} lb
              </Text>
              <Text className="font-mono text-text-secondary text-sm">
                × {count}
              </Text>
              <Text className="font-mono text-text-muted text-xs ml-3 w-16 text-right">
                {plate.weight * count} lbs
              </Text>
            </View>
          ))}
          {results.length === 0 && (
            <Text className="font-mono text-text-muted text-xs px-4 py-3">
              Bar only
            </Text>
          )}
        </View>
      )}

      {/* Plate color legend */}
      <View className="mt-4 flex-row flex-wrap gap-2">
        {PLATES.map((p) => (
          <View key={p.weight} className="flex-row items-center gap-1.5">
            <View style={{ width: 10, height: 18, backgroundColor: p.color }} />
            <Text className="font-mono text-text-muted text-xs">{p.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

import React from "react";
import type { PlateConfig } from "../../utils/plateCalc";
