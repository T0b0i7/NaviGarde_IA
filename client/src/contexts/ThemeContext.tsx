import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

export type ThemeMode = "light" | "dark" | "auto";
type Resolved = "light" | "dark";

interface ThemeContextType {
  mode: ThemeMode;
  theme: Resolved;
  setMode: (m: ThemeMode) => void;
  toggleTheme?: () => void;
  switchable: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: ThemeMode;
  switchable?: boolean;
}

function systemTheme(): Resolved {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children, defaultTheme = "light", switchable = false }: ThemeProviderProps) {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem("navigarde_theme");
    if (stored === "light" || stored === "dark" || stored === "auto") return stored;
    return defaultTheme;
  });
  const [system, setSystem] = useState<Resolved>(() => systemTheme());
  const theme: Resolved = mode === "auto" ? system : mode;

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    const onChange = (e: MediaQueryListEvent) => setSystem(e.matches ? "dark" : "light");
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.dataset.theme = mode;
    root.style.colorScheme = theme;
    root.classList.add("theming");
    const t = window.setTimeout(() => root.classList.remove("theming"), 400);
    if (switchable) localStorage.setItem("navigarde_theme", mode);
    return () => window.clearTimeout(t);
  }, [theme, mode, switchable]);

  const setMode = (m: ThemeMode) => switchable && setModeState(m);
  const toggleTheme = switchable ? () => setModeState((p) => (p === "dark" ? "light" : "dark")) : undefined;

  const value = useMemo(() => ({ mode, theme, setMode, toggleTheme, switchable }), [mode, theme, switchable]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
