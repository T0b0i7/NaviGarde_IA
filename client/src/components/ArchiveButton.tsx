import { useState } from "react";
import { AlertTriangle, Archive, ArchiveRestore, Loader2 } from "lucide-react";
import { useLang } from "@/i18n/LanguageContext";

type ArchiveButtonProps = {
  archived?: boolean;
  label?: string;
  disabled?: boolean;
  onConfirm: () => Promise<unknown> | unknown;
};

export function ArchiveButton({ archived = false, label, disabled, onConfirm }: ArchiveButtonProps) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async () => {
    setBusy(true);
    setError("");
    try {
      await onConfirm();
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className={`icon-sq ${archived ? "restore" : "danger"}`}
        title={archived ? t("c.restore") : t("c.archive")}
        aria-label={archived ? t("c.restore") : t("c.archive")}
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      >
        {archived ? <ArchiveRestore size={15} /> : <Archive size={15} />}
      </button>

      {open && (
        <div
          className="ng-modal-back"
          onClick={(e) => {
            e.stopPropagation();
            if (!busy) setOpen(false);
          }}
        >
          <div className="ng-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="ng-modal-ic">{archived ? <ArchiveRestore size={22} /> : <AlertTriangle size={22} />}</div>
            <h3>{archived ? t("c.restoreTitle") : t("c.archiveTitle")}</h3>
            <p>
              {label ? <strong>{label}</strong> : null} {archived ? t("c.restoreHint") : t("c.archiveHint")}
            </p>
            {error && <div className="ng-modal-error">{error}</div>}
            <div className="ng-modal-actions">
              <button type="button" className="ng-modal-ghost" onClick={() => setOpen(false)} disabled={busy}>
                {t("c.cancel")}
              </button>
              <button type="button" className={archived ? "btn-blue" : "btn-danger"} onClick={run} disabled={busy}>
                {busy ? <Loader2 size={14} className="spin" /> : archived ? <ArchiveRestore size={14} /> : <AlertTriangle size={14} />}
                {t("c.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
