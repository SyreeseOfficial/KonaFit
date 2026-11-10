import { useState, useEffect, useCallback } from "react";
import { View, Text, TextInput, TouchableOpacity } from "react-native";
import { Scale } from "lucide-react-native";
import {
  logBodyweight,
  getBodyweightHistory,
  updateBodyweight,
  deleteBodyweight,
  type BodyweightEntry,
} from "../../db/statsQueries";
import { cleanDecimal, MIN_BODYWEIGHT, MAX_BODYWEIGHT } from "../../utils/numberInput";
import { confirm } from "../../utils/confirm";

type Props = { onSaved: () => void; refreshKey?: number };

const formatEntryDate = (secs: number) =>
  new Date(secs * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

export function BodyweightLogger({ onSaved, refreshKey }: Props) {
  const [bodyweight, setBodyweight] = useState("");
  const [saving, setSaving] = useState(false);
  const [bwSaved, setBwSaved] = useState(false);
  const [history, setHistory] = useState<BodyweightEntry[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);

  const loadHistory = useCallback(() => getBodyweightHistory().then(setHistory), []);
  useEffect(() => { loadHistory(); }, [loadHistory, refreshKey]);

  const valid = parseFloat(bodyweight) >= MIN_BODYWEIGHT;

  const handleSave = async () => {
    const val = parseFloat(bodyweight);
    if (!(val >= MIN_BODYWEIGHT)) return;
    setSaving(true);
    try {
      if (editingId != null) await updateBodyweight(editingId, val);
      else await logBodyweight(val);
      setBodyweight("");
      setEditingId(null);
      setBwSaved(true);
      setTimeout(() => setBwSaved(false), 2000);
      await loadHistory();
      onSaved();
    } finally { setSaving(false); }
  };

  const handleDelete = async (entry: BodyweightEntry) => {
    if (!(await confirm({ title: "Delete entry?", message: `${entry.weight_lbs} lbs on ${formatEntryDate(entry.logged_at)}`, confirmText: "Delete", destructive: true }))) return;
    await deleteBodyweight(entry.id);
    if (editingId === entry.id) { setEditingId(null); setBodyweight(""); }
    await loadHistory();
    onSaved();
  };

  return (
    <View className="bg-surface dark:bg-zinc-900 p-5 rounded-2xl">
      <View className="flex-row items-center gap-2 mb-4">
        <Scale size={14} color="#94A3B8" />
        <Text className="font-montserrat-semibold text-text-secondary dark:text-zinc-400 text-sm uppercase tracking-widest">
          Bodyweight
        </Text>
      </View>
      <View className="flex-row items-center gap-2">
        <TextInput
          className="flex-1 h-11 bg-surface-2 dark:bg-zinc-800 px-4 font-mono text-text-primary dark:text-white text-base rounded-xl"
          placeholder="lbs"
          placeholderTextColor="#94A3B8"
          value={bodyweight}
          onChangeText={(v) => { const c = cleanDecimal(v, MAX_BODYWEIGHT); if (c !== null) setBodyweight(c); }}
          keyboardType="decimal-pad"
          returnKeyType="done"
          onSubmitEditing={handleSave}
        />
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving || !valid}
          className={`h-11 px-5 items-center justify-center rounded-xl ${
            bwSaved ? "bg-emerald-50 dark:bg-emerald-950" : valid ? "bg-crimson dark:bg-blue-500" : "bg-surface-2 dark:bg-zinc-800"
          }`}
          activeOpacity={0.85}
        >
          <Text className={`font-montserrat-bold text-sm ${bwSaved ? "text-emerald-600 dark:text-emerald-400" : "text-white"}`}>
            {bwSaved ? "Saved ✓" : editingId != null ? "Update" : "Log"}
          </Text>
        </TouchableOpacity>
        {editingId != null && (
          <TouchableOpacity onPress={() => { setEditingId(null); setBodyweight(""); }} hitSlop={8}>
            <Text className="font-montserrat-semibold text-text-muted dark:text-zinc-500 text-sm">Cancel</Text>
          </TouchableOpacity>
        )}
      </View>

      {history.length > 0 && (
        <View className="mt-4">
          <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs mb-1">Tap to edit · hold to delete</Text>
          {history.map((h) => (
            <TouchableOpacity
              key={h.id}
              onPress={() => { setEditingId(h.id); setBodyweight(String(h.weight_lbs)); }}
              onLongPress={() => handleDelete(h)}
              className={`flex-row items-center justify-between h-11 px-2 -mx-2 rounded-lg ${editingId === h.id ? "bg-surface-2 dark:bg-zinc-800" : ""}`}
              activeOpacity={0.7}
            >
              <Text className="font-mono text-text-secondary dark:text-zinc-400 text-sm">{formatEntryDate(h.logged_at)}</Text>
              <Text className="font-mono-medium text-text-primary dark:text-white text-sm">{h.weight_lbs} lbs</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}
