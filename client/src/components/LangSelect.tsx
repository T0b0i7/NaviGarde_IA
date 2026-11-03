import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Globe } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";
import type { Lang } from "@/i18n/translations";

const OPTIONS: { code: Lang; label: string }[] = [
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
];

/** Minimal professional language select. */
export default function LangSelect() {
  const { lang, setLang, t } = useLang();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open ]);

  return (
    <div className="lang-select" ref={ref}>
      <button className={`lang-select-btn${open ? " open" : ""}`} onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open} title={t("top.language")}>
        <Globe size={15} />
        <span>{lang.toUpperCase()}</span>
        <ChevronDown size={14} className={`lang-chev${open ? " up" : ""}`} />
      </button>
      {open && (
        <ul className="lang-menu" role="listbox">
          {OPTIONS.map((o) => (
            <li key={o.code}>
              <button role="option" aria-selected={lang === o.code} className={`lang-item${lang === o.code ? " on" : ""}`} onClick={() => { setLang(o.code); setOpen(false); }}>
                <span className="lang-code">{o.code.toUpperCase()}</span>
                <span>{o.label}</span>
                {lang === o.code && <Check size={14} className="lang-check" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
