import { useLang } from "@/i18n/LanguageContext";

export type ArchiveScope = "active" | "archived";

type ScopeSwitchProps = {
  value: ArchiveScope;
  onChange: (value: ArchiveScope) => void;
  activeCount?: number;
  archivedCount?: number;
};

export function ScopeSwitch({ value, onChange, activeCount, archivedCount }: ScopeSwitchProps) {
  const { t } = useLang();
  return (
    <div className="scope-switch" role="tablist" aria-label={t("c.archives")}>
      <button type="button" role="tab" aria-selected={value === "active"} className={value === "active" ? "on" : ""} onClick={() => onChange("active")}>
        {t("c.activeOnly")}
        {typeof activeCount === "number" ? <span>{activeCount}</span> : null}
      </button>
      <button type="button" role="tab" aria-selected={value === "archived"} className={value === "archived" ? "on" : ""} onClick={() => onChange("archived")}>
        {t("c.archives")}
        {typeof archivedCount === "number" ? <span>{archivedCount}</span> : null}
      </button>
    </div>
  );
}
