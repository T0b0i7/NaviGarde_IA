import { useMemo, useState } from "react";
import { Area, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Bell, BrainCircuit, CalendarDays, Check, ClipboardList, Clock3, Cpu, FileText, History, MapPin, Plus, Search, Settings as SettingsIcon, Ship, ShipWheel, Sparkles, TriangleAlert, Users, Zap } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import { useLang } from "@/i18n/LanguageContext";

type Insight = { headline: string; summary: string; signals: string[]; actions: string[]; confidence: number };

export default function Home() {
  const { t, locale } = useLang();
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState<"24 heures" | "7 jours" | "30 jours">("7 jours");
  const [insight, setInsight] = useState<Insight | null>(null);
  const analysis = trpc.ai.analyzeDashboard.useMutation();
  const me = trpc.auth.me.useQuery(undefined, { retry: false });
  const dq = trpc.data.dashboard.metrics.useQuery({ period }, { refetchInterval: 30000 });
  const m = dq.data?.totals;
  const activity = dq.data?.activity ?? [];
  const risks = (dq.data?.risks ?? []) as Array<{ name: string; value: number; color: string }>;
  const firstName = (me.data?.name ?? "").split(" ")[0] || "Officer";
  const roleCode = (me.data?.appRole ?? "observer") as "agent" | "supervisor" | "admin" | "observer";
  const roleName = t(`role.${roleCode}`);
  const canCreate = roleCode !== "observer";
  const quickActions = (
    roleCode === "admin"
      ? [["qaNew", "/inspections/new", Plus], ["qaAlerts", "/alertes", Bell], ["qaReports", "/rapports", FileText], ["qaVessels", "/embarcations", ShipWheel], ["qaUsers", "/utilisateurs", Users], ["qaAudit", "/audit", History], ["qaParams", "/parametres", SettingsIcon]]
      : roleCode === "supervisor"
        ? [["qaNew", "/inspections/new", Plus], ["qaAlerts", "/alertes", Bell], ["qaReports", "/rapports", FileText], ["qaVessels", "/embarcations", ShipWheel], ["qaAudit", "/audit", History]]
        : roleCode === "agent"
          ? [["qaNew", "/inspections/new", Plus], ["qaAlerts", "/alertes", Bell], ["qaVessels", "/embarcations", ShipWheel]]
          : [["qaReports", "/rapports", FileText], ["qaVessels", "/embarcations", ShipWheel], ["qaBulletins", "/bulletins", ClipboardList]]
  ) as Array<[string, string, typeof Plus]>;

  const periodLabel = (p: string) => (p === "24 heures" ? t("home.h24") : p === "30 jours" ? t("home.d30") : t("home.d7"));
  const inspections = (dq.data?.recentInspections ?? []).map((it) => ({
    id: it.id, date: new Date(it.inspectionDate).toLocaleString(locale),
    boat: `Embarcation #${it.vesselId}`, place: it.place,
    risk: it.riskScore >= 75 ? t("risk.critical") : it.riskScore >= 50 ? t("risk.high") : it.riskScore >= 25 ? t("risk.medium") : t("risk.low"),
    riskRank: it.riskScore >= 75 ? 3 : it.riskScore >= 50 ? 2 : it.riskScore >= 25 ? 1 : 0,
    status: ["terminee", "cloturee", "validee"].includes(it.status) ? t("insp.stClosed") : it.status === "rejetee" ? t("insp.stRejected") : t("insp.stEnCours"),
    closed: ["terminee", "cloturee", "validee"].includes(it.status), rejected: it.status === "rejetee",
    agent: it.agentId ? `Agent #${it.agentId}` : "-",
  }));
  const alerts = (dq.data?.recentAlerts ?? []).map((it) => ({ id: it.id, title: it.title, boat: it.vesselId ? `Embarcation #${it.vesselId}` : "Signal", meta: `${new Date(it.createdAt).toLocaleString(locale)} · ${it.place}`, tone: it.urgency === "detresse" || it.urgency === "urgent" ? "critical" : it.urgency === "elevee" ? "warning" : "info" }));
  const fInsp = useMemo(() => inspections.filter((x) => `${x.boat} ${x.place} ${x.agent}`.toLowerCase().includes(query.toLowerCase())), [query, inspections]);
  const fAlerts = useMemo(() => alerts.filter((x) => `${x.title} ${x.boat}`.toLowerCase().includes(query.toLowerCase())), [query, alerts]);

  const analyze = async () => {
    if (analysis.isPending) return;
    toast.info(t("home.aiStarted"));
    try { const r = await analysis.mutateAsync({ period, activity, risks, problems: [], delays: [], teamScore: 80 }); setInsight(r); toast.success(t("home.aiDone")); }
    catch (e) { toast.error(e instanceof Error ? e.message : "AI unavailable"); }
  };

  const donut = risks.length ? risks.map((r) => ({ ...r, name: r.name === "Faible" ? t("risk.low") : r.name === "Moyen" ? t("risk.medium") : r.name === "Élevé" ? t("risk.high") : t("risk.critical") }))
    : [{ name: t("risk.low"), value: 0, color: "var(--ng-ok)" }, { name: t("risk.medium"), value: 0, color: "var(--ng-warn)" }, { name: t("risk.high"), value: 0, color: "var(--ng-high)" }, { name: t("risk.critical"), value: 0, color: "var(--ng-crit)" }];

  return (
    <AppShell>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div><span className="mock-back" style={{ cursor: "default" }}>{t("home.kicker")}</span><h1 className="mock-h1">{t("home.hello")}, {firstName}. <span className="bdg bdg-blue" style={{ verticalAlign: "4px", marginLeft: 6 }}>{roleName}</span></h1><p className="mock-sub">{t("home.sub")}</p></div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, border: "1.5px solid var(--ng-line)", background: "var(--ng-surface)", borderRadius: 10, padding: "0 12px", height: 42 }}><CalendarDays size={15} color="var(--ng-link)" /><select value={period} onChange={(e) => setPeriod(e.target.value as never)} style={{ border: 0, outline: 0, fontSize: 12.5, fontWeight: 700, color: "var(--ng-ink)" }}><option value="24 heures">{t("home.h24")}</option><option value="7 jours">{t("home.d7")}</option><option value="30 jours">{t("home.d30")}</option></select></label>
          <span className="bdg bdg-blue"><MapPin size={12} />{t("home.zone")}</span>
          <button className="btn-blue" style={{ height: 42, padding: "0 16px", fontSize: 13 }} disabled={analysis.isPending} onClick={analyze}><BrainCircuit size={15} /> {analysis.isPending ? t("home.aiRunning") : t("home.aiBtn")}</button>
        </div>
      </div>
      <div style={{ height: 14 }} />
      {dq.isError && <div style={{ background: "var(--ng-crit-bg)", border: "1px solid var(--ng-crit-border)", borderRadius: 10, padding: 10, fontSize: 13, color: "var(--ng-crit-strong)", marginBottom: 12 }}>{t("c.dbDown")} <button onClick={() => dq.refetch()} style={{ textDecoration: "underline", fontWeight: 700 }}>{t("c.retry")}</button></div>}

      <div className="mock-kpis" style={{ marginBottom: 12 }}>
        {dq.isLoading ? (
          [0, 1, 2, 3].map((i) => <div key={i} className="skel" style={{ height: 88 }} />)
        ) : (
          <>
            <div className="mock-kpi"><div className="mock-kpi-ic" style={{ background: "var(--ng-info)" }}><FileText size={20} /></div><div><small>{t("home.kpiInsp")}</small><strong>{m?.inspections ?? 0}</strong><span className="sub">{m?.inspectionsToday ?? 0} {t("home.kpiToday")}</span></div></div>
            <div className="mock-kpi"><div className="mock-kpi-ic" style={{ background: "var(--ng-warn)" }}><Bell size={20} /></div><div><small>{t("home.kpiAlerts")}</small><strong>{m?.openAlerts ?? 0}</strong><span className="sub">{t("home.kpiTodo")}</span></div></div>
            <div className="mock-kpi"><div className="mock-kpi-ic" style={{ background: "var(--ng-teal)" }}><Ship size={20} /></div><div><small>{t("home.kpiVessels")}</small><strong>{m?.vessels ?? 0}</strong><span className="sub">{t("home.kpiWatch")}</span></div></div>
            <div className="mock-kpi"><div className="mock-kpi-ic" style={{ background: "var(--ng-purple)" }}><Clock3 size={20} /></div><div><small>{t("home.kpiReports")}</small><strong>{m?.pendingReports ?? 0}</strong><span className="sub">{t("home.kpiValidate")}</span></div></div>
          </>
        )}
      </div>

      <div className="mock-card" style={{ marginBottom: 12 }}><div className="mock-card-b" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", padding: "12px 16px" }}>
        <strong style={{ fontSize: 13, display: "inline-flex", gap: 7, alignItems: "center", color: "var(--ng-ink)" }}><Zap size={15} color="var(--ng-link)" /> {t("home.qa")}</strong>
        {quickActions.map(([key, href, Icon]) => <Link key={key} href={href} className="btn-outline-blue" style={{ width: "auto", height: 38, fontSize: 12.5, padding: "0 14px", textDecoration: "none" }}><Icon size={14} /> {t(`home.${key}` as never)}</Link>)}
      </div></div>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 12, marginBottom: 12 }}>
        <div className="mock-card"><div className="mock-card-h"><h3>{t("home.activity")}</h3><small style={{ color: "var(--ng-faint)", fontSize: 11 }}>{periodLabel(period)}</small></div>
          <div className="mock-card-b" style={{ height: 260 }}>
            {dq.isLoading ? <div className="skel" style={{ height: "100%" }} /> : activity.length === 0 ? <div style={{ height: "100%", display: "grid", placeItems: "center", color: "var(--ng-faint)", fontSize: 13 }}>{t("home.noInsp")}</div> : (
            <ResponsiveContainer width="100%" height="88%"><LineChart data={activity}><CartesianGrid strokeDasharray="3 3" stroke="var(--ng-grid)" /><XAxis dataKey="day" tick={{ fontSize: 10, fill: "var(--ng-faint)" }} axisLine={false} tickLine={false} /><Tooltip /><Line type="monotone" dataKey="confirmed" stroke="var(--ng-link)" strokeWidth={2.5} dot={false} name={t("home.lgConfirmed")} /><Line type="monotone" dataKey="progress" stroke="var(--ng-warn)" strokeWidth={2} strokeDasharray="5 4" dot={false} name={t("home.lgOngoing")} /><Area type="monotone" dataKey="confirmed" fill="var(--ng-link)" fillOpacity={0.1} stroke="none" /></LineChart></ResponsiveContainer>)}
            {!dq.isLoading && activity.length > 0 && <div style={{ display: "flex", gap: 14, justifyContent: "center", marginTop: 6, fontSize: 11.5, color: "var(--ng-soft)" }}><span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><i style={{ width: 14, height: 3, borderRadius: 2, background: "var(--ng-link)" }} />{t("home.lgConfirmed")}</span><span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><i style={{ width: 14, height: 3, borderRadius: 2, background: "var(--ng-warn)" }} />{t("home.lgOngoing")}</span></div>}
          </div></div>
        <div className="mock-card"><div className="mock-card-h"><h3><Cpu size={15} /> {t("home.risks")}</h3></div>
          <div className="mock-card-b"><div className="donut-wrap">
            <div style={{ width: 120, height: 120, position: "relative", flexShrink: 0 }}><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={donut} dataKey="value" innerRadius={40} outerRadius={56} paddingAngle={2} strokeWidth={0}>{donut.map((d, i) => <Cell key={i} fill={d.color} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>
              <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}><Check size={22} color="var(--ng-ok)" /></div></div>
            <div className="legend">{donut.map((d) => <div key={d.name}><i style={{ background: d.color }} />{d.name}<b>{d.value}%</b></div>)}</div>
          </div></div></div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 12 }}>
        <div className="mock-card"><div className="mock-card-h"><h3><FileText size={15} /> {t("home.latest")}</h3><div style={{ display: "flex", gap: 8 }}><div style={{ position: "relative" }}><Search size={14} style={{ position: "absolute", left: 10, top: 10, color: "var(--ng-faint)" }} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("home.searchPh")} style={{ height: 36, border: "1.5px solid var(--ng-line)", borderRadius: 9, padding: "0 10px 0 30px", fontSize: 12 }} /></div><Link href="/inspections/new" className="btn-blue" style={{ height: 36, fontSize: 12, padding: "0 12px", textDecoration: "none", display: canCreate ? "inline-flex" : "none" }}><Plus size={14} /> {t("home.newInspection")}</Link></div></div>
          <div style={{ overflowX: "auto", padding: "0 12px 12px" }}>
            {dq.isLoading ? <div style={{ padding: "2rem", textAlign: "center", color: "var(--ng-faint)" }}>{t("c.loading")}</div> : fInsp.length === 0 ? <div style={{ padding: "2rem", textAlign: "center", color: "var(--ng-faint)", fontSize: 13 }}>{inspections.length === 0 ? t("home.noInsp") : t("home.noMatch")}</div> : (
            <table className="mock-table"><thead><tr><th>#</th><th>{t("home.colVessel")}</th><th>{t("home.colZone")}</th><th>{t("home.colRisk")}</th><th>{t("home.colStatus")}</th><th>{t("home.colAgent")}</th></tr></thead><tbody>
              {fInsp.slice(0, 5).map((x) => <tr key={x.id} onClick={() => window.location.assign(`/inspections/${x.id}`)} style={{ cursor: "pointer" }}><td><strong style={{ color: "var(--ng-link)" }}>#{x.id}</strong></td><td><strong style={{ fontSize: 12 }}>{x.boat}</strong></td><td style={{ fontSize: 12 }}>{x.place}</td><td><span className={`bdg ${x.riskRank === 3 ? "bdg-red" : x.riskRank === 2 ? "bdg-orange" : x.riskRank === 1 ? "bdg-yellow" : "bdg-green"}`}>{x.risk}</span></td><td><span className={`bdg ${x.closed ? "bdg-green" : x.rejected ? "bdg-red" : "bdg-blue"}`}>{x.status}</span></td><td style={{ fontSize: 11 }}>{x.agent}</td></tr>)}
            </tbody></table>)}
          </div></div>
        <div className="mock-card"><div className="mock-card-h"><h3><Bell size={15} /> {t("home.recentAlerts")}</h3><Link href="/alertes" className="btn-outline-blue" style={{ width: "auto", height: 34, fontSize: 12, padding: "0 12px", textDecoration: "none" }}>{t("home.viewAll")}</Link></div>
          <div className="mock-card-b" style={{ display: "grid", gap: 8 }}>
            {fAlerts.length === 0 && <div style={{ color: "var(--ng-faint)", fontSize: 13, textAlign: "center", padding: "1rem" }}>{t("home.noAlerts")}</div>}
            {fAlerts.slice(0, 5).map((a) => <Link key={a.id} href="/alertes" style={{ display: "flex", gap: 10, border: "1px solid var(--ng-line-2)", borderRadius: 12, padding: "10px 12px", alignItems: "center" }}><span style={{ width: 34, height: 34, borderRadius: "50%", display: "grid", placeItems: "center", background: a.tone === "critical" ? "var(--ng-crit-bg-2)" : a.tone === "warning" ? "var(--ng-warn-bg)" : "var(--ng-info-bg)", color: a.tone === "critical" ? "var(--ng-crit-strong)" : "var(--ng-link)", flexShrink: 0 }}><TriangleAlert size={15} /></span><span style={{ flex: 1, minWidth: 0 }}><strong style={{ fontSize: 12.5, display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.title}</strong><small style={{ fontSize: 11, color: "var(--ng-faint)" }}>{a.meta}</small></span></Link>)}
          </div></div>
      </div>

      {insight && (
        <div className="mock-card" style={{ marginTop: 12, borderLeft: "4px solid var(--ng-link)" }}><div className="mock-card-b" style={{ display: "flex", gap: 12 }}>
          <span style={{ width: 38, height: 38, borderRadius: 11, background: "var(--ng-info-bg)", color: "var(--ng-link)", display: "grid", placeItems: "center", flexShrink: 0 }}><Sparkles size={18} /></span>
          <div style={{ flex: 1 }}><strong style={{ fontSize: 15 }}>{insight.headline}</strong><p style={{ margin: "4px 0 8px", fontSize: 13, color: "var(--ng-soft)" }}>{insight.summary}</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}><span className="bdg bdg-blue">{t("home.aiConfidence")} {insight.confidence}%</span>{insight.signals.map((s, i) => <span key={i} className="bdg bdg-gray">{s}</span>)}</div>
            <div style={{ marginTop: 8 }}><strong style={{ fontSize: 12.5 }}>{t("home.aiActions")}</strong><ul style={{ margin: "4px 0 0", paddingLeft: 18, fontSize: 12.5, color: "var(--ng-soft)" }}>{insight.actions.map((a, i) => <li key={i}>{a}</li>)}</ul></div>
          </div>
        </div></div>
      )}
    </AppShell>
  );
}
