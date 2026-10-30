import { View, Text, TouchableOpacity } from "react-native";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import { RpeRow } from "./RpeRow";
import { FocusChips } from "./FocusChips";
import type { FocusChip } from "../../types/boxing";
import type { RoundLogEntry } from "../../utils/boxingSnapshot";

type Props = {
  /** 1-based rounds that can be logged now (finished or in progress) */
  rounds: number[];
  round: number;
  onSelectRound: (r: number) => void;
  entry: RoundLogEntry;
  onChange: (patch: Partial<RoundLogEntry>) => void;
  chips: FocusChip[];
  open: boolean;
  onToggleOpen: () => void;
};

/** Optional RPE + focus entry for one round, with a strip to jump to earlier rounds. Collapsed by default so the clock stays big. */
export function RoundLogCard({ rounds, round, onSelectRound, entry, onChange, chips, open, onToggleOpen }: Props) {
  const toggleChip = (id: number) =>
    onChange({ focusTags: entry.focusTags.includes(id) ? entry.focusTags.filter((x) => x !== id) : [...entry.focusTags, id] });
  return (
    <View className="mx-5 mb-3 bg-surface dark:bg-zinc-900 rounded-2xl overflow-hidden">
      <TouchableOpacity onPress={onToggleOpen} className="flex-row items-center px-4 py-3" activeOpacity={0.7}>
        <Text className="font-montserrat-bold text-text-primary dark:text-white text-sm flex-1">
          Round {round}{entry.rpe ? ` · RPE ${entry.rpe}` : " · tap to log"}
        </Text>
        {open ? <ChevronDown size={18} color="#94A3B8" /> : <ChevronUp size={18} color="#94A3B8" />}
      </TouchableOpacity>
      {open && (
        <View className="px-4 pb-4" style={{ gap: 12 }}>
          {rounds.length > 1 && (
            <View className="flex-row flex-wrap" style={{ gap: 6 }}>
              {rounds.map((r) => (
                <TouchableOpacity
                  key={r}
                  onPress={() => onSelectRound(r)}
                  className={`w-9 h-9 items-center justify-center rounded-full ${r === round ? "bg-crimson dark:bg-blue-500" : "bg-surface-2 dark:bg-zinc-800"}`}
                  activeOpacity={0.7}
                >
                  <Text className={`font-mono-medium text-sm ${r === round ? "text-white" : "text-text-primary dark:text-white"}`}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <RpeRow value={entry.rpe} onChange={(rpe) => onChange({ rpe })} />
          <FocusChips chips={chips} selected={entry.focusTags} onToggle={toggleChip} note={entry.focusNote} onNoteChange={(focusNote) => onChange({ focusNote })} />
        </View>
      )}
    </View>
  );
}
