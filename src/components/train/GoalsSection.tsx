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
import {
  getGoals,
  createGoal,
  deleteGoal,
  markGoalAchieved,
  unmarkGoalAchieved,
  getGoalProgress,
  type Goal,
  type GoalType,
} from "../../db/goalQueries";
import { AddExerciseSheet } from "../workout/AddExerciseSheet";
import type { Exercise } from "../../types/workout";

// ─── Progress Bar ──────────────────────────────────────────────────────────────

function ProgressBar({ current, target }: { current: number; target: number }) {
  const pct = target > 0 ? Math.min(1, current / target) : 0;
  return (
    <View style={{ height: 3, backgroundColor: "#2A2A2A", marginTop: 8, overflow: "hidden" }}>
      <View style={{ width: `${pct * 100}%`, height: "100%", backgroundColor: "#CC2200" }} />
    </View>
  );
}

// ─── Goal Card ─────────────────────────────────────────────────────────────────

function GoalCard({
  goal,
  progress,
  onToggleAchieved,
  onDelete,
}: {
  goal: Goal & { progress: number | null };
  progress: number | null;
  onToggleAchieved: () => void;
  onDelete: () => void;
}) {
  const isAchieved = goal.is_achieved === 1;
  const borderColor =
    goal.type === "lift_pr" ? "#CC2200" :
    goal.type === "bodyweight" ? "#1565C0" : "#3A3A3A";

  const hasRepTarget = goal.type === "lift_pr" && goal.target_reps != null;
  const progressLabel =
    hasRepTarget ? "Best reps" :
    goal.type === "lift_pr" ? "Best 1RM" :
    goal.type === "bodyweight" ? "Current" : null;
  const progressUnit = hasRepTarget ? "reps" : "lbs";
  const progressTarget = hasRepTarget ? (goal.target_reps ?? 0) : (goal.target_value ?? 0);

  return (
    <View
      style={{ borderLeftWidth: 3, borderLeftColor: borderColor }}
      className={`bg-surface mb-2 ${isAchieved ? "opacity-50" : ""}`}
    >
      <View className="px-4 py-4 flex-row items-start">
        <View className="flex-1 mr-3">
          <Text className={`font-montserrat-bold text-sm ${isAchieved ? "text-text-muted line-through" : "text-white"}`}>
            {goal.title}
          </Text>
          {goal.exercise_name && goal.type === "lift_pr" && (
            <Text className="font-mono text-text-muted text-xs mt-0.5">{goal.exercise_name}</Text>
          )}
          {goal.target_value !== null && (
            <View className="flex-row items-baseline mt-1" style={{ gap: 6 }}>
              {progress !== null && progressLabel && (
                <Text className="font-mono text-text-secondary text-xs">
                  {progressLabel}: {hasRepTarget ? Math.round(progress) : progress.toFixed(1)} {progressUnit} →
                </Text>
              )}
              <Text className="font-mono text-text-muted text-xs">
                Target: {goal.target_value} lbs{goal.target_reps != null ? ` × ${goal.target_reps} reps` : ""}
              </Text>
            </View>
          )}
          {goal.notes ? (
            <Text className="font-montserrat text-text-muted text-xs mt-1" numberOfLines={2}>
              {goal.notes}
            </Text>
          ) : null}
          {progressTarget > 0 && progress !== null && !isAchieved && (
            <ProgressBar current={progress} target={progressTarget} />
          )}
        </View>
        <View className="flex-row items-center" style={{ gap: 12 }}>
          <TouchableOpacity
            onPress={onToggleAchieved}
            hitSlop={8}
            style={{
              width: 28, height: 28,
              alignItems: "center", justifyContent: "center",
              borderWidth: 1,
              borderColor: isAchieved ? "#CC2200" : "#3A3A3A",
              backgroundColor: isAchieved ? "#CC2200" : "transparent",
            }}
            activeOpacity={0.7}
          >
            <Check size={14} color={isAchieved ? "#FFFFFF" : "#606060"} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onDelete} hitSlop={8} activeOpacity={0.7}>
            <X size={14} color="#606060" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Add Goal Modal ───────────────────────────────────────────────────────────

type GoalFormState = {
  type: GoalType;
  exerciseId: number | null;
  exerciseName: string | null;
  targetValue: string;
  targetReps: string;
  title: string;
  notes: string;
};

const DEFAULT_FORM: GoalFormState = {
  type: "lift_pr",
  exerciseId: null,
  exerciseName: null,
  targetValue: "",
  targetReps: "",
  title: "",
  notes: "",
};

const GOAL_TYPES: { key: GoalType; label: string }[] = [
  { key: "lift_pr",    label: "Lift PR" },
  { key: "bodyweight", label: "Body Weight" },
  { key: "custom",     label: "Custom" },
];

function AddGoalModal({
  visible,
  form,
  onFormChange,
  onOpenExercisePicker,
  onSave,
  onClose,
  saving,
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
    form.type === "lift_pr"
      ? form.exerciseId !== null && form.targetValue.trim() !== ""
      : form.type === "bodyweight"
      ? form.targetValue.trim() !== ""
      : form.title.trim() !== "";

  const labelClass = "font-mono text-text-muted text-xs tracking-widest uppercase mb-1.5";
  const inputClass = "bg-surface-3 px-3 py-3 font-montserrat text-white text-sm";

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
      <Pressable className="flex-1 bg-black/70 justify-end" onPress={onClose}>
        <Pressable>
          <View className="bg-surface-2 pb-10">
            <View className="flex-row items-center justify-between px-4 py-4 border-b border-surface-3">
              <Text className="font-anton text-white text-base tracking-widest uppercase">Add Goal</Text>
              <TouchableOpacity onPress={onClose} hitSlop={8}>
                <X size={18} color="#606060" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 520 }} keyboardShouldPersistTaps="handled">
              <View className="px-4 py-4" style={{ gap: 20 }}>
                {/* Type selector */}
                <View>
                  <Text className={labelClass}>Goal Type</Text>
                  <View className="flex-row" style={{ gap: 8 }}>
                    {GOAL_TYPES.map((t) => (
                      <TouchableOpacity
                        key={t.key}
                        onPress={() =>
                          onFormChange({
                            type: t.key,
                            exerciseId: null,
                            exerciseName: null,
                            targetValue: "",
                            targetReps: "",
                            title: "",
                            notes: "",
                          })
                        }
                        style={{ flex: 1 }}
                        className={`py-2.5 items-center ${
                          form.type === t.key ? "bg-crimson" : "bg-surface-3"
                        }`}
                        activeOpacity={0.7}
                      >
                        <Text
                          className={`font-mono text-xs ${
                            form.type === t.key ? "text-white" : "text-text-secondary"
                          }`}
                        >
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
                        className="bg-surface-3 px-3 py-3 flex-row items-center justify-between"
                        activeOpacity={0.7}
                      >
                        <Text
                          className={`font-montserrat text-sm ${
                            form.exerciseName ? "text-white" : "text-text-muted"
                          }`}
                        >
                          {form.exerciseName ?? "Select exercise…"}
                        </Text>
                        <ChevronRight size={16} color="#606060" />
                      </TouchableOpacity>
                    </View>
                    <View className="flex-row gap-3">
                      <View className="flex-1">
                        <Text className={labelClass}>Target Weight (lbs)</Text>
                        <TextInput
                          className={inputClass}
                          placeholder="e.g. 315"
                          placeholderTextColor="#606060"
                          value={form.targetValue}
                          onChangeText={(v) => onFormChange({ targetValue: v })}
                          keyboardType="decimal-pad"
                        />
                      </View>
                      <View style={{ width: 110 }}>
                        <Text className={labelClass}>Target Reps</Text>
                        <TextInput
                          className={inputClass}
                          placeholder="e.g. 10"
                          placeholderTextColor="#606060"
                          value={form.targetReps}
                          onChangeText={(v) => onFormChange({ targetReps: v })}
                          keyboardType="number-pad"
                        />
                      </View>
                    </View>
                  </>
                )}

                {/* Bodyweight */}
                {form.type === "bodyweight" && (
                  <View>
                    <Text className={labelClass}>Target Weight (lbs)</Text>
                    <TextInput
                      className={inputClass}
                      placeholder="e.g. 180"
                      placeholderTextColor="#606060"
                      value={form.targetValue}
                      onChangeText={(v) => onFormChange({ targetValue: v })}
                      keyboardType="decimal-pad"
                    />
                  </View>
                )}

                {/* Custom */}
                {form.type === "custom" && (
                  <>
                    <View>
                      <Text className={labelClass}>Goal Title</Text>
                      <TextInput
                        className={inputClass}
                        placeholder="e.g. Run a 5K"
                        placeholderTextColor="#606060"
                        value={form.title}
                        onChangeText={(v) => onFormChange({ title: v })}
                      />
                    </View>
                    <View>
                      <Text className={labelClass}>Notes (optional)</Text>
                      <TextInput
                        className={`${inputClass} min-h-16`}
                        placeholder="Any details…"
                        placeholderTextColor="#606060"
                        value={form.notes}
                        onChangeText={(v) => onFormChange({ notes: v })}
                        multiline
                      />
                    </View>
                  </>
                )}

                <TouchableOpacity
                  onPress={onSave}
                  disabled={!canSave || saving}
                  className={`py-3 items-center ${canSave ? "bg-crimson" : "bg-surface-3"}`}
                  activeOpacity={0.8}
                >
                  <Text
                    className={`font-montserrat-bold text-xs tracking-widest uppercase ${
                      canSave ? "text-white" : "text-text-muted"
                    }`}
                  >
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

// ─── Main Section ─────────────────────────────────────────────────────────────

type GoalWithProgress = Goal & { progress: number | null };

export function GoalsSection() {
  const [goals, setGoals] = useState<GoalWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [exercisePickerOpen, setExercisePickerOpen] = useState(false);
  const [form, setForm] = useState<GoalFormState>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const raw = await getGoals();
      const withProgress = await Promise.all(
        raw.map(async (g) => ({ ...g, progress: await getGoalProgress(g) }))
      );
      setGoals(withProgress);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleToggleAchieved = async (goal: GoalWithProgress) => {
    if (goal.is_achieved) {
      await unmarkGoalAchieved(goal.id);
    } else {
      await markGoalAchieved(goal.id);
    }
    load();
  };

  const handleDelete = async (id: number) => {
    await deleteGoal(id);
    load();
  };

  const handleOpenExercisePicker = () => {
    setAddOpen(false);
    setExercisePickerOpen(true);
  };

  const handleSelectExercise = (ex: Exercise) => {
    setForm((f) => ({ ...f, exerciseId: ex.id, exerciseName: ex.name }));
    setExercisePickerOpen(false);
    setAddOpen(true);
  };

  const handleCloseExercisePicker = () => {
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
          ? parsedReps
            ? `${form.exerciseName} ${form.targetValue} × ${parsedReps}`
            : `${form.exerciseName} PR`
          : form.type === "bodyweight"
          ? "Bodyweight Goal"
          : form.title.trim();
      await createGoal({
        type: form.type,
        title,
        exerciseId: form.exerciseId,
        exerciseName: form.exerciseName,
        targetValue: form.targetValue ? parseFloat(form.targetValue) : null,
        targetReps: parsedReps,
        notes: form.notes || null,
      });
      setAddOpen(false);
      setForm(DEFAULT_FORM);
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleCloseModal = () => {
    setAddOpen(false);
    setForm(DEFAULT_FORM);
  };

  return (
    <View className="px-4 mb-4">
      {/* Section header */}
      <View className="flex-row items-center justify-between mb-4">
        <Text className="font-anton text-white text-xl tracking-widest uppercase">Goals</Text>
        <TouchableOpacity
          onPress={() => setAddOpen(true)}
          className="bg-crimson w-8 h-8 items-center justify-center"
          activeOpacity={0.8}
        >
          <Plus size={16} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="small" color="#CC2200" style={{ marginTop: 16 }} />
      ) : goals.length === 0 ? (
        <View className="py-6 items-center">
          <Text className="font-montserrat text-text-muted text-sm text-center">
            No goals yet.{"\n"}Tap + to set your first goal.
          </Text>
        </View>
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
        onOpenExercisePicker={handleOpenExercisePicker}
        onSave={handleSave}
        onClose={handleCloseModal}
        saving={saving}
      />

      <AddExerciseSheet
        visible={exercisePickerOpen}
        onClose={handleCloseExercisePicker}
        onSelect={handleSelectExercise}
      />
    </View>
  );
}
