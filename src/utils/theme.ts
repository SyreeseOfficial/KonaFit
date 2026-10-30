import { Appearance } from "react-native";
import { kvStore } from "./kvStore";

export type ThemePref = "system" | "light" | "dark";
export const THEME_KEY = "@konafit_theme";

// Overrides the OS color scheme; NativeWind's `dark:` classes follow Appearance on native.
function applyTheme(pref: ThemePref) {
  Appearance.setColorScheme(pref === "system" ? "unspecified" : pref);
}

export async function loadTheme(): Promise<ThemePref> {
  const v = await kvStore.getItem(THEME_KEY);
  const pref: ThemePref = v === "light" || v === "dark" ? v : "system";
  applyTheme(pref);
  return pref;
}

export async function setTheme(pref: ThemePref): Promise<void> {
  applyTheme(pref);
  await kvStore.setItem(THEME_KEY, pref);
}

/** Calendar/week dot for a day with boxing (lifting days use the accent blue). The one color added for boxing. */
export const BOXING_DOT = "#F97316";
