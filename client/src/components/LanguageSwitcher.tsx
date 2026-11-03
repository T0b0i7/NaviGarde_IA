import { Globe } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";

export default function LanguageSwitcher({ compact }: { compact?: boolean }) {
  const { lang, setLang, t } = useLang();
  return (
    <div className="lang-switch" role="group" aria-label={t("top.language")} title={t("top.language")}>
      <span className="lang-ic"><Globe size={14} /></span>
      <div className="lang-track">
        <span className={`lang-thumb ${lang === "fr" ? "right" : "left"}`} aria-hidden="true" />
        {(["en", "fr"] as const).map((l) => (
          <button key={l} className={`lang-opt ${lang === l ? "on" : ""}`} onClick={() => setLang(l)} aria-pressed={lang === l}>
            {compact ? l.toUpperCase() : l === "en" ? "EN" : "FR"}
          </button>
        ))}
      </div>
    </div>
  );
}
