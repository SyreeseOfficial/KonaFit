import { View, Text } from "react-native";

const WEEKS = 13;
const CELL = 13;
const GAP = 2;
const STEP = CELL + GAP;
const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

type Props = {
  workoutDays: Set<string>;
};

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function HabitCalendar({ workoutDays }: Props) {
  // Build grid: columns = weeks (newest right), rows = weekdays (0=Sun)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Anchor to end of current week (Saturday)
  const dayOfWeek = today.getDay(); // 0=Sun
  const endDate = new Date(today.getTime() + (6 - dayOfWeek) * 86400_000);

  // Grid is WEEKS columns × 7 rows
  const cells: { date: string; week: number; day: number }[] = [];
  for (let w = WEEKS - 1; w >= 0; w--) {
    for (let d = 0; d < 7; d++) {
      const offset = (WEEKS - 1 - w) * 7 + (6 - d);
      const date = new Date(endDate.getTime() - offset * 86400_000);
      cells.push({ date: fmt(date), week: WEEKS - 1 - w, day: d });
    }
  }

  // Month labels: detect month transitions
  const monthLabels: { week: number; label: string }[] = [];
  let lastMonth = -1;
  for (let w = 0; w < WEEKS; w++) {
    const cell = cells.find((c) => c.week === w && c.day === 0);
    if (!cell) continue;
    const month = new Date(cell.date).getMonth();
    if (month !== lastMonth) {
      monthLabels.push({
        week: w,
        label: new Date(cell.date).toLocaleString("default", { month: "short" }),
      });
      lastMonth = month;
    }
  }

  const gridWidth = WEEKS * STEP - GAP;
  const gridHeight = 7 * STEP - GAP;

  return (
    <View>
      {/* Month labels row */}
      <View style={{ flexDirection: "row", marginBottom: 4, marginLeft: 20 }}>
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
        <View style={{ height: 12, width: gridWidth }} />
      </View>

      <View style={{ flexDirection: "row" }}>
        {/* Day labels */}
        <View style={{ marginRight: 6 }}>
          {DAY_LABELS.map((l, i) => (
            <View key={i} style={{ height: CELL, marginBottom: i < 6 ? GAP : 0, justifyContent: "center" }}>
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
            const isFuture = date > fmt(today);
            return (
              <View
                key={date}
                style={{
                  position: "absolute",
                  left: week * STEP,
                  top: day * STEP,
                  width: CELL,
                  height: CELL,
                  backgroundColor: isFuture
                    ? "transparent"
                    : hasWorkout
                    ? "#FF0000"
                    : "#252525",
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
