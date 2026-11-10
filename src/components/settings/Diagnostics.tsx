import { useCallback, useState } from "react";
import { View, Text, Modal, ScrollView, Share } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "../Button";
import { diagnoseDb, repairDb, problemTotal, type DoctorReport } from "../../db/doctor";
import { photoFileExists, removeOrphanPhotos } from "../../utils/photoFiles";
import { loadCachedSession } from "../../utils/sessionCache";
import { clearErrorLog, formatErrorLog, loadErrorLog, logError, type LoggedError } from "../../utils/errors";
import { confirm } from "../../utils/confirm";

const card = "bg-surface dark:bg-zinc-900 mx-5 rounded-2xl px-5 py-5";
const body = "font-montserrat text-text-secondary dark:text-zinc-400 text-sm";

/** Settings → Diagnostics: database check with one-tap repair, and the saved error log. */
export function Diagnostics() {
  const [report, setReport] = useState<DoctorReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<LoggedError[] | null>(null); // null = log closed

  const keepId = async () => (await loadCachedSession())?.workoutId ?? null; // the unfinished workout a saved session can still resume

  const check = useCallback(async () => {
    setBusy(true);
    try {
      setReport(await diagnoseDb(await keepId(), photoFileExists));
    } catch (e) {
      logError(e, "database check");
    } finally {
      setBusy(false);
    }
  }, []);

  const repair = useCallback(async () => {
    if (!report) return;
    const ok = await confirm({
      title: "Repair database?",
      message: "Removes the broken rows listed. Finished workouts and your sets are not touched.",
      confirmText: "Repair",
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const id = await keepId();
      await repairDb(id, report);
      await removeOrphanPhotos().catch(logError);
      setReport(await diagnoseDb(id, photoFileExists));
    } catch (e) {
      logError(e, "database repair");
    } finally {
      setBusy(false);
    }
  }, [report]);

  return (
    <>
      <View className={card} style={{ gap: 12 }}>
        <Text className="font-montserrat-semibold text-text-primary dark:text-white text-base">Database check</Text>
        {report && (
          <View style={{ gap: 4 }}>
            <Text className={body}>{Object.entries(report.counts).map(([k, n]) => `${k}: ${n}`).join(" · ")}</Text>
            {problemTotal(report) === 0 ? (
              <Text className="font-montserrat-semibold text-emerald-600 dark:text-emerald-400 text-sm">No problems found.</Text>
            ) : (
              Object.entries(report.problems).map(([k, n]) => (
                <Text key={k} className="font-montserrat-semibold text-rose-500 text-sm">{k}: {n}</Text>
              ))
            )}
          </View>
        )}
        <View className="flex-row" style={{ gap: 12 }}>
          <Button label={busy ? "Working…" : report ? "Check again" : "Check"} variant="secondary" onPress={check} disabled={busy} className="flex-1" />
          {report && problemTotal(report) > 0 && <Button label="Repair" onPress={repair} disabled={busy} className="flex-1" />}
        </View>
      </View>

      <View className={`${card} mt-4`} style={{ gap: 12 }}>
        <Text className="font-montserrat-semibold text-text-primary dark:text-white text-base">Error log</Text>
        <Text className={body}>The last 50 errors, kept only on this device. Nothing is sent anywhere.</Text>
        <Button label="View errors" variant="secondary" onPress={async () => setErrors(await loadErrorLog())} />
      </View>

      <Modal visible={errors !== null} animationType="slide" onRequestClose={() => setErrors(null)}>
        <SafeAreaView className="flex-1 bg-obsidian dark:bg-zinc-950">
          <Text className="font-montserrat-bold text-text-primary dark:text-white text-2xl px-5 pt-5 pb-3">Error log</Text>
          <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, gap: 12 }}>
            {errors?.length === 0 && <Text className={body}>No errors recorded.</Text>}
            {errors?.map((x, i) => (
              <View key={i} className="bg-surface dark:bg-zinc-900 rounded-xl p-4">
                <Text className="font-mono text-text-muted dark:text-zinc-500 text-xs">{x.at}{x.context ? ` · ${x.context}` : ""}</Text>
                <Text selectable className="font-montserrat text-text-primary dark:text-white text-sm mt-1">{x.message}</Text>
              </View>
            ))}
          </ScrollView>
          <View className="flex-row px-5 pb-5" style={{ gap: 12 }}>
            <Button label="Copy / share" onPress={() => Share.share({ message: formatErrorLog(errors ?? []) })} disabled={!errors?.length} className="flex-1" />
            <Button label="Clear" variant="secondary" onPress={async () => { await clearErrorLog(); setErrors([]); }} disabled={!errors?.length} className="flex-1" />
            <Button label="Close" variant="ghost" onPress={() => setErrors(null)} />
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}
