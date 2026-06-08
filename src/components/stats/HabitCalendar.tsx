import { View, Text } from "react-native";

const WEEKS = 13;
const CELL = 13;
const GAP = 2;
const STEP = CELL + GAP;
const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

type Props = { workoutDays: Set<string> };

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function HabitCalendar({ workoutDays }: Props) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = fmt(today);

  // Anchor the grid's bottom-right cell to the Saturday of the current week
  const dayOfWeek = today.getDay(); // 0=Sun, 6=Sat
  const daysToSat = (6 - dayOfWeek + 7) % 7;
  const endSat = new Date(today.getTime() + daysToSat * 86400_000);

  // Build cells: w = 0 (oldest, LEFT) → WEEKS-1 (newest, RIGHT)
  //              d = 0 (Sunday, TOP) → 6 (Saturday, BOTTOM)
  // endSat occupies w=WEEKS-1, d=6
  const cells: { date: string; week: number; day: number }[] = [];
  for (let w = 0; w < WEEKS; w++) {
    for (let d = 0; d < 7; d++) {
      const daysBack = (WEEKS - 1 - w) * 7 + (6 - d);
      const date = new Date(endSat.getTime() - daysBack * 86400_000);
      cells.push({ date: fmt(date), week: w, day: d });
    }
  }

  // Month labels: placed above the first column where a new month begins
  const monthLabels: { week: number; label: string }[] = [];
  let lastMonth = -1;
  for (let w = 0; w < WEEKS; w++) {
    const topCell = cells.find((c) => c.week === w && c.day === 0);
    if (!topCell) continue;
    const month = new Date(topCell.date).getMonth();
    if (month !== lastMonth) {
      monthLabels.push({
        week: w,
        label: new Date(topCell.date).toLocaleString("default", { month: "short" }),
      });
      lastMonth = month;
    }
  }

  const gridWidth = WEEKS * STEP - GAP;
  const gridHeight = 7 * STEP - GAP;

  return (
    <View>
      {/* Month labels */}
      <View style={{ flexDirection: "row", marginBottom: 4, marginLeft: 20, height: 12 }}>
        {monthLabels.map((ml) => (
          <Text
            key={ml.week}
            style={{
              position: "absolute",
              left: ml.week * STEP,
              fontFamily: "JetBrainsMono_400Regular",
              fontSize: 9,
              color: "#606060",
              letterSpacing: 1,
              textTransform: "uppercase",
            }}
          >
            {ml.label}
          </Text>
        ))}
      </View>

      <View style={{ flexDirection: "row" }}>
        {/* Day labels (only even rows to avoid clutter) */}
        <View style={{ marginRight: 6 }}>
          {DAY_LABELS.map((l, i) => (
            <View
              key={i}
              style={{ height: CELL, marginBottom: i < 6 ? GAP : 0, justifyContent: "center" }}
            >
              {i % 2 === 1 && (
                <Text style={{ fontFamily: "JetBrainsMono_400Regular", fontSize: 9, color: "#606060" }}>
                  {l}
                </Text>
              )}
            </View>
          ))}
        </View>

        {/* Grid */}
        <View style={{ width: gridWidth, height: gridHeight, position: "relative" }}>
          {cells.map(({ date, week, day }) => {
            const hasWorkout = workoutDays.has(date);
            const isFuture = date > todayStr;
            return (
              <View
                key={date}
                style={{
                  position: "absolute",
                  left: week * STEP,
                  top: day * STEP,
                  width: CELL,
                  height: CELL,
                  backgroundColor: isFuture ? "transparent" : hasWorkout ? "#FF0000" : "#252525",
                  borderRadius: 2,
                  opacity: isFuture ? 0 : 1,
                }}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
}
