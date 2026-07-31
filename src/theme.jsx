// theme.jsx — the theme context.
//
// WHAT CHANGED AND WHY
// The palette used to be two JS objects of literal `neutral-*` Tailwind
// classes, with the dark values for a dozen legacy `slate-*` utilities
// hardcoded as rgb() in index.css. Colour therefore lived in two places and
// any new literal class silently broke dark mode.
//
// Now every colour resolves from CSS custom properties that swap on
// html[data-theme], and these class strings point at token-backed
// utilities (see the @theme block in index.css). The keys are unchanged, so
// all 32 existing consumers keep working untouched; the values are simply
// theme-independent because the token underneath does the switching.
//
// Still true: no Tailwind `dark:` variant anywhere. Brand accent is now a
// token (`bg-accent`, `text-accent`) rather than an inline hex, so a CTA
// can be correct in both themes without a `dark ? … : …` ternary.
//
// Dark is the default and the signature theme. A visitor who has never
// chosen gets dark, regardless of OS preference; light is a first-class
// theme they can switch to and it is remembered.

import {
  createContext, useContext, useLayoutEffect, useMemo, useState,
} from "react";

const THEME_STORAGE_KEY = "lecture-library-theme";

// One shared shape. Kept as two named entries because `t` is part of the
// component API and a future token may legitimately need to differ per
// theme; today they are identical because the CSS variables switch.
const TOKENS = {
  // --- the original eleven keys, unchanged names ---
  page: "bg-canvas",
  card: "bg-surface",
  border: "border-hairline",
  cardHover: "hover:border-hairline-strong",
  text: "text-ink",
  muted: "text-ink-2",
  faint: "text-ink-3",
  chip: "bg-surface-2 text-ink-2",
  hover: "hover:bg-surface-2",
  input: "bg-surface-2",
  divider: "border-hairline",

  // --- added by the redesign ---
  raised: "bg-surface-2",        // a surface one step above `card`
  inset: "bg-surface-inset",     // recessed wells: search fields, code, rails
  canvas2: "bg-canvas-2",        // banded sections that alternate with `page`
  accent: "text-accent",
  accentBg: "bg-accent",
  accentInk: "text-accent-ink",
  accentSoft: "bg-accent-soft",
  accentBorder: "border-accent-line",
  hairlineStrong: "border-hairline-strong",
  e1: "shadow-e1",
  e2: "shadow-e2",
  e3: "shadow-e3",
};

const THEMES = { light: TOKENS, dark: TOKENS };

export const ThemeContext = createContext({
  t: THEMES.dark,
  dark: true,
  toggle: () => {},
});
export const useTheme = () => useContext(ThemeContext);

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(() => {
    try {
      const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === "dark") return true;
      if (saved === "light") return false;
    } catch {
      // Storage can be blocked; fall through to the product default.
    }
    // Deliberate product default, not an OS mirror: dark is the signature
    // theme. public/theme-init.js applies the same rule pre-React so the
    // first painted frame already matches.
    return true;
  });

  useLayoutEffect(() => {
    const mode = dark ? "dark" : "light";
    try { window.localStorage.setItem(THEME_STORAGE_KEY, mode); } catch {
      // The active theme still applies when persistence is blocked.
    }
    document.documentElement.dataset.theme = mode;
    document.documentElement.style.colorScheme = mode;
  }, [dark]);

  const value = useMemo(() => ({
    t: dark ? THEMES.dark : THEMES.light,
    dark,
    toggle: () => setDark((current) => !current),
  }), [dark]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
