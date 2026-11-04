import { useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, CalendarDays, Check, Download, Eye, FileText, Filter, MoreVertical, Plus, RotateCcw, Search } from "lucide-react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import { useLang } from "@/i18n/LanguageContext";
import { ChartSkeleton, EmptyState, ErrorState, KpiSkeleton, TableSkeleton } from "@/components/DashboardStates";
import { ArchiveButton } from "@/components/ArchiveButton";
import { ScopeSwitch, type ArchiveScope } from "@/components/ScopeSwitch";

type Conf = "ok" | "minor" | "major" | "crit";
function confOf(risk: number): Conf { if (risk >= 75) return "crit"; if (risk >= 50) return "major"; if (risk >= 25) return "minor"; return "ok"; }
function badgeOf(c: Conf) { return c === "ok" ? "bdg-green" : c === "crit" ? "bdg-red" : c === "major" ? "bdg-orange" : "bdg-yellow"; }

export default function ReportsCenter() {
  const { t, locale } = useLang();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const me = trpc.auth.me.useQuery(undefined, { retry: false });
  const isObserver = me.data?.appRole === "observer";
  const [scope, setScope] = useState<ArchiveScope>("active");
  const reportsQ = trpc.data.reports.list.useQuery({ limit: 500, offset: 0, scope }, { refetchOnWindowFocus: false });
  const inspectionsQ = trpc.data.inspections.list.useQuery({ limit: 500, offset: 0 }, { refetchOnWindowFocus: false });
  const vesselsQ = trpc.data.vessels.list.useQuery(undefined, { refetchOnWindowFocus: false });
  const createMut = trpc.data.reports.createFromInspection.useMutation({ onSuccess: () => { utils.data.reports.list.invalidate(); toast.success("OK"); }, onError: (e) => toast.error(e.message) });

  const [q, setQ] = useState("");
  const [period, setPeriod] = useState("d7");
  const [typeF, setTypeF] = useState("__ALL__");
  const [statusF, setStatusF] = useState<"__ALL__" | Conf>("__ALL__");
  const [placeF, setPlaceF] = useState("__ALL__");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const archiveMut = trpc.data.reports.archive.useMutation({
    onSuccess: () => { utils.data.reports.list.invalidate(); toast.success(t("c.archive")); },
    onError: (e) => toast.error(e.message),
  });
  const restoreMut = trpc.data.reports.restore.useMutation({
    onSuccess: () => { utils.data.reports.list.invalidate(); toast.success(t("c.restore")); },
    onError: (e) => toast.error(e.message),
  });
  const PAGE = 6;
  const confLabel = (c: Conf) => (c === "ok" ? t("conf.compliant") : c === "minor" ? t("conf.minor") : c === "major" ? t("conf.major") : t("conf.critical"));

  const inspById = useMemo(() => new Map((inspectionsQ.data ?? []).map((i) => [i.id, i])), [inspectionsQ.data]);
  const vesselById = useMemo(() => new Map((vesselsQ.data ?? []).map((v) => [v.id, v])), [vesselsQ.data]);

  const enriched = useMemo(() => {
    const days = period === "d7" ? 7 : period === "d30" ? 30 : period === "h24" ? 1 : 9999;
    const since = Date.now() - days * 86400000;
    return (reportsQ.data ?? []).map((r) => {
      const insp = r.inspectionId ? inspById.get(r.inspectionId) : undefined;
      const vessel = insp?.vesselId ? vesselById.get(insp.vesselId) : undefined;
      const risk = insp?.riskScore ?? 0;
      return { r, insp, vessel, risk, conformity: confOf(risk), score: 100 - risk };
    }).filter(({ r, insp, vessel }) => {
      if (new Date(r.createdAt).getTime() < since) return false;
      if (typeF !== "__ALL__" && vessel?.type !== typeF) return false;
      if (placeF !== "__ALL__" && (insp?.place ?? "") !== placeF) return false;
      if (statusF !== "__ALL__" && confOf(insp?.riskScore ?? 0) !== statusF) return false;
      if (q && !`${r.reference} ${vessel?.name ?? ""} ${vessel?.registrationNumber ?? ""} ${insp?.place ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    }).sort((a, b) => new Date(b.r.createdAt).getTime() - new Date(a.r.createdAt).getTime());
  }, [reportsQ.data, inspById, vesselById, period, typeF, statusF, placeF, q]);

  const kpis = useMemo(() => {
    const all = (reportsQ.data ?? []).map((r) => confOf(r.inspectionId ? inspById.get(r.inspectionId)?.riskScore ?? 0 : 0));
    return { total: all.length, conformes: all.filter((c) => c === "ok").length, anomalies: all.filter((c) => c === "minor" || c === "major").length, critiques: all.filter((c) => c === "crit").length };
  }, [reportsQ.data, inspById]);

  const barData = useMemo(() => {
    const map = new Map<string, number>();
    for (const { r } of enriched) { const k = new Date(r.createdAt).toLocaleDateString(locale, { day: "2-digit", month: "short" }); map.set(k, (map.get(k) ?? 0) + 1); }
    return [...map.entries()].slice(-12).map(([name, value]) => ({ name, value }));
  }, [enriched, locale]);

  const donut = useMemo(() => {
    const total = Math.max(1, enriched.length);
    const c = (k: Conf) => enriched.filter((e) => e.conformity === k).length;
    return [
      { key: "ok" as Conf, value: c("ok"), color: "#16a34a" },
      { key: "minor" as Conf, value: c("minor"), color: "#f59e0b" },
      { key: "major" as Conf, value: c("major"), color: "#f97316" },
      { key: "crit" as Conf, value: c("crit"), color: "#ef4444" },
    ].map((d) => ({ ...d, name: confLabel(d.key), pct: Math.round((d.value / total) * 100) }));
  }, [enriched, t]);

  const totalPages = Math.max(1, Math.ceil(enriched.length / PAGE));
  const safePage = Math.min(page, totalPages);
  const paged = enriched.slice((safePage - 1) * PAGE, safePage * PAGE);
  const selected = enriched.find((e) => e.r.id === selectedId) ?? paged[0] ?? enriched[0] ?? null;
  const dt = (d: string | Date) => new Date(d).toLocaleString(locale);

  const reset = () => { setQ(""); setPeriod("d7"); setTypeF("__ALL__"); setStatusF("__ALL__"); setPlaceF("__ALL__"); setPage(1); };
  const places = useMemo(() => [...new Set((inspectionsQ.data ?? []).map((i) => i.place))], [inspectionsQ.data]);
  const types = useMemo(() => [...new Set((vesselsQ.data ?? []).map((v) => v.type))], [vesselsQ.data]);
  const pct = (n: number) => (kpis.total ? Math.round((n / kpis.total) * 100) : 0);
  const isLoading = reportsQ.isLoading || inspectionsQ.isLoading || vesselsQ.isLoading;
  const isError = reportsQ.isError || inspectionsQ.isError || vesselsQ.isError;
  const errMsg = (reportsQ.error?.message ?? inspectionsQ.error?.message ?? vesselsQ.error?.message ?? t("c.dbDown"));
  const retryAll = () => { reportsQ.refetch(); inspectionsQ.refetch(); vesselsQ.refetch(); };

  return (
    <AppShell>
      <Link href="/" className="mock-back"><ArrowLeft size={14} /> {t("rp.back")} <span style={{ color: "#7b93a8", fontWeight: 500 }}>| {t("rp.center")}</span></Link>
      <h1 className="mock-h1">{t("rp.title")}</h1>
      <p className="mock-sub">{t("rp.sub")}</p>
      <div style={{ height: 14 }} />

      {isError ? <div className="mock-card"><ErrorState message={errMsg} onRetry={retryAll} /></div> : (
      <div className="mock-page">
        <div className="mock-main">
          <div className="mock-kpis">
            {isLoading ? <><KpiSkeleton /><KpiSkeleton /><KpiSkeleton /><KpiSkeleton /></> : (
              <>
                <div className="mock-kpi"><div className="mock-kpi-ic" style={{ background: "#2563eb" }}><FileText size={22} /></div><div><small>{t("rp.kTotal")}</small><strong>{kpis.total}</strong><div style={{ fontSize: 11, color: "#7b93a8" }}>{t("rp.thisMonth")}</div></div></div>
                <div className="mock-kpi"><div className="mock-kpi-ic" style={{ background: "#16a34a" }}><Check size={22} /></div><div><small>{t("rp.kOk")}</small><strong>{kpis.conformes}</strong><span className="sub">{pct(kpis.conformes)}% {t("rp.ofTotal")}</span></div></div>
                <div className="mock-kpi"><div className="mock-kpi-ic" style={{ background: "#f97316" }}><AlertTriangle size={22} /></div><div><small>{t("rp.kAnom")}</small><strong>{kpis.anomalies}</strong><span className="sub">{pct(kpis.anomalies)}% {t("rp.ofTotal")}</span></div></div>
                <div className="mock-kpi"><div className="mock-kpi-ic" style={{ background: "#ef4444" }}><AlertTriangle size={22} /></div><div><small>{t("rp.kCrit")}</small><strong>{kpis.critiques}</strong><span className="sub">{pct(kpis.critiques)}% {t("rp.ofTotal")}</span></div></div>
              </>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 12 }}>
            <div className="mock-card">
              <div className="mock-card-h"><h3><CalendarDays size={16} /> {t("rp.evol")}</h3><select value={period} onChange={(e) => setPeriod(e.target.value)} style={{ height: 34, border: "1px solid #d9e6f2", borderRadius: 8, fontSize: 12, padding: "0 8px" }}><option value="d7">{t("insp.last7")}</option><option value="d30">{t("insp.last30")}</option><option value="h24">{t("home.h24")}</option><option value="all">{t("insp.everything")}</option></select></div>
              <div className="mock-card-b" style={{ height: 220 }}>
                {isLoading ? <ChartSkeleton height={200} /> : barData.length === 0 ? <div style={{ height: "100%", display: "grid", placeItems: "center", color: "#7b93a8", fontSize: 13 }}>{t("c.noResult")}</div> : (
                  <ResponsiveContainer width="100%" height="100%"><BarChart data={barData}><XAxis dataKey="name" tick={{ fontSize: 10, fill: "#7b93a8" }} axisLine={false} tickLine={false} interval={0} /><Tooltip /><Bar dataKey="value" radius={[5, 5, 0, 0]}>{barData.map((_, i) => <Cell key={i} fill={i % 2 ? "#60a5fa" : "#2563eb"} />)}</Bar></BarChart></ResponsiveContainer>
                )}
              </div>
            </div>
            <div className="mock-card">
              <div className="mock-card-h"><h3><FileText size={16} /> {t("rp.repart")}</h3></div>
              <div className="mock-card-b">{isLoading ? <ChartSkeleton height={160} /> : <div className="donut-wrap">
                <div style={{ width: 130, height: 130, position: "relative", flexShrink: 0 }}>
                  <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={donut} dataKey="value" innerRadius={44} outerRadius={62} paddingAngle={2} strokeWidth={0}>{donut.map((d, i) => <Cell key={i} fill={d.color} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>
                  <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}><div><div style={{ fontSize: 22, fontWeight: 800, color: "#0a2a5e" }}>{enriched.length}</div><div style={{ fontSize: 11, color: "#7b93a8" }}>{t("nav.reports").toLowerCase()}</div></div></div>
                </div>
                <div className="legend">{donut.map((d) => <div key={d.key}><i style={{ background: d.color }} />{d.name}<b>{d.pct}%</b><span className="n">({d.value})</span></div>)}</div>
              </div>}</div>
            </div>
          </div>

          <div className="mock-card">
            <div className="mock-card-h"><h3><FileText size={16} /> {t("rp.list")}</h3><div style={{ display: "flex", gap: 10, alignItems: "center" }}><ScopeSwitch value={scope} onChange={(v) => { setScope(v); setPage(1); setSelectedId(null); }} />{!isObserver && <button className="btn-blue" style={{ height: 38, fontSize: 13, padding: "0 14px" }} onClick={() => { const first = (inspectionsQ.data ?? [])[0]; if (!first) { toast.error(t("rp.needInsp")); return; } createMut.mutate({ inspectionId: first.id }); }}><Plus size={15} /> {t("rp.new")}</button>}</div></div>
            <div style={{ overflowX: "auto", padding: "0 12px" }}>
              {isLoading ? <TableSkeleton rows={6} cols={7} /> : paged.length === 0 ? (
                <EmptyState title={t("rp.empty")} hint={q || typeF !== "__ALL__" || statusF !== "__ALL__" || placeF !== "__ALL__" ? t("c.noResult") : undefined} action={!isObserver ? <Link href="/inspections/new" className="btn-blue" style={{ padding: "0 16px", textDecoration: "none" }}>{t("rp.newInsp")}</Link> : undefined} />
              ) : (
              <table className="mock-table"><thead><tr><th>{t("rp.colRef")}</th><th>{t("rp.colVessel")}</th><th>{t("rp.colType")}</th><th>{t("rp.colPlace")}</th><th>{t("rp.colDate")}</th><th>{t("rp.colStatus")}</th><th>{t("rp.colScore")}</th><th>{t("c.actions")}</th></tr></thead><tbody>
                {paged.map(({ r, insp, vessel, conformity, score }) => (
                  <tr key={r.id} className={selected?.r.id === r.id ? "sel" : ""} onClick={() => setSelectedId(r.id)} style={{ cursor: "pointer" }}>
                    <td><div style={{ display: "flex", gap: 8, alignItems: "center" }}><span style={{ width: 30, height: 30, borderRadius: 8, background: "#eaf4fc", color: "#0d7fdd", display: "grid", placeItems: "center" }}><FileText size={15} /></span><div><strong style={{ fontSize: 12.5 }}>{r.reference}</strong><div style={{ fontSize: 11, color: "#7b93a8" }}>{vessel?.name ?? vessel?.registrationNumber ?? `#${r.inspectionId ?? "-"}`}</div></div></div></td>
                    <td style={{ fontSize: 12 }}>{vessel?.registrationNumber ?? "-"}</td>
                    <td style={{ fontSize: 12 }}>{vessel?.type ?? "-"}</td>
                    <td style={{ fontSize: 12 }}>{insp?.place ?? "-"}</td>
                    <td style={{ fontSize: 11.5 }}>{new Date(r.createdAt).toLocaleDateString(locale)}<br />{new Date(r.createdAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}</td>
                    <td><span className={`bdg ${badgeOf(conformity)}`}>{conformity === "ok" ? <Check size={12} /> : <AlertTriangle size={12} />}{confLabel(conformity)}</span></td>
                    <td><span className="score-ring" style={{ background: `conic-gradient(${score >= 80 ? "#16a34a" : score >= 60 ? "#f59e0b" : "#ef4444"} ${score}%, #eef2f6 ${score}%)` }}><b>{score}%</b></span></td>
                    <td><div className="mock-actions"><button className="icon-sq" title={t("c.view")} onClick={(e) => { e.stopPropagation(); navigate(`/rapports/${r.id}`); }}><Eye size={15} /></button><button className="icon-sq" title="PDF" onClick={(e) => { e.stopPropagation(); window.open(`/api/reports/${r.id}/pdf`, "_blank"); }}><Download size={15} /></button>{!isObserver && <ArchiveButton archived={scope === "archived"} label={r.reference} onConfirm={() => (scope === "archived" ? restoreMut.mutateAsync({ id: r.id }) : archiveMut.mutateAsync({ id: r.id }))} />}<button className="icon-sq" title="···" onClick={(e) => { e.stopPropagation(); setSelectedId(r.id); }}><MoreVertical size={15} /></button></div></td>
                  </tr>
                ))}
              </tbody></table>)}
            </div>
            <div className="mock-pager"><small>{t("rp.showing", { a: paged.length ? (safePage - 1) * PAGE + 1 : 0, b: (safePage - 1) * PAGE + paged.length, n: enriched.length })}</small>
              <div className="pg-btns"><button disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>←</button>{Array.from({ length: totalPages }).slice(0, 5).map((_, i) => <button key={i} className={safePage === i + 1 ? "on" : ""} onClick={() => setPage(i + 1)}>{i + 1}</button>)}{totalPages > 5 && <><span style={{ fontSize: 12, color: "#7b93a8" }}>…</span><button onClick={() => setPage(totalPages)}>{totalPages}</button></>}<button disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)}>→</button></div>
            </div>
          </div>
        </div>

        <div className="mock-side">
          <div className="mock-filters">
            <h3><Filter size={15} /> {t("c.filters")} <button onClick={reset}><RotateCcw size={13} /> {t("c.reset")}</button></h3>
            <label><span className="t"><CalendarDays size={14} /> {t("insp.period")}</span><select value={period} onChange={(e) => { setPeriod(e.target.value); setPage(1); }}><option value="d7">{t("insp.last7")}</option><option value="d30">{t("insp.last30")}</option><option value="h24">{t("home.h24")}</option><option value="all">{t("insp.everything")}</option></select></label>
            <label><span className="t"><Filter size={14} /> {t("rp.colType")}</span><select value={typeF} onChange={(e) => { setTypeF(e.target.value); setPage(1); }}><option value="__ALL__">{t("c.all")}</option>{types.map((x) => <option key={x} value={x}>{x}</option>)}</select></label>
            <label><span className="t"><Check size={14} /> {t("c.status")}</span><select value={statusF} onChange={(e) => { setStatusF(e.target.value as never); setPage(1); }}><option value="__ALL__">{t("c.all")}</option><option value="ok">{t("conf.compliant")}</option><option value="minor">{t("conf.minor")}</option><option value="major">{t("conf.major")}</option><option value="crit">{t("conf.critical")}</option></select></label>
            <label><span className="t"><Search size={14} /> {t("c.search")}</span><input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder={t("rp.fSearch")} /></label>
            <label><span className="t"><Search size={14} /> {t("rp.colPlace")}</span><select value={placeF} onChange={(e) => { setPlaceF(e.target.value); setPage(1); }}><option value="__ALL__">{t("c.all")}</option>{places.map((p) => <option key={p} value={p}>{p}</option>)}</select></label>
          </div>

          <div className="mock-detail">
            <h3><FileText size={15} /> {t("rp.sel")}</h3>
            {!selected ? <div style={{ fontSize: 13, color: "#7b93a8" }}>{t("rp.selEmpty")}</div> : (
              <>
                <div style={{ display: "flex", gap: 10, alignItems: "center", background: "#f6fafd", border: "1px solid #e3ecf4", borderRadius: 12, padding: 10 }}>
                  <span style={{ width: 36, height: 36, borderRadius: 10, background: "#eaf4fc", color: "#0d7fdd", display: "grid", placeItems: "center" }}><FileText size={17} /></span>
                  <div style={{ flex: 1 }}><strong style={{ fontSize: 13 }}>{selected.r.reference}</strong><div style={{ fontSize: 11, color: "#7b93a8" }}>{selected.vessel?.name ?? selected.vessel?.registrationNumber ?? "-"}</div></div>
                  <span className={`bdg ${badgeOf(selected.conformity)}`}>{confLabel(selected.conformity)}</span>
                </div>
                <div>
                  <div className="mock-kv"><CalendarDays size={15} /><div><small>{t("rp.created")}</small><strong>{dt(selected.r.createdAt)}</strong></div></div>
                  <div className="mock-kv"><Check size={15} /><div><small>{t("rp.agent")}</small><strong>{selected.insp?.agentId ? `Agent #${selected.insp.agentId}` : "-"}</strong></div></div>
                  <div className="mock-kv"><FileText size={15} /><div><small>{t("rp.vessel")}</small><strong>{selected.vessel?.registrationNumber ?? "-"}</strong></div></div>
                  <div className="mock-kv"><Search size={15} /><div><small>{t("rp.place")}</small><strong>{selected.insp?.place ?? "-"}</strong></div></div>
                </div>
                <button className="btn-outline-blue" onClick={() => navigate(`/rapports/${selected.r.id}`)}><Eye size={15} /> {t("rp.openFull")}</button>
                <div style={{ background: "#eaf4fc", borderRadius: 12, padding: 12, fontSize: 12, color: "#0a2a5e" }}>{t("rp.aiHelp")}<div style={{ marginTop: 6 }}><Link href={`/rapports/${selected.r.id}`} style={{ color: "#0d7fdd", fontWeight: 700 }}>{t("rp.more")} →</Link></div></div>
              </>
            )}
          </div>
        </div>
      </div>
      )}
    </AppShell>
  );
}
