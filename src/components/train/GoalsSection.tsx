import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Plus, X, Check, ChevronRight } from "lucide-react-native";
import { EmptyState } from "../EmptyState";
import {
  getGoals,
  createGoal,
  deleteGoal,
  markGoalAchieved,
  unmarkGoalAchieved,
  getGoalProgress,
  goalFraction,
  goalEnded,
  isBoxingGoal,
  type Goal,
  type GoalType,
} from "../../db/goalQueries";
import { AddExerciseSheet } from "../workout/AddExerciseSheet";
import { DateField } from "../boxing/DateField";
import { BOXING_DOT } from "../../utils/theme";
import { formatShortDate } from "../../utils/exportUtils";
import { toDateFields, fromDateFields, type DateFields } from "../../utils/dateEdit";
import type { Exercise } from "../../types/workout";

function ProgressBar({ pct }: { pct: number }) {
  return (
    <View className="h-1 bg-surface-2 dark:bg-zinc-800 mt-2 rounded-full overflow-hidden">
      <View
        className="h-1 bg-crimson dark:bg-blue-500 rounded-full"
        style={{ width: `${pct * 100}%` }}
      />
    </View>
  );
}

const BOXING_UNITS: Record<string, string> = { boxing_rounds: "rounds", boxing_sessions: "sessions", boxing_minutes: "min" };

/** The progress lines of a boxing goal: this week's total (or the range's average RPE), the target and the dates. */
function BoxingGoalLines({ goal, progress }: { goal: Goal; progress: number | null }) {
  const ended = goalEnded(goal);
  const avg = goal.type === "boxing_avg_rpe";
  const target = goal.target_value ?? 0;
  const now = progress == null ? "–" : avg ? progress.toFixed(1) : String(Math.round(progress * 10) / 10);
  const line = avg
    ? `Avg RPE ${now} · ${goal.direction === "up" ? "keep at least" : "keep under"} ${target}`
    : `This week: ${now} / ${target} ${BOXING_UNITS[goal.type]}`;
  return (
    <>
      <Text className="font-mono text-text-secondary dark:text-zinc-400 text-xs mt-1">{line}</Text>
      {(goal.start_date != null || goal.end_date != null) && (
        <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs mt-0.5">
          {goal.start_date != null ? formatShortDate(goal.start_date) : "…"} – {goal.end_date != null ? formatShortDate(goal.end_date) : "…"}{ended ? " · Ended" : ""}
        </Text>
      )}
    </>
  );
}

