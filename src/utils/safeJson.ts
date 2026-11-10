/** JSON.parse that never throws and returns `fallback` unless `ok` accepts the result. */
export function parseJson<T>(raw: string | null | undefined, ok: (x: unknown) => x is T, fallback: T): T {
  try {
    const x = JSON.parse(raw ?? "null");
    return ok(x) ? x : fallback;
  } catch {
    return fallback;
  }
}

export const isStringArray = (x: unknown): x is string[] => Array.isArray(x) && x.every((v) => typeof v === "string");
export const isNumberArray = (x: unknown): x is number[] => Array.isArray(x) && x.every((v) => typeof v === "number");
export const isBoolRecord = (x: unknown): x is Record<string, boolean> =>
  typeof x === "object" && x !== null && !Array.isArray(x) && Object.values(x).every((v) => typeof v === "boolean");
