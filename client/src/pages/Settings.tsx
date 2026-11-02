import { useState } from "react";
import { BellRing, Check, Lock, Palette, Save, ShieldCheck, SlidersHorizontal, UserRound } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";

export default function Settings() {
  const settingsQuery = trpc.data.settings.get.useQuery();
  const saveSettings = trpc.data.settings.save.useMutation();
  const stored = Object.fromEntries((settingsQuery.data ?? []).map((item) => [item.settingKey, item.value]));
  const [saved, setSaved] = useState(false);
  const [compact, setCompact] = useState(stored.compact_mode === "true");
  const [critical, setCritical] = useState(stored.risk_critical ?? "80");
  const [high, setHigh] = useState(stored.risk_high ?? "60");
  const [notifications, setNotifications] = useState(stored.notifications_enabled !== "false");

  const save = async () => {
    await saveSettings.mutateAsync({ settings: { compact_mode: String(compact), risk_critical: critical, risk_high: high, notifications_enabled: String(notifications) } });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  };

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <span className="eyebrow">Configuration du centre</span>
          <h1 className="page-title">Paramètres opérationnels</h1>
          <p className="page-subtitle">Adaptez NaviGarde IA à votre organisation et à vos protocoles.</p>
        </div>
        <button className="btn btn-primary" onClick={save}><Save size={16} /> Enregistrer</button>
      </div>
      {saved && <div className="ai-error" style={{ background: "#dcfce7", borderColor: "#86efac", color: "#16a34a" }}><Check size={16} /> Configuration enregistrée</div>}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "var(--ng-text)" }}>Profil superviseur</h2>
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--ng-text-muted)" }}>Informations affichées dans les décisions et l'audit.</p>
          </div>
          <span className="badge badge-success"><ShieldCheck size={13} /> Vérifié</span>
        </div>
        <div className="card-body" style={{ paddingTop: 0, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
          <label className="field"><span>Nom complet</span><input defaultValue="Thomas ADJÉ" className="input" /></label>
          <label className="field"><span>Rôle</span><input defaultValue="Superviseur national" readOnly className="input" /></label>
          <label className="field"><span>E-mail professionnel</span><input defaultValue="thomas@navigarde.bj" className="input" /></label>
          <label className="field"><span>Zone de contrôle</span><input defaultValue="Littoral · Atlantique" className="input" /></label>
        </div>
      </div>
      <div className="card" style={{ marginTop: 1 }}>
        <div className="card-header">
          <div>
            <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "var(--ng-text)" }}>Seuils de décision IA</h2>
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--ng-text-muted)" }}>Ces seuils déclenchent les niveaux d'alerte visuels. La validation humaine reste obligatoire.</p>
          </div>
        </div>
        <div className="card-body" style={{ paddingTop: 0, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
          <label className="field"><span>Seuil critique</span><input type="number" value={critical} onChange={(e) => setCritical(e.target.value)} min="0" max="100" className="input" /></label>
          <label className="field"><span>Seuil élevé</span><input type="number" value={high} onChange={(e) => setHigh(e.target.value)} min="0" max="100" className="input" /></label>
          <label className="field"><span>Mode compact</span><input type="checkbox" checked={compact} onChange={(e) => setCompact(e.target.checked)} style={{ margin: 0 }} /></label>
          <label className="field"><span>Notifications</span><input type="checkbox" checked={notifications} onChange={(e) => setNotifications(e.target.checked)} style={{ margin: 0 }} /></label>
        </div>
      </div>
    </AppShell>
  );
}
