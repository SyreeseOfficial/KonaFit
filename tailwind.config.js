/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        obsidian:        "#F8FAFC", // page bg (dark: zinc-950)
        surface:         "#FFFFFF", // card bg (dark: zinc-900)
        "surface-2":     "#F1F5F9", // subtle bg (dark: zinc-800)
        "surface-3":     "#E2E8F0", // inputs / nested (dark: zinc-700)
        "surface-4":     "#CBD5E1", // disabled (dark: zinc-600)
        crimson:         "#2563EB", // primary accent blue (dark: blue-500)
        "crimson-dim":   "#1D4ED8", // hover blue (dark: blue-400)
        "text-primary":  "#0F172A", // main text (dark: white)
        "text-secondary":"#64748B", // secondary text (dark: zinc-400)
        "text-muted":    "#94A3B8", // muted text (dark: zinc-500)
      },
      fontFamily: {
        montserrat:           ["Montserrat_400Regular"],
        "montserrat-medium":  ["Montserrat_500Medium"],
        "montserrat-semibold":["Montserrat_600SemiBold"],
        "montserrat-bold":    ["Montserrat_700Bold"],
        mono:                 ["JetBrainsMono_400Regular"],
        "mono-medium":        ["JetBrainsMono_500Medium"],
      },
    },
  },
  plugins: [],
};
