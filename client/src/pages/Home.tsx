import { useMemo, useState } from "react";
import { Area, AreaChart, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowUpRight, Bell, BrainCircuit, CalendarDays, ChevronRight, Clock3, FileText, MapPin, Maximize2, Minimize2, Search, ShipWheel, Sparkles, TriangleAlert } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";

type Insight = { headline: string; summary: string; signals: string[]; actions: string[]; confidence: number };

function Kpi({ icon: Icon, color, label, value, delta, down, yesterday }: { icon: any; color: string; label: string; value: string; delta: string; down?: boolean; yesterday: string }) {
  return (
    <div className="kpi-card">
      <div className="kpi-icon" style={{ backgroundColor: color }}><Icon size={20} /></div>
      <div className="kpi-content">
        <span className="kpi-label">{label}</span>
        <strong className="kpi-value">{value}</strong>
        <div className={`kpi-trend ${down ? "down" : "up"}`}>
          {down ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />} {delta}
        </div>
        <small>{yesterday}</small>
      </div>
      <ChevronRight className="kpi-arrow" size={16} />
    </div>
  );
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState<"24 heures" | "7 jours" | "30 jours">("7 jours");
  const [insight, setInsight] = useState<Insight | null>(null);
  const analysis = trpc.ai.analyzeDashboard.useMutation();
  const dashboardQuery = trpc.data.dashboard.metrics.useQuery({ period }, { refetchInterval: 30000 });
  const metrics = dashboardQuery.data?.totals;
  const activity = dashboardQuery.data?.activity ?? [];
  const risks = dashboardQuery.data?.risks ?? [];
  const inspections = dashboardQuery.data?.recentInspections?.map((item) => ({
    date: new Date(item.inspectionDate).toLocaleString("fr-FR"),
    boat: `Embarcation #${item.vesselId}`,
    type: "Inspection",
    place: item.place,
    risk: item.riskScore >= 75 ? "Critique" : item.riskScore >= 50 ? "Eleve" : item.riskScore >= 25 ? "Moyen" : "Faible",
    status: item.status === "terminee" ? "Cloturee" : item.status === "rejetee" ? "Rejetee" : "En cours",
    agent: item.agentId ? `Agent #${item.agentId}` : "Non affecte"
  })) ?? [];
  const alerts = dashboardQuery.data?.recentAlerts?.map((item) => ({
    title: item.title,
    boat: item.vesselId ? `Embarcation #${item.vesselId}` : "Signal terrain",
    meta: `${new Date(item.createdAt).toLocaleString("fr-FR")} · ${item.place}`,
    tone: item.urgency === "detresse" ? "critical" : item.urgency === "elevee" ? "warning" : "info"
  })) ?? [];

  const filteredInspections = useMemo(() => inspections.filter((item) => `${item.boat} ${item.place} ${item.agent}`.toLowerCase().includes(query.toLowerCase())), [query, inspections]);
  const filteredAlerts = useMemo(() => alerts.filter((item) => `${item.title} ${item.boat}`.toLowerCase().includes(query.toLowerCase())), [query, alerts]);

  const analyze = async () => {
    toast.info("Analyse IA lancee · NaviGarde croise les signaux avec les risques terrain.");
    try {
      const result = await analysis.mutateAsync({ period, activity, risks, problems: [], delays: [], teamScore: 86 });
      setInsight(result);
      toast.success("Analyse operationnelle disponible");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Analyse IA indisponible");
    }
  };

  return (
    <AppShell>
      <section className="page-header">
        <div>
          <span className="eyebrow">Centre de commandement · Temps reel</span>
          <h1 className="page-title">Bonjour, Thomas ADJE.</h1>
          <p className="page-subtitle">Une vue claire des risques, des equipes et des decisions a prendre aujourd’hui.</p>
        </div>
        <div className="topbar-right">
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", border: "1px solid var(--ng-line)", background: "#fff", borderRadius: "var(--ng-radius)", padding: "0 1rem", height: "40px", color: "#157eaa" }}>
            <CalendarDays size={15} />
            <select value={period} onChange={(e) => { setPeriod(e.target.value as "24 heures" | "7 jours" | "30 jours"); toast.success("Periode changee : " + e.target.value); }} style={{ border: "none", background: "transparent", color: "#315873", fontSize: "12px", outline: "none" }}>
              <option>24 heures</option>
              <option>7 jours</option>
              <option>30 jours</option>
            </select>
          </label>
          <span className="location-chip">
            <MapPin size={14} /> Littoral · Benin
          </span>
        </div>
      </section>

      <section className="kpi-row">
        <Kpi icon={FileText} color="#2563eb" label="Inspections totales" value={String(metrics?.inspections ?? 0)} delta={String(metrics?.inspectionsToday ?? 0) + " aujourd’hui"} yesterday="—" />
        <Kpi icon={Bell} color="#0ca7b0" label="Alertes ouvertes" value={String(metrics?.openAlerts ?? 0)} delta="a traiter" yesterday="—" />
        <Kpi icon={ShipWheel} color="#7c3aed" label="Embarcations suivies" value={String(metrics?.vessels ?? 0)} delta="en veille" yesterday="—" />
        <Kpi icon={Clock3} color="#f59e0b" label="Rapports en attente" value={String(metrics?.pendingReports ?? 0)} delta="a valider" down yesterday="—" />
      </section>

      <section className="dashboard-grid">
        <div className="card analytics-wide" style={{ gridColumn: "span 2" }}>
          <div className="card-header">
            <div>
              <h2 style={{ fontSize: "18px", fontWeight: 800, color: "var(--ng-text)", margin: "0 0 4px" }}>Activite des inspections</h2>
              <small style={{ color: "var(--ng-text-muted)" }}>Tendance sur la periode selectionnee</small>
            </div>
            <button className="btn-icon primary" onClick={() => analyze()}>
              <BrainCircuit size={16} />
            </button>
          </div>
          <div className="card-body" style={{ paddingTop: 0 }}>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={activity}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f6" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--ng-text-muted)" }} axisLine={false} tickMargin={8} />
                <YAxis tick={{ fontSize: 11, fill: "var(--ng-text-muted)" }} axisLine={false} hide />
                <Tooltip cursor={{ strokeDasharray: "3 3" }} contentStyle={{ background: "#fff", border: "1px solid var(--ng-line)" }} />
                <Line type="monotone" dataKey="confirmed" stroke="var(--ng-blue)" strokeWidth={2.5} dot={{ fill: "var(--ng-blue)", stroke: "#fff", strokeWidth: 2 }} />
                <Area type="monotone" dataKey="confirmed" fillOpacity={0.1} fill="var(--ng-blue)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card risks-panel">
          <div className="card-header">
            <div>
              <h2 style={{ fontSize: "18px", fontWeight: 800, color: "var(--ng-text)", margin: "0 0 4px" }}>Repartition des risques</h2>
              <small style={{ color: "var(--ng-text-muted)" }}>Niveau de criticite des embarcations</small>
            </div>
            <button className="btn-icon secondary" onClick={() => analyze()}>
              <BrainCircuit size={16} />
            </button>
          </div>
          <div className="card-body" style={{ paddingTop: 0, display: "flex", gap: 1, flexWrap: "wrap" }}>
            {risks.map((risk: any, i: number) => (
              <div key={i} style={{ flex: 1, minWidth: 120, display: "flex", flexDirection: "column", gap: 0.5, alignItems: "center" }}>
                <div style={{ width: 48, height: 48, borderRadius: "50%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: risk.color === "critique" ? "#fee2e2" : risk.color === "eleve" ? "#fef3c7" : risk.color === "moyen" ? "#e0f2fe" : "#dcfce7" }}>
                  <span style={{ fontSize: 20 }}>{risk.color === "critique" ? "!" : risk.color === "eleve" ? "!" : risk.color === "moyen" ? "!" : "!"}</span>
                </div>
                <strong style={{ fontSize: "13px", color: "var(--ng-text)" }}>{risk.name}</strong>
                <span style={{ fontSize: "11px", color: risk.color === "critique" ? "var(--ng-danger)" : risk.color === "eleve" ? "var(--ng-warning)" : risk.color === "moyen" ? "var(--ng-info)" : "var(--ng-success)", fontWeight: 700 }}>{risk.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="dashboard-grid">
        <div className="card" style={{ gridColumn: "span 2" }}>
          <div className="card-header">
            <div>
              <h2 style={{ fontSize: "18px", fontWeight: 800, color: "var(--ng-text)", margin: "0 0 4px" }}>Dernieres inspections</h2>
              <small style={{ color: "var(--ng-text-muted)" }}>Historique des controles maritimes</small>
            </div>
            <div className="table-search" style={{ width: 260, position: "relative" }}>
              <Search size={16} style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "var(--ng-text-muted)" }} />
              <input placeholder="Rechercher une embarcation, une zone, un agent…" value={query} onChange={(e) => setQuery(e.target.value)} className="input" style={{ paddingLeft: "2.5rem" }} />
            </div>
          </div>
          <div className="card-body" style={{ paddingTop: 0, overflowX: "auto" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Embarcation</th>
                  <th>Zone</th>
                  <th>Risque</th>
                  <th>Statut</th>
                  <th>Date</th>
                  <th>Agent</th>
                </tr>
              </thead>
              <tbody>
                {filteredInspections.map((insp, i) => (
                  <tr key={i}>
                    <td><strong>{insp.boat}</strong></td>
                    <td>{insp.place}</td>
                    <td><span className={`badge ${insp.risk === "Critique" ? "badge-danger" : insp.risk === "Eleve" ? "badge-warning" : insp.risk === "Moyen" ? "badge-info" : "badge-neutral"}`}>{insp.risk}</span></td>
                    <td><span className={`badge ${insp.status === "Cloturee" ? "badge-success" : insp.status === "Rejetee" ? "badge-danger" : "badge-info"}`}>{insp.status}</span></td>
                    <td>{insp.date}</td>
                    <td>{insp.agent}</td>
                  </tr>
                ))}
                {filteredInspections.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--ng-text-muted)", padding: "2rem" }}>Aucune inspection trouvee</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card alerts-panel">
          <div className="card-header">
            <div>
              <h2 style={{ fontSize: "18px", fontWeight: 800, color: "var(--ng-text)", margin: "0 0 4px" }}>Alertes recentes</h2>
              <small style={{ color: "var(--ng-text-muted)" }}>Surveillance maritime en temps reel</small>
            </div>
            <Link href="/alertes" className="btn btn-secondary" style={{ height: "auto", padding: "0 1rem", fontSize: "13px" }}>Voir toutes</Link>
          </div>
          <div className="card-body" style={{ paddingTop: 0, display: "flex", flexDirection: "column", gap: 0.75 }}>
            {filteredAlerts.map((alert, i) => (
              <div key={i} className="alert-row-button" style={{ display: "flex", alignItems: "center", gap: 0.75, padding: "0.75rem 1rem", borderRadius: "var(--ng-radius)", background: "#fff", border: "1px solid var(--ng-line)", cursor: "pointer" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: alert.tone === "critical" ? "#fee2e2" : alert.tone === "warning" ? "#fef3c7" : "#e0f2fe", color: alert.tone === "critical" ? "var(--ng-danger)" : alert.tone === "warning" ? "var(--ng-warning)" : "var(--ng-info)", fontSize: 16 }}>
                  <TriangleAlert size={16} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 0.25 }}>
                    <strong style={{ fontSize: "13px", color: "var(--ng-text)" }}>{alert.title}</strong>
                    <span style={{ fontSize: "11px", color: "var(--ng-text-muted)" }}>{alert.meta}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <span style={{ fontSize: "11px", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>{alert.boat}</span>
                  </div>
                </div>
                <ChevronRight size={14} style={{ color: "var(--ng-text-muted)" }} />
              </div>
            ))}
            {filteredAlerts.length === 0 && (
              <div style={{ padding: "1.5rem", textAlign: "center", color: "var(--ng-text-muted)" }}>Aucune alerte active</div>
            )}
          </div>
        </div>
      </section>

      {insight && (
        <section className="ai-insight">
          <div className="card" style={{ borderLeft: "4px solid var(--ng-blue)" }}>
            <div className="card-header" style={{ display: "flex", alignItems: "flex-start", gap: 1, marginBottom: 1 }}>
              <div style={{ width: 36, height: 36, background: "#e0f2fe", borderRadius: "var(--ng-radius)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ng-blue)", fontSize: 18 }}>
                <Sparkles size={18} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 800, color: "var(--ng-text)" }}>{insight.headline}</h2>
                <p style={{ margin: "2px 0 0", fontSize: "13px", color: "var(--ng-text-muted)" }}>{insight.summary}</p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 1, flexWrap: "wrap", marginBottom: 1 }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--ng-blue)", background: "#e0f2fe", padding: "4px 8px", borderRadius: "6px" }}>Confiance : {insight.confidence}%</span>
              {insight.signals.map((s, i) => (
                <span key={i} style={{ fontSize: "11px", color: "var(--ng-text-muted)", background: "#f1f5f9", padding: "4px 8px", borderRadius: "6px" }}>{s}</span>
              ))}
            </div>
            <div style={{ marginTop: 1 }}>
              <h3 style={{ fontSize: "13px", fontWeight: 700, color: "var(--ng-text)", margin: "0 0 0.5rem" }}>Actions recommandees</h3>
              <ul style={{ margin: 0, paddingLeft: 1.25, color: "var(--ng-text-muted)", fontSize: "13px", lineHeight: 1.6 }}>
                {insight.actions.map((a, i) => <li key={i}>{a}</li>)}
              </ul>
            </div>
          </div>
        </section>
      )}
    </AppShell>
  );
}
