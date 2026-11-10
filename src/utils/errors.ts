import { kvStore } from "./kvStore";

/** Last 50 errors, newest last, kept in kv_store so Settings → Diagnostics can show them. No workout data is stored, only messages. */
export const ERROR_LOG_KEY = "@konafit_error_log";
export const MAX_LOGGED_ERRORS = 50;

export type LoggedError = { at: string; context: string; message: string; stack?: string };

export function toLoggedError(e: unknown, context = "", now = new Date()): LoggedError {
  const err = e instanceof Error ? e : null;
  return {
    at: now.toISOString(),
    context,
    message: (err?.message ?? String(e)).slice(0, 500),
    stack: err?.stack?.split("\n").slice(0, 6).join("\n"),
  };
}

export function parseErrorLog(raw: string | null): LoggedError[] {
  try {
    const list = JSON.parse(raw ?? "[]");
    return Array.isArray(list) ? list.filter((x) => x && typeof x.message === "string") : [];
  } catch {
    return [];
  }
}

let queue: Promise<unknown> = Promise.resolve(); // serialise read-modify-write so parallel errors don't overwrite each other

/**
 * The one place to report a caught error: console + saved log. Never throws (the database may be the thing that broke).
 * Works as `.catch(logError)` or `logError(e, "saving set")`.
 */
export function logError(e: unknown, context = ""): void {
  console.error(context ? `${context}:` : "Error:", e);
  const entry = toLoggedError(e, context);
  queue = queue
    .then(async () => {
      const list = parseErrorLog(await kvStore.getItem(ERROR_LOG_KEY));
      await kvStore.setItem(ERROR_LOG_KEY, JSON.stringify([...list, entry].slice(-MAX_LOGGED_ERRORS)));
    })
    .catch(() => {});
}

export const loadErrorLog = async () => parseErrorLog(await kvStore.getItem(ERROR_LOG_KEY)).reverse();
export const clearErrorLog = () => kvStore.removeItem(ERROR_LOG_KEY);
export const formatErrorLog = (list: LoggedError[]) =>
  list.map((x) => `${x.at} ${x.context ? `[${x.context}] ` : ""}${x.message}${x.stack ? `\n${x.stack}` : ""}`).join("\n\n");
