import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { translate, type DictKey, type Lang } from "./translations";

const STORAGE_KEY = "navigarde-lang";

interface LangContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggleLang: () => void;
  t: (key: DictKey | string, vars?: Record<string, string | number>) => string;
  locale: string;
  fmtDate: (d: string | Date | null | undefined, opts?: Intl.DateTimeFormatOptions) => string;
}

const LanguageContext = createContext<LangContextValue | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const s = localStorage.getItem(STORAGE_KEY);
    return s === "fr" || s === "en" ? s : "en";
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => setLangState(l), []);
  const toggleLang = useCallback(() => setLangState((p) => (p === "en" ? "fr" : "en")), []);
  const t = useCallback((key: DictKey | string, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang]);
  const locale = lang === "fr" ? "fr-FR" : "en-GB";
  const fmtDate = useCallback(
    (d: string | Date | null | undefined, opts?: Intl.DateTimeFormatOptions) => {
      if (!d) return "-";
      try {
        return new Date(d).toLocaleString(locale, opts);
      } catch {
        return "-";
      }
    },
    [locale]
  );

  const value = useMemo(() => ({ lang, setLang, toggleLang, t, locale, fmtDate }), [lang, setLang, toggleLang, t, locale, fmtDate]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLang must be used within LanguageProvider");
  return ctx;
}
