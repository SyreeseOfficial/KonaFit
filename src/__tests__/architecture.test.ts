import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(n) ? [p] : [];
  });

describe("architecture", () => {
  it("keeps SQL and the database handle out of screens, components and hooks (it lives in src/db)", () => {
    const root = join(__dirname, "..", "..");
    const files = ["app", "src/components", "src/hooks"].flatMap((d) => walk(join(root, d)));
    const bad = files.filter((f) => /expo-sqlite|getDatabase|\.(getAllAsync|getFirstAsync|runAsync|execAsync)\b/.test(readFileSync(f, "utf8")));
    expect(bad).toEqual([]);
  });

  it("uses logError, not console.error, outside the logger itself", () => {
    const root = join(__dirname, "..", "..");
    const files = ["app", "src"].flatMap((d) => walk(join(root, d))).filter((f) => !f.includes("__tests__") && !f.endsWith("utils/errors.ts"));
    expect(files.filter((f) => /console\.error/.test(readFileSync(f, "utf8")))).toEqual([]);
  });
});
