import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import Svg, { Rect, Ellipse } from "react-native-svg";
import type { VolumeByMuscle } from "../../db/statsQueries";

const MUSCLE_MAP: Record<string, string[]> = {
  Chest:     ["chest"],
  Back:      ["back"],
  Shoulders: ["shoulder_l", "shoulder_r"],
  Arms:      ["arm_l", "arm_r"],
  Legs:      ["quad_l", "quad_r", "calf_l", "calf_r"],
  Core:      ["abs"],
};

const FRONT_REGIONS = new Set(["chest", "shoulder_l", "shoulder_r", "arm_l", "arm_r", "abs", "quad_l", "quad_r", "calf_l", "calf_r"]);
const BACK_REGIONS  = new Set(["back",  "shoulder_l", "shoulder_r", "arm_l", "arm_r", "quad_l", "quad_r", "calf_l", "calf_r"]);

function lerp(t: number, fromHex: string, toHex: string): string {
  const p = (h: string, o: number) => parseInt(h.slice(o, o + 2), 16);
  const r = Math.round(p(fromHex,1) + (p(toHex,1) - p(fromHex,1)) * t);
  const g = Math.round(p(fromHex,3) + (p(toHex,3) - p(fromHex,3)) * t);
  const b = Math.round(p(fromHex,5) + (p(toHex,5) - p(fromHex,5)) * t);
  return `#${r.toString(16).padStart(2,"0")}${g.toString(16).padStart(2,"0")}${b.toString(16).padStart(2,"0")}`;
}

type Props = { data: VolumeByMuscle[] };

export function MuscleHeatmap({ data }: Props) {
  const [side, setSide] = React.useState<"front" | "back">("front");

  const maxVol = data.length > 0 ? Math.max(...data.map((d) => d.volumeLbs)) : 1;

  const regionColor = (regionId: string): string => {
    for (const [muscle, regions] of Object.entries(MUSCLE_MAP)) {
      if (regions.includes(regionId)) {
        const vol = data.find((d) => d.muscleGroup === muscle)?.volumeLbs ?? 0;
        if (vol === 0) return "#E2E8F0";
        return lerp(Math.pow(vol / maxVol, 0.6), "#BFDBFE", "#2563EB");
      }
    }
    return "#E2E8F0";
  };

  const rc = (id: string) => regionColor(id);
  const visible = side === "front" ? FRONT_REGIONS : BACK_REGIONS;
  const show = (id: string) => visible.has(id);

  return (
    <View>
      <View className="flex-row self-center mb-4 gap-1.5">
        {(["front", "back"] as const).map((s) => (
          <TouchableOpacity
            key={s}
            onPress={() => setSide(s)}
            className={`px-5 py-2 rounded-full ${side === s ? "bg-crimson dark:bg-blue-500" : "bg-surface-2 dark:bg-zinc-800"}`}
            activeOpacity={0.7}
          >
            <Text className={`font-mono text-xs tracking-widest uppercase ${side === s ? "text-white" : "text-text-muted dark:text-zinc-500"}`}>
              {s}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View className="items-center">
        <Svg width={120} height={240} viewBox="0 0 120 240">
          <Ellipse cx={60} cy={18} rx={14} ry={16} fill="#CBD5E1" />
          <Rect x={53} y={32} width={14} height={10} fill="#CBD5E1" />

          {show("shoulder_l") && <Ellipse cx={28} cy={52} rx={14} ry={10} fill={rc("shoulder_l")} />}
          {show("shoulder_r") && <Ellipse cx={92} cy={52} rx={14} ry={10} fill={rc("shoulder_r")} />}

          {show("chest") && <Rect x={38} y={44} width={44} height={44} rx={4} fill={rc("chest")} />}
          {show("back")  && <Rect x={38} y={44} width={44} height={44} rx={4} fill={rc("back")} />}

          {show("abs") && <Rect x={42} y={90} width={36} height={36} rx={3} fill={rc("abs")} />}
          {!show("abs") && <Rect x={42} y={90} width={36} height={36} rx={3} fill="#E2E8F0" />}

          {show("arm_l") && <Rect x={12} y={44} width={18} height={68} rx={8} fill={rc("arm_l")} />}
          {show("arm_r") && <Rect x={90} y={44} width={18} height={68} rx={8} fill={rc("arm_r")} />}

          <Rect x={10} y={116} width={16} height={42} rx={7} fill="#CBD5E1" />
          <Rect x={94} y={116} width={16} height={42} rx={7} fill="#CBD5E1" />

          {show("quad_l") && <Rect x={36} y={130} width={22} height={62} rx={8} fill={rc("quad_l")} />}
          {show("quad_r") && <Rect x={62} y={130} width={22} height={62} rx={8} fill={rc("quad_r")} />}

          {show("calf_l") && <Rect x={38} y={196} width={18} height={40} rx={7} fill={rc("calf_l")} />}
          {show("calf_r") && <Rect x={64} y={196} width={18} height={40} rx={7} fill={rc("calf_r")} />}
        </Svg>
      </View>

      <View className="flex-row justify-center items-center gap-3 mt-4">
        <View className="flex-row items-center gap-1.5">
          <View className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#E2E8F0" }} />
          <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs">None</Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          <View className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#BFDBFE" }} />
          <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs">Low</Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          <View className="w-3 h-3 rounded-sm bg-crimson dark:bg-blue-500" />
          <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs">High</Text>
        </View>
      </View>
    </View>
  );
}
