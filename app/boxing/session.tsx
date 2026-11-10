import { useCallback, useEffect, useState } from "react";
import { View, Alert, ScrollView, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useBoxingSession } from "../../src/hooks/useBoxingSession";
import { setupFromParams } from "../../src/utils/boxingRoute";
import { currentPhase, remainingSec, sessionProgress, roundResults } from "../../src/utils/boxingTimer";
import { RoundLogCard } from "../../src/components/boxing/RoundLogCard";
import { getFocusChips, saveBoxingSession } from "../../src/db/boxingQueries";
import type { FocusChip } from "../../src/types/boxing";
import type { RoundLogEntry } from "../../src/utils/boxingSnapshot";
import { FinishSheet } from "../../src/components/boxing/FinishSheet";
import { toBoxingSession, type FinishInput } from "../../src/utils/boxingSave";
import { boxingName } from "../../src/utils/boxingNames";
import { APP_VERSION } from "../../src/utils/appVersion";
import { TimerControls } from "../../src/components/boxing/TimerControls";
import { TimerFace, PHASE_BG } from "../../src/components/boxing/TimerFace";
import { logError } from "../../src/utils/errors";
import { confirm } from "../../src/utils/confirm";

/** Optional logging card shown during rest. Keyed by phase, so each rest starts closed on the round just finished. */
function RestLog({ finishedRound, log, chips, onChange }: {
  finishedRound: number; log: RoundLogEntry[]; chips: FocusChip[]; onChange: (index: number, patch: Partial<RoundLogEntry>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const round = picked ?? finishedRound;
  const { height } = useWindowDimensions();
  return (
    <ScrollView style={{ maxHeight: height * 0.55, flexGrow: 0 }} keyboardShouldPersistTaps="handled">
      <RoundLogCard
        rounds={Array.from({ length: finishedRound }, (_, i) => i + 1)}
        round={round}
        onSelectRound={setPicked}
        entry={log[round - 1]}
        onChange={(patch) => onChange(round - 1, patch)}
        chips={chips}
        open={open}
        onToggleOpen={() => setOpen((o) => !o)}
        onManageChips={() => router.push("/boxing/chips" as never)}
      />
    </ScrollView>
  );
}

export default function BoxingSessionScreen() {
  const params = useLocalSearchParams();
  const b = useBoxingSession(setupFromParams(params));

  useEffect(() => { if (b.status === "none") router.back(); }, [b.status]);

  const [saving, setSaving] = useState(false);
  const [chips, setChips] = useState<FocusChip[]>([]);
  useFocusEffect(useCallback(() => { getFocusChips().then(setChips).catch(logError); }, [])); // reload after Manage chips

  // Screen stays on while a session is live.
  const live = !!b.timer && !b.timer.done;
  useEffect(() => {
    if (!live) return;
    activateKeepAwakeAsync("boxing").catch(() => {});
    return () => { deactivateKeepAwake("boxing"); };
  }, [live]);
  if (!b.timer) return <SafeAreaView className="flex-1 bg-obsidian dark:bg-zinc-950" />;

  const t = b.timer;
  const p = currentPhase(t);

  const leave = async () => { await b.clear(); router.back(); };
  const save = async (input: FinishInput) => {
    setSaving(true);
    try {
      const id = await saveBoxingSession(toBoxingSession(t, b.roundLog, input, Date.now()), APP_VERSION);
      await b.clear();
      router.replace({ pathname: "/boxing/complete", params: { id: String(id) } } as never);
    } catch (e) {
      logError(e, "save boxing session");
      setSaving(false);
      Alert.alert("Couldn't save session", "Nothing was lost. Tap Save to try again.");
    }
  };
  const discard = async () => {
    if (await confirm({ title: "Discard session?", message: "This session won't be saved.", confirmText: "Discard", destructive: true })) leave();
  };
  const confirmEnd = async () => {
    if (await confirm({ title: "End session?", message: "Rounds finished so far are kept.", confirmText: "End", cancelText: "Keep Going", destructive: true })) b.endEarly();
  };

  if (t.done) {
    return (
      <SafeAreaView className="flex-1 bg-obsidian dark:bg-zinc-950">
        <FinishSheet
          defaultName={boxingName(t.startedAt)}
          roundCount={roundResults(t).length}
          saving={saving}
          initialTags={b.tagsDraft}
          log={b.roundLog}
          chips={chips}
          onLogChange={b.setRoundLog}
          onManageChips={() => router.push("/boxing/chips" as never)}
          onSave={save}
          onDiscard={discard}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className={`flex-1 ${PHASE_BG[p.kind]}`}>
      <View className="flex-1">
        <TimerFace
          kind={p.kind}
          round={p.round}
          rounds={t.setup.rounds}
          remainingSec={remainingSec(t, b.now)}
          progress={sessionProgress(t, b.now)}
          paused={!!t.paused}
        />
      </View>
      {p.kind === "rest" && (
        <RestLog key={t.phaseIndex} finishedRound={p.round} log={b.roundLog} chips={chips} onChange={b.setRoundLog} />
      )}
      <TimerControls
        kind={p.kind}
        paused={!!t.paused}
        onPauseToggle={t.paused ? b.resume : b.pause}
        onSkipRest={b.skipRest}
        onAddThirty={b.addThirty}
        onEnd={confirmEnd}
      />
    </SafeAreaView>
  );
}
