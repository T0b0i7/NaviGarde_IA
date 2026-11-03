import { Laptop, Moon, Sun } from "lucide-react";
import { useTheme, type ThemeMode } from "@/contexts/ThemeContext";
import { useLang } from "@/i18n/LanguageContext";

const ORDER: ThemeMode[] = ["light", "dark", "auto"];

export default function ThemeSwitcher() {
  const { mode, setMode } = useTheme();
  const { t } = useLang();
  const idx = ORDER.indexOf(mode);
  return (
    <div className="theme-switch" role="group" aria-label={t("top.theme")} title={t("top.theme")}>
      <div className="theme-track">
        <span className="theme-thumb" style={{ transform: `translateX(${idx * 100}%)` }} aria-hidden="true" />
        <button className={`theme-opt ${mode === "light" ? "on" : ""}`} onClick={() => setMode("light")} title={t("top.themeLight")} aria-pressed={mode === "light"}><Sun size={14} /></button>
        <button className={`theme-opt ${mode === "dark" ? "on" : ""}`} onClick={() => setMode("dark")} title={t("top.themeDark")} aria-pressed={mode === "dark"}><Moon size={14} /></button>
        <button className={`theme-opt ${mode === "auto" ? "on" : ""}`} onClick={() => setMode("auto")} title={t("top.themeAuto")} aria-pressed={mode === "auto"}><Laptop size={14} /></button>
      </div>
    </div>
  );
}
