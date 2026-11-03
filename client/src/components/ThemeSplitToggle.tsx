import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useLang } from "@/i18n/LanguageContext";

/** Single split icon: sun half = light, moon half = dark. Auto stays available in Settings. */
export default function ThemeSplitToggle() {
  const { theme, setMode } = useTheme();
  const { t } = useLang();
  const isLight = theme === "light";
  return (
    <div className="split-theme" role="group" aria-label={t("top.theme")}>
      <button
        className={`split-half sun${isLight ? " on" : ""}`}
        onClick={() => setMode("light")}
        title={t("top.themeLight")}
        aria-label={t("top.themeLight")}
        aria-pressed={isLight}
      >
        <Sun size={15} />
      </button>
      <button
        className={`split-half moon${!isLight ? " on" : ""}`}
        onClick={() => setMode("dark")}
        title={t("top.themeDark")}
        aria-label={t("top.themeDark")}
        aria-pressed={!isLight}
      >
        <Moon size={15} />
      </button>
    </div>
  );
}