function GoalCard({
  goal, progress, onToggleAchieved, onDelete,
}: {
  goal: Goal & { progress: number | null };
  progress: number | null;
  onToggleAchieved: () => void;
  onDelete: () => void;
}) {
  const isAchieved = goal.is_achieved === 1;
  const accentColor =
    goal.type === "lift_pr" ? "#2563EB" :
    goal.type === "bodyweight" ? "#8B5CF6" : isBoxingGoal(goal.type) ? BOXING_DOT : "#64748B";

  const hasRepTarget = goal.type === "lift_pr" && goal.target_reps != null;
  const progressLabel =
    hasRepTarget ? "Best reps" :
    goal.type === "lift_pr" ? "Best 1RM" :
    goal.type === "bodyweight" ? "Current" : null;
  const progressUnit = hasRepTarget ? "reps" : "lbs";
  const fraction = goalFraction(goal, progress);

  return (
    <View
      style={{ borderLeftWidth: 3, borderLeftColor: accentColor }}
      className={`bg-surface dark:bg-zinc-900 mb-2 rounded-r-xl ${isAchieved ? "opacity-50" : ""}`}
    >
      <View className="px-4 py-4 flex-row items-start">
        <View className="flex-1 mr-3">
          <Text className={`font-montserrat-bold text-base ${isAchieved ? "text-text-muted dark:text-zinc-500 line-through" : "text-text-primary dark:text-white"}`}>
            {goal.title}
          </Text>
          {goal.exercise_name && goal.type === "lift_pr" && (
            <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs mt-0.5">{goal.exercise_name}</Text>
          )}
          {isBoxingGoal(goal.type) && <BoxingGoalLines goal={goal} progress={progress} />}
          {goal.target_value !== null && !isBoxingGoal(goal.type) && (
            <View className="flex-row items-baseline mt-1" style={{ gap: 6 }}>
              {progress !== null && progressLabel && (
                <Text className="font-mono text-text-secondary dark:text-zinc-400 text-xs">
                  {progressLabel}: {hasRepTarget ? Math.round(progress) : progress.toFixed(1)} {progressUnit} →
                </Text>
              )}
              <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs">
                Target: {goal.target_value} lbs{goal.target_reps != null ? ` × ${goal.target_reps} reps` : ""}
              </Text>
            </View>
          )}
          {goal.notes ? (
            <Text className="font-montserrat text-text-muted dark:text-zinc-500 text-xs mt-1" numberOfLines={2}>
              {goal.notes}
            </Text>
          ) : null}
          {fraction !== null && !isAchieved && <ProgressBar pct={fraction} />}
        </View>
        <View className="flex-row items-center" style={{ gap: 12 }}>
          <TouchableOpacity
            onPress={onToggleAchieved}
            hitSlop={8}
            className={`w-7 h-7 items-center justify-center rounded-full border ${
              isAchieved
                ? "bg-crimson dark:bg-blue-500 border-crimson dark:border-blue-500"
                : "border-surface-3 dark:border-zinc-700"
            }`}
            activeOpacity={0.7}
          >
            <Check size={14} color={isAchieved ? "#FFFFFF" : "#94A3B8"} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} hitSlop={8} activeOpacity={0.7}>
            <X size={14} color="#94A3B8" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

type GoalFormState = {
  type: GoalType;
  exerciseId: number | null;
  exerciseName: string | null;
  targetValue: string;
  targetReps: string;
  title: string;
  notes: string;
  startDate: DateFields;
  endDate: DateFields;
  direction: "up" | "down";
};

const defaultForm = (): GoalFormState => {
  const now = Math.floor(Date.now() / 1000);
  return {
    type: "lift_pr", exerciseId: null, exerciseName: null,
    targetValue: "", targetReps: "", title: "", notes: "",
    startDate: toDateFields(now), endDate: toDateFields(now + 56 * 86400), direction: "down",
  };
};

const BOXING_METRICS: { key: GoalType; label: string }[] = [
  { key: "boxing_rounds", label: "Rounds / wk" },
  { key: "boxing_sessions", label: "Sessions / wk" },
  { key: "boxing_minutes", label: "Minutes / wk" },
  { key: "boxing_avg_rpe", label: "Avg RPE" },
];

const GOAL_TYPES: { key: GoalType; label: string }[] = [
  { key: "lift_pr", label: "Lift PR" },
  { key: "bodyweight", label: "Body Weight" },
  { key: "custom", label: "Custom" },
  { key: "boxing_rounds", label: "Boxing" },
];

function boxingTitle(f: GoalFormState): string {
  const t = f.targetValue;
  switch (f.type) {
    case "boxing_rounds": return `${t} rounds / week`;
    case "boxing_sessions": return `${t} boxing sessions / week`;
    case "boxing_minutes": return `${t} boxing min / week`;
    default: return `Avg boxing RPE ${f.direction === "up" ? "at least" : "under"} ${t}`;
  }
}

/** Start (midnight) and end (end of day) as unix seconds, or null if either date is invalid or the end is before the start. */
function boxingRange(f: GoalFormState): { start: number; end: number } | null {
  const start = fromDateFields(f.startDate);
  const end = fromDateFields(f.endDate, true);
  return start != null && end != null && end > start ? { start, end } : null;
}

function AddGoalModal({
  visible, form, onFormChange, onOpenExercisePicker, onSave, onClose, saving,
}: {
  visible: boolean;
  form: GoalFormState;
  onFormChange: (patch: Partial<GoalFormState>) => void;
  onOpenExercisePicker: () => void;
  onSave: () => void;
  onClose: () => void;
  saving: boolean;
}) {
  const canSave =
    form.type === "lift_pr" ? form.exerciseId !== null && form.targetValue.trim() !== "" :
    form.type === "bodyweight" ? form.targetValue.trim() !== "" :
    isBoxingGoal(form.type) ? form.targetValue.trim() !== "" && boxingRange(form) !== null :
    form.title.trim() !== "";

  const labelClass = "font-mono text-text-muted dark:text-zinc-500 text-xs uppercase tracking-widest mb-1.5";
  const inputClass = "bg-surface-3 dark:bg-zinc-700 px-4 py-3.5 font-montserrat text-text-primary dark:text-white text-base rounded-xl border border-surface-3 dark:border-zinc-700";

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <Pressable className="flex-1 bg-black/70 justify-end" onPress={onClose}>
          <Pressable>
            <View className="bg-surface dark:bg-zinc-900 pb-10 rounded-t-3xl">
              <View className="flex-row items-center justify-between px-5 py-5 border-b border-surface-2 dark:border-zinc-800">
                <Text className="font-montserrat-bold text-text-primary dark:text-white text-lg">Add Goal</Text>
                <TouchableOpacity onPress={onClose} hitSlop={8}>
                  <X size={18} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              <ScrollView style={{ maxHeight: 520 }} keyboardShouldPersistTaps="handled">
                <View className="px-5 py-5" style={{ gap: 20 }}>
                  {/* Type selector */}
                  <View>
                    <Text className={labelClass}>Goal Type</Text>
                    <View className="flex-row gap-2">
                      {GOAL_TYPES.map((t) => (
                        <TouchableOpacity
                          key={t.key}
                          onPress={() => onFormChange({ type: t.key, exerciseId: null, exerciseName: null, targetValue: "", targetReps: "", title: "", notes: "" })}
                          style={{ flex: 1 }}
                          className={`py-3 items-center rounded-full border ${
                            (t.key === "boxing_rounds" ? isBoxingGoal(form.type) : form.type === t.key)
                              ? "bg-crimson dark:bg-blue-500 border-crimson dark:border-blue-500"
                              : "bg-surface-2 dark:bg-zinc-800 border-surface-3 dark:border-zinc-700"
                          }`}
                          activeOpacity={0.7}
                        >
                          <Text className={`font-montserrat-semibold text-xs ${(t.key === "boxing_rounds" ? isBoxingGoal(form.type) : form.type === t.key) ? "text-white" : "text-text-secondary dark:text-zinc-400"}`}>
                            {t.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Lift PR */}
                  {form.type === "lift_pr" && (
                    <>
                      <View>
                        <Text className={labelClass}>Exercise</Text>
                        <TouchableOpacity
                          onPress={onOpenExercisePicker}
                          className="bg-surface-2 dark:bg-zinc-800 px-4 py-3.5 flex-row items-center justify-between rounded-xl border border-surface-3 dark:border-zinc-700"
                          activeOpacity={0.7}
                        >
                          <Text className={`font-montserrat text-base ${form.exerciseName ? "text-text-primary dark:text-white" : "text-text-muted dark:text-zinc-500"}`}>
                            {form.exerciseName ?? "Select exercise…"}
                          </Text>
                          <ChevronRight size={16} color="#94A3B8" />
                        </TouchableOpacity>
                      </View>
                      <View className="flex-row gap-3">
                        <View className="flex-1">
                          <Text className={labelClass}>Target Weight (lbs)</Text>
                          <TextInput className={inputClass} placeholder="e.g. 315" placeholderTextColor="#94A3B8" value={form.targetValue} onChangeText={(v) => onFormChange({ targetValue: v })} keyboardType="decimal-pad" />
                        </View>
                        <View style={{ width: 110 }}>
                          <Text className={labelClass}>Target Reps</Text>
                          <TextInput className={inputClass} placeholder="e.g. 10" placeholderTextColor="#94A3B8" value={form.targetReps} onChangeText={(v) => onFormChange({ targetReps: v })} keyboardType="number-pad" />
                        </View>
                      </View>
                    </>
                  )}

                  {/* Bodyweight */}
                  {form.type === "bodyweight" && (
                    <View>
                      <Text className={labelClass}>Target Weight (lbs)</Text>
                      <TextInput className={inputClass} placeholder="e.g. 180" placeholderTextColor="#94A3B8" value={form.targetValue} onChangeText={(v) => onFormChange({ targetValue: v })} keyboardType="decimal-pad" />
                    </View>
                  )}

                  {/* Boxing */}
                  {isBoxingGoal(form.type) && (
                    <>
                      <View>
                        <Text className={labelClass}>Measure</Text>
                        <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                          {BOXING_METRICS.map((m) => (
                            <TouchableOpacity key={m.key} onPress={() => onFormChange({ type: m.key })} activeOpacity={0.7}
                              className={`px-4 py-2.5 rounded-xl ${form.type === m.key ? "bg-crimson dark:bg-blue-500" : "bg-surface-2 dark:bg-zinc-800"}`}>
                              <Text className={`font-montserrat-semibold text-sm ${form.type === m.key ? "text-white" : "text-text-primary dark:text-white"}`}>{m.label}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                      <View>
                        <Text className={labelClass}>{form.type === "boxing_avg_rpe" ? "Target RPE" : "Target per week"}</Text>
                        <TextInput className={inputClass} placeholder={form.type === "boxing_avg_rpe" ? "e.g. 8" : "e.g. 30"} placeholderTextColor="#94A3B8" value={form.targetValue} onChangeText={(v) => onFormChange({ targetValue: v })} keyboardType="decimal-pad" />
                      </View>
                      {form.type === "boxing_avg_rpe" && (
                        <View className="flex-row" style={{ gap: 8 }}>
                          {([["down", "Stay under"], ["up", "Stay at or over"]] as const).map(([d, t]) => (
                            <TouchableOpacity key={d} onPress={() => onFormChange({ direction: d })} activeOpacity={0.7}
                              className={`px-4 py-2.5 rounded-xl ${form.direction === d ? "bg-crimson dark:bg-blue-500" : "bg-surface-2 dark:bg-zinc-800"}`}>
                              <Text className={`font-montserrat-semibold text-sm ${form.direction === d ? "text-white" : "text-text-primary dark:text-white"}`}>{t}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                      <View>
                        <Text className={labelClass}>Starts</Text>
                        <DateField value={form.startDate} onChange={(startDate) => onFormChange({ startDate })} />
                      </View>
                      <View>
                        <Text className={labelClass}>Ends</Text>
                        <DateField value={form.endDate} onChange={(endDate) => onFormChange({ endDate })} />
                        {boxingRange(form) === null && <Text className="font-montserrat text-rose-500 text-xs mt-1.5">Use real dates, with the end after the start</Text>}
                      </View>
                    </>
                  )}

                  {/* Custom */}
                  {form.type === "custom" && (
                    <>
                      <View>
                        <Text className={labelClass}>Goal Title</Text>
                        <TextInput className={inputClass} placeholder="e.g. Run a 5K" placeholderTextColor="#94A3B8" value={form.title} onChangeText={(v) => onFormChange({ title: v })} />
                      </View>
                      <View>
                        <Text className={labelClass}>Notes (optional)</Text>
                        <TextInput className={`${inputClass} min-h-16`} placeholder="Any details…" placeholderTextColor="#94A3B8" value={form.notes} onChangeText={(v) => onFormChange({ notes: v })} multiline />
                      </View>
                    </>
                  )}

                  <TouchableOpacity
                    onPress={onSave}
                    disabled={!canSave || saving}
                    className={`py-4 items-center rounded-2xl ${canSave ? "bg-crimson dark:bg-blue-500" : "bg-surface-2 dark:bg-zinc-800"}`}
                    activeOpacity={0.85}
                  >
                    <Text className={`font-montserrat-bold text-base ${canSave ? "text-white" : "text-text-muted dark:text-zinc-500"}`}>
                      {saving ? "Saving…" : "Add Goal"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

type GoalWithProgress = Goal & { progress: number | null };

export function GoalsSection() {
  const [goals, setGoals] = useState<GoalWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [exercisePickerOpen, setExercisePickerOpen] = useState(false);
  const [form, setForm] = useState<GoalFormState>(defaultForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const raw = await getGoals();
      const withProgress = await Promise.all(raw.map(async (g) => ({ ...g, progress: await getGoalProgress(g) })));
      setGoals(withProgress);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleToggleAchieved = async (goal: GoalWithProgress) => {
    if (goal.is_achieved) await unmarkGoalAchieved(goal.id);
    else await markGoalAchieved(goal.id);
    load();
  };

  const handleDelete = async (id: number) => { await deleteGoal(id); load(); };

  const handleSelectExercise = (ex: Exercise) => {
    setForm((f) => ({ ...f, exerciseId: ex.id, exerciseName: ex.name }));
    setExercisePickerOpen(false);
    setAddOpen(true);
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const parsedReps = form.targetReps ? parseInt(form.targetReps, 10) : null;
      const title =
        form.type === "lift_pr"
          ? parsedReps ? `${form.exerciseName} ${form.targetValue} × ${parsedReps}` : `${form.exerciseName} PR`
          : form.type === "bodyweight" ? "Bodyweight Goal"
          : isBoxingGoal(form.type) ? boxingTitle(form)
          : form.title.trim();
      const range = isBoxingGoal(form.type) ? boxingRange(form) : null;
      await createGoal({
        type: form.type, title,
        exerciseId: form.exerciseId, exerciseName: form.exerciseName,
        targetValue: form.targetValue ? parseFloat(form.targetValue) : null,
        targetReps: parsedReps, notes: form.notes || null,
        startDate: range?.start ?? null, endDate: range?.end ?? null,
        direction: form.type === "boxing_avg_rpe" ? form.direction : null,
      });
      setAddOpen(false);
      setForm(defaultForm());
      load();
    } finally { setSaving(false); }
  };

  return (
    <View className="px-5 mb-4">
      <View className="flex-row items-center justify-between mb-4">
        <Text className="font-montserrat-bold text-text-primary dark:text-white text-xl">Goals</Text>
        <TouchableOpacity
          onPress={() => setAddOpen(true)}
          className="bg-crimson dark:bg-blue-500 w-9 h-9 items-center justify-center rounded-full"
          activeOpacity={0.85}
        >
          <Plus size={16} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="small" color="#2563EB" style={{ marginTop: 16 }} />
      ) : goals.length === 0 ? (
        <EmptyState message={"No goals yet.\nTap + to set your first goal."} />
      ) : (
        goals.map((goal) => (
          <GoalCard
            key={goal.id}
            goal={goal}
            progress={goal.progress}
            onToggleAchieved={() => handleToggleAchieved(goal)}
            onDelete={() => handleDelete(goal.id)}
          />
        ))
      )}

      <AddGoalModal
        visible={addOpen}
        form={form}
        onFormChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
        onOpenExercisePicker={() => { setAddOpen(false); setExercisePickerOpen(true); }}
        onSave={handleSave}
        onClose={() => { setAddOpen(false); setForm(defaultForm()); }}
        saving={saving}
      />

      <AddExerciseSheet
        visible={exercisePickerOpen}
        onClose={() => { setExercisePickerOpen(false); setAddOpen(true); }}
        onSelect={handleSelectExercise}
      />
    </View>
  );
}
