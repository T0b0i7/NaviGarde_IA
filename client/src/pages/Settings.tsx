import { useEffect, useState } from "react";
import { Bell, Check, Cpu, Globe, Save, ShieldCheck, User } from "lucide-react";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import { useLang } from "@/i18n/LanguageContext";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import { EmptyState, ErrorState, Skeleton } from "@/components/DashboardStates";

export default function Settings() {
  const { t, locale } = useLang();
  const me = trpc.auth.me.useQuery(undefined, { retry: false });
  const settingsQuery = trpc.data.settings.get.useQuery(undefined, { retry: false });
  const saveSettings = trpc.data.settings.save.useMutation({ onSuccess: () => { toast.success(t("st.saved")); }, onError: (e) => toast.error(e.message) });
  const stored = Object.fromEntries((settingsQuery.data ?? []).map((item) => [item.settingKey, item.value]));
  const [critical, setCritical] = useState("80");
  const [high, setHigh] = useState("60");
  const [notifications, setNotifications] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!hydrated && settingsQuery.data) {
      setCritical(stored.risk_critical ?? "80");
      setHigh(stored.risk_high ?? "60");
      setNotifications(stored.notifications_enabled !== "false");
      setHydrated(true);
    }
  }, [settingsQuery.data]);

  const isAdmin = me.data?.appRole === "admin";

  if (me.isLoading) return <AppShell><div style={{ padding: 16, display: "grid", gap: 12 }}><Skeleton style={{ height: 28, width: 180 }} /><Skeleton style={{ height: 160, borderRadius: 12 }} /></div></AppShell>;
  if (me.isError) return <AppShell><ErrorState message={me.error.message} onRetry={() => me.refetch()} /></AppShell>;
  if (!isAdmin && me.data) {
    // observer/supervisor can view but not edit; agent/supervisor see readonly - keep page but with EmptyState hint instead of blocking
  }
  return (
    <AppShell>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div><h1 className="mock-h1">{t("st.title")}</h1><p className="mock-sub">{t("st.sub")}</p></div>
        <button className="btn-blue" style={{ padding: "0 18px" }} disabled={!isAdmin || saveSettings.isPending} onClick={() => saveSettings.mutate({ settings: { risk_critical: critical, risk_high: high, notifications_enabled: String(notifications) } })}><Save size={15} /> {saveSettings.isPending ? t("c.saving") : t("c.save")}</button>
      </div>
      <div style={{ height: 14 }} />
      {!isAdmin && <div style={{ background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 10, padding: 10, fontSize: 13, color: "#92400e", marginBottom: 12 }}>{t("st.readonly")}</div>}
      {settingsQuery.isError && <div style={{ marginBottom: 12 }}><ErrorState message={settingsQuery.error.message} onRetry={() => settingsQuery.refetch()} /></div>}
      {settingsQuery.isLoading && <div style={{ display: "grid", gap: 12 }}><Skeleton style={{ height: 120, borderRadius: 12 }} /><Skeleton style={{ height: 140, borderRadius: 12 }} /></div>}

      <div className="mock-page" style={{ gridTemplateColumns: "minmax(0,1fr) 320px" }}>
        <div className="mock-main">
          <div className="mock-card"><div className="mock-card-h"><h3><User size={15} /> {t("st.profile")}</h3><span className="bdg bdg-green"><ShieldCheck size={11} /> {me.data?.appRole ?? "-"}</span></div>
            <div className="mock-card-b" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <F label={t("st.fullName")}><input value={me.data?.name ?? ""} readOnly /></F>
              <F label={t("st.appRole")}><input value={me.data?.appRole ?? ""} readOnly /></F>
              <F label={t("c.email")}><input value={me.data?.email ?? ""} readOnly /></F>
              <F label={t("st.lastLogin")}><input value={me.data?.lastSignedIn ? new Date(me.data.lastSignedIn).toLocaleString(locale) : "-"} readOnly /></F>
            </div></div>

          <div className="mock-card"><div className="mock-card-h"><h3><Globe size={15} /> {t("top.language")} · {t("top.theme")}</h3></div>
            <div className="mock-card-b" style={{ display: "flex", gap: 18, flexWrap: "wrap", alignItems: "center" }}>
              <div><small style={{ fontSize: 11.5, color: "#7b93a8", fontWeight: 700 }}>{t("top.language")}</small><div style={{ marginTop: 6 }}><LanguageSwitcher /></div></div>
              <div><small style={{ fontSize: 11.5, color: "#7b93a8", fontWeight: 700 }}>{t("top.theme")}</small><div style={{ marginTop: 6 }}><ThemeSwitcher /></div></div>
            </div></div>

          <div className="mock-card"><div className="mock-card-h"><h3><Cpu size={15} /> {t("st.thresholds")}</h3></div>
            <div className="mock-card-b"><p style={{ margin: "0 0 12px", fontSize: 12.5, color: "#5b7a96" }}>{t("st.thresholdsSub")}</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <F label={t("st.crit")}><input type="number" min={0} max={100} value={critical} onChange={(e) => setCritical(e.target.value)} disabled={!isAdmin} /></F>
                <F label={t("st.high")}><input type="number" min={0} max={100} value={high} onChange={(e) => setHigh(e.target.value)} disabled={!isAdmin} /></F>
              </div>
              <label style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12, fontSize: 13, fontWeight: 600 }}><input type="checkbox" checked={notifications} onChange={(e) => setNotifications(e.target.checked)} disabled={!isAdmin} style={{ width: 18, height: 18, accentColor: "#0d7fdd" }} /><Bell size={15} color="#0d7fdd" /> {t("st.notifs")}</label>
            </div></div>
        </div>

        <div className="mock-side">
          <div className="mock-detail"><h3><Check size={15} /> {t("st.health")}</h3>
            <div style={{ display: "grid", gap: 8 }}>
              <span className={`bdg ${settingsQuery.isError ? "bdg-red" : "bdg-green"}`}>{t("st.db")} : {settingsQuery.isError ? t("st.dbKo") : t("st.dbOk")}</span>
              <span className="bdg bdg-blue">{t("st.storage")}</span>
              <span className="bdg bdg-green">{t("st.ai")}</span>
            </div>
            <div style={{ fontSize: 12, color: "#5b7a96" }}>{t("st.model")} : <strong>meta-models/muse-spark-open-1026</strong></div>
          </div>
        </div>
      </div>
      <style>{`label span.lb{font-size:12.5px;font-weight:700;color:#0a2a5e;margin-bottom:6px;display:block}label input,label select{width:100%;height:44px;border:1.5px solid #d9e6f2;border-radius:10px;padding:0 12px;font-size:13px;color:#0a2a5e;background:#fff;outline:none}label input:disabled{opacity:.6;background:#f4f7fb}`}</style>
    </AppShell>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <label><span className="lb">{label}</span>{children}</label>;
}
