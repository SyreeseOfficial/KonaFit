# 🎨 UI / UX DESIGN SPECIFICATION

This document outlines the design tokens, visual rules, layout guidelines, and component specifications for **KonaFit**. Claude must strictly adhere to these guidelines to maintain a premium, high-contrast tactical aesthetic.

---

## 🛠️ Design Tokens

The app uses a **light-first** theme with a **blue accent**, plus a matching **dark** theme. Light is the reference design; dark is its direct counterpart (same roles, zinc neutrals). Dark mode follows the system by default and can be forced in Settings > Theme.

Tokens live in `tailwind.config.js`. The `crimson` token name is historical: it is blue. Each token is paired with a `dark:` class at the call site.

### Colors

| Role | Tailwind token | Light | Dark (class) | Purpose |
|------|----------------|-------|--------------|---------|
| Page background | `obsidian` | #F8FAFC | #09090B (`dark:bg-zinc-950`) | Screen background |
| Card | `surface` | #FFFFFF | #18181B (`dark:bg-zinc-900`) | Cards, sheets, bars |
| Subtle fill | `surface-2` | #F1F5F9 | #27272A (`dark:bg-zinc-800`) | Chips, inputs, dividers |
| Nested / input | `surface-3` | #E2E8F0 | #3F3F46 (`dark:bg-zinc-700`) | Nested fills |
| Disabled | `surface-4` | #CBD5E1 | #52525B (`dark:bg-zinc-600`) | Disabled fills |
| Primary accent | `crimson` | #2563EB | #3B82F6 (`dark:bg-blue-500`) | Primary buttons, active chips, focus ring |
| Accent hover / text | `crimson-dim` | #1D4ED8 | #60A5FA (`dark:text-blue-400`) | Accent text, pressed |
| Text primary | `text-primary` | #0F172A | #FFFFFF (`dark:text-white`) | Main text |
| Text secondary | `text-secondary` | #64748B | #A1A1AA (`dark:text-zinc-400`) | Supporting text |
| Text muted | `text-muted` | #94A3B8 | #71717A (`dark:text-zinc-500`) | Labels, hints |
| PR badge | n/a | #F59E0B (`bg-amber-500`) | same | Personal-record chips |
| Error | n/a | #F43F5E (`rose-500`) | same | Errors, destructive actions |
| Boxing dot | `BOXING_DOT` in `src/utils/theme.ts` | #F97316 | same | Week-strip dot for a day with boxing (lifting days use the accent blue). The only color added for boxing |

Rules: every colored surface or text needs both a light and a `dark:` class. Hardcoded hex (icons, focus borders) must follow the same pair using `useColorScheme()`.

### Typography

| Style | Font | Size | Weight | Line Height | Letter Spacing |
|-------|------|------|--------|-------------|----------------|
| display-lg | Anton | 48px | 400 | 1.1 | 0.04em |
| headline-lg | Anton | 32px | 400 | 1.2 | 0.02em |
| headline-md | Anton | 24px | 400 | 1.2 | 0.02em |
| body-lg | Montserrat | 18px | 500 | 1.5 | 0 |
| body-md | Montserrat | 16px | 400 | 1.5 | 0 |
| label-caps | Montserrat | 12px | 700 | 1.2 | 0.1em |
| utility-mono | JetBrains Mono | 13px | 400 | 1.4 | -0.01em |

### Spacing

* **base:** 4px (fundamental unit)
* **unit-1:** 0.25rem (1px)
* **unit-2:** 0.5rem (2px)
* **unit-4:** 1rem (4px)
* **unit-6:** 1.5rem (6px)
* **unit-8:** 2rem (8px)
* **gutter:** 1rem (4px)
* **margin-mobile:** 1.5rem (6px)

