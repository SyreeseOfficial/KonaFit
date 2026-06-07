import { View, Text, TouchableOpacity } from "react-native";
import Svg, { Rect, Ellipse, Path } from "react-native-svg";
import type { VolumeByMuscle } from "../../db/statsQueries";

// Map DB muscle groups to body regions
const MUSCLE_MAP: Record<string, string[]> = {
  Chest: ["chest"],
  Back: ["back"],
  Shoulders: ["shoulder_l", "shoulder_r"],
  Arms: ["arm_l", "arm_r"],
  Legs: ["quad_l", "quad_r", "calf_l", "calf_r"],
  Core: ["abs"],
};

// Regions that appear on front vs back view
const FRONT_REGIONS = new Set(["chest", "shoulder_l", "shoulder_r", "arm_l", "arm_r", "abs", "quad_l", "quad_r", "calf_l", "calf_r"]);
const BACK_REGIONS = new Set(["back", "shoulder_l", "shoulder_r", "arm_l", "arm_r", "quad_l", "quad_r", "calf_l", "calf_r"]);

function lerp(t: number, fromHex: string, toHex: string): string {
  const from = [
    parseInt(fromHex.slice(1, 3), 16),
    parseInt(fromHex.slice(3, 5), 16),
    parseInt(fromHex.slice(5, 7), 16),
  ];
  const to = [
    parseInt(toHex.slice(1, 3), 16),
    parseInt(toHex.slice(3, 5), 16),
    parseInt(toHex.slice(5, 7), 16),
  ];
  const r = Math.round(from[0] + (to[0] - from[0]) * t);
  const g = Math.round(from[1] + (to[1] - from[1]) * t);
  const b = Math.round(from[2] + (to[2] - from[2]) * t);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

type Props = { data: VolumeByMuscle[] };

export function MuscleHeatmap({ data }: Props) {
  const [side, setSide] = React.useState<"front" | "back">("front");

  // Compute normalized volume per region
  const maxVol = data.length > 0 ? Math.max(...data.map((d) => d.volumeLbs)) : 1;

  const regionColor = (regionId: string): string => {
    for (const [muscle, regions] of Object.entries(MUSCLE_MAP)) {
      if (regions.includes(regionId)) {
        const vol = data.find((d) => d.muscleGroup === muscle)?.volumeLbs ?? 0;
        const t = Math.min(vol / maxVol, 1);
        return lerp(Math.pow(t, 0.6), "#252525", "#FF0000");
      }
    }
    return "#1C1C1C";
  };

  const rc = (id: string) => regionColor(id);
  const visible = side === "front" ? FRONT_REGIONS : BACK_REGIONS;
  const show = (id: string) => visible.has(id);

  // SVG body: 120×240 viewBox
  return (
    <View>
      {/* Side toggle */}
      <View className="flex-row self-center mb-4">
        {(["front", "back"] as const).map((s) => (
          <TouchableOpacity
            key={s}
            onPress={() => setSide(s)}
            className={`px-4 py-1 ${s === "front" ? "mr-1" : ""} ${
              side === s ? "bg-crimson" : "bg-surface-2"
            }`}
            activeOpacity={0.7}
          >
            <Text
              className={`font-mono text-xs tracking-widest uppercase ${
                side === s ? "text-white" : "text-text-muted"
              }`}
            >
              {s}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View className="items-center">
        <Svg width={120} height={240} viewBox="0 0 120 240">
          {/* Head */}
          <Ellipse cx={60} cy={18} rx={14} ry={16} fill="#353534" />
          {/* Neck */}
          <Rect x={53} y={32} width={14} height={10} fill="#353534" />

          {/* Shoulders */}
          {show("shoulder_l") && <Ellipse cx={28} cy={52} rx={14} ry={10} fill={rc("shoulder_l")} />}
          {show("shoulder_r") && <Ellipse cx={92} cy={52} rx={14} ry={10} fill={rc("shoulder_r")} />}

          {/* Chest / Back torso */}
          {show("chest") && <Rect x={38} y={44} width={44} height={44} rx={4} fill={rc("chest")} />}
          {show("back") && <Rect x={38} y={44} width={44} height={44} rx={4} fill={rc("back")} />}

          {/* Abs */}
          {show("abs") && <Rect x={42} y={90} width={36} height={36} rx={3} fill={rc("abs")} />}
          {!show("abs") && <Rect x={42} y={90} width={36} height={36} rx={3} fill="#1C1C1C" />}

          {/* Arms */}
          {show("arm_l") && <Rect x={12} y={44} width={18} height={68} rx={8} fill={rc("arm_l")} />}
          {show("arm_r") && <Rect x={90} y={44} width={18} height={68} rx={8} fill={rc("arm_r")} />}

          {/* Forearms (static) */}
          <Rect x={10} y={116} width={16} height={42} rx={7} fill="#252525" />
          <Rect x={94} y={116} width={16} height={42} rx={7} fill="#252525" />

          {/* Quads */}
          {show("quad_l") && <Rect x={36} y={130} width={22} height={62} rx={8} fill={rc("quad_l")} />}
          {show("quad_r") && <Rect x={62} y={130} width={22} height={62} rx={8} fill={rc("quad_r")} />}

          {/* Calves */}
          {show("calf_l") && <Rect x={38} y={196} width={18} height={40} rx={7} fill={rc("calf_l")} />}
          {show("calf_r") && <Rect x={64} y={196} width={18} height={40} rx={7} fill={rc("calf_r")} />}
        </Svg>
      </View>

      {/* Legend */}
      <View className="flex-row justify-center items-center gap-3 mt-4">
        <View className="flex-row items-center gap-1.5">
          <View className="w-3 h-3 bg-surface-3" />
          <Text className="font-mono text-text-muted text-xs">None</Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          <View className="w-3 h-3" style={{ backgroundColor: lerp(0.4, "#252525", "#FF0000") }} />
          <Text className="font-mono text-text-muted text-xs">Low</Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          <View className="w-3 h-3 bg-crimson" />
          <Text className="font-mono text-text-muted text-xs">High</Text>
        </View>
      </View>
    </View>
  );
}

import React from "react";
