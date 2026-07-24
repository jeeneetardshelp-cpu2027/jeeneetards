import {
  createContext, useContext, useLayoutEffect, useMemo, useState,
} from "react";

const THEME_STORAGE_KEY = "lecture-library-theme";

const THEMES = {
  light: {
    page: "bg-neutral-50", card: "bg-white", border: "border-neutral-200",
    cardHover: "hover:border-neutral-300", text: "text-neutral-900",
    muted: "text-neutral-500", faint: "text-neutral-600",
    chip: "bg-neutral-100 text-neutral-600", hover: "hover:bg-neutral-100",
    input: "bg-neutral-100", divider: "border-neutral-200",
  },
  dark: {
    page: "bg-neutral-950", card: "bg-neutral-900", border: "border-neutral-800",
    cardHover: "hover:border-neutral-700", text: "text-neutral-100",
    muted: "text-neutral-400", faint: "text-neutral-400",
    chip: "bg-neutral-800 text-neutral-300", hover: "hover:bg-neutral-800",
    input: "bg-neutral-800", divider: "border-neutral-800",
  },
};

export const ThemeContext = createContext({
  t: THEMES.light,
  dark: false,
  toggle: () => {},
});
export const useTheme = () => useContext(ThemeContext);

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(() => {
    try {
      const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === "dark") return true;
      if (saved === "light") return false;
      return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
    } catch {
      return false;
    }
  });

  useLayoutEffect(() => {
    const mode = dark ? "dark" : "light";
    try { window.localStorage.setItem(THEME_STORAGE_KEY, mode); } catch {}
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
