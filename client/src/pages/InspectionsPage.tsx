import { useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, Check, ClipboardList, Clock3, Filter, MapPin, MoreHorizontal, Plus, Search } from "lucide-react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import { useLang } from "@/i18n/LanguageContext";
import { EmptyState, ErrorState, KpiSkeleton, TableSkeleton } from "@/components/DashboardStates";
import { ArchiveButton } from "@/components/ArchiveButton";
import { ScopeSwitch, type ArchiveScope } from "@/components/ScopeSwitch";

const ALL = "__ALL__";
function riskCode(s: number) { if (s >= 50) return "high"; if (s >= 25) return "med"; return "low"; }
function statusCode(s: string) { if (s === "validee" || s === "terminee" || s === "cloturee") return "closed"; if (s === "a_verifier") return "verify"; if (s === "rejetee") return "rejected"; return "ongoing"; }

export default function InspectionsPage() {
  const { t, locale } = useLang();
  const [, navigate] = useLocation();
  const [scope, setScope] = useState<ArchiveScope>("active");
  const listQ = trpc.data.inspections.list.useQuery({ limit: 500, offset: 0, scope }, { refetchOnWindowFocus: false });
  const vesselsQ = trpc.data.vessels.list.useQuery(undefined, { refetchOnWindowFocus: false });
  const utils = trpc.useUtils();
  const me = trpc.auth.me.useQuery(undefined, { retry: false });
  const isObserver = me.data?.appRole === "observer";
  const archiveMut = trpc.data.inspections.archive.useMutation({ onSuccess: () => { utils.data.inspections.list.invalidate(); toast.success(t("c.archive")); }, onError: (e) => toast.error(e.message) });
  const restoreMut = trpc.data.inspections.restore.useMutation({ onSuccess: () => { utils.data.inspections.list.invalidate(); toast.success(t("c.restore")); }, onError: (e) => toast.error(e.message) });
  const [q, setQ] = useState(""); const [period, setPeriod] = useState("d7"); const [placeF, setPlaceF] = useState(ALL); const [riskF, setRiskF] = useState(ALL); const [statusF, setStatusF] = useState(ALL);
  const [page, setPage] = useState(1); const [sel, setSel] = useState<number[]>([]);
  const PAGE = 8;

  const vesselById = useMemo(() => new Map((vesselsQ.data ?? []).map((v) => [v.id, v])), [vesselsQ.data]);
  const rows = useMemo(() => {
    const days = period === "d7" ? 7 : period === "d30" ? 30 : 9999;
    const since = Date.now() - days * 86400000;
    return (listQ.data ?? []).filter((i) => {
      if (new Date(i.inspectionDate).getTime() < since) return false;
      const v = vesselById.get(i.vesselId);
      if (q && !`${v?.name ?? ""} ${v?.registrationNumber ?? ""} ${i.place}`.toLowerCase().includes(q.toLowerCase())) return false;
      if (placeF !== ALL && i.place !== placeF) return false;
      if (riskF !== ALL && riskCode(i.riskScore) !== riskF) return false;
      if (statusF !== ALL && statusCode(i.status) !== statusF) return false;
      return true;
    }).sort((a, b) => new Date(b.inspectionDate).getTime() - new Date(a.inspectionDate).getTime());
  }, [listQ.data, vesselById, q, period, placeF, riskF, statusF]);

  const kpis = useMemo(() => { const r = listQ.data ?? []; return { total: r.length, clot: r.filter((i) => statusCode(i.status) === "closed").length, encours: r.filter((i) => statusCode(i.status) === "ongoing").length, risque: r.filter((i) => i.riskScore >= 50).length }; }, [listQ.data]);
  const places = useMemo(() => [...new Set((listQ.data ?? []).map((i) => i.place))], [listQ.data]);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE));
  const safe = Math.min(page, totalPages);
  const paged = rows.slice((safe - 1) * PAGE, safe * PAGE);
  const rl = (s: number) => (riskCode(s) === "high" ? t("risk.high") : riskCode(s) === "med" ? t("risk.medium") : t("risk.low"));
  const sl = (s: string) => { const c = statusCode(s); return c === "closed" ? t("insp.stClosed") : c === "verify" ? t("insp.stVerify") : c === "rejected" ? t("insp.stRejected") : t("insp.stEnCours"); };
  const resetF = () => { setQ(""); setPlaceF(ALL); setRiskF(ALL); setStatusF(ALL); setPage(1); };

  return (
    <AppShell>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div><h1 className="mock-h1">{t("insp.title")}</h1><p className="mock-sub">{t("insp.sub")}</p></div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}><ScopeSwitch value={scope} onChange={(v) => { setScope(v); setPage(1); }} /><Link href="/inspections/new" className="btn-blue" style={{ padding: "0 18px", textDecoration: "none" }}><Plus size={16} /> {t("insp.new")}</Link></div>
      </div>
      <div style={{ height: 14 }} />

      <div className="mock-card" style={{ marginBottom: 12 }}><div className="mock-card-b" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 260px" }}><Search size={16} style={{ position: "absolute", left: 12, top: 13, color: "var(--ng-faint)" }} /><input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder={t("insp.searchPh")} style={{ width: "100%", height: 44, border: "1.5px solid var(--ng-line)", borderRadius: 10, padding: "0 12px 0 36px", fontSize: 13 }} /></div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, border: "1.5px solid var(--ng-line)", borderRadius: 10, padding: "0 12px", height: 44, fontSize: 12.5 }}><CalendarDays size={15} color="var(--ng-link)" /><span style={{ color: "var(--ng-faint)" }}>{t("insp.period")}</span><select value={period} onChange={(e) => { setPeriod(e.target.value); setPage(1); }} style={{ border: 0, outline: 0, fontSize: 12.5, fontWeight: 700, color: "var(--ng-ink)" }}><option value="d7">{t("insp.last7")}</option><option value="d30">{t("insp.last30")}</option><option value="all">{t("insp.everything")}</option></select></label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, border: "1.5px solid var(--ng-line)", borderRadius: 10, padding: "0 12px", height: 44, fontSize: 12.5 }}><MapPin size={15} color="var(--ng-link)" /><span style={{ color: "var(--ng-faint)" }}>{t("insp.lieu")}</span><select value={placeF} onChange={(e) => { setPlaceF(e.target.value); setPage(1); }} style={{ border: 0, outline: 0, fontSize: 12.5, fontWeight: 700 }}><option value={ALL}>{t("c.all")}</option>{places.map((p) => <option key={p} value={p}>{p}</option>)}</select></label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, border: "1.5px solid var(--ng-line)", borderRadius: 10, padding: "0 12px", height: 44, fontSize: 12.5 }}><AlertTriangle size={15} color="var(--ng-link)" /><span style={{ color: "var(--ng-faint)" }}>{t("insp.risk")}</span><select value={riskF} onChange={(e) => { setRiskF(e.target.value); setPage(1); }} style={{ border: 0, outline: 0, fontSize: 12.5, fontWeight: 700 }}><option value={ALL}>{t("c.all")}</option><option value="low">{t("risk.low")}</option><option value="med">{t("risk.medium")}</option><option value="high">{t("risk.high")}</option></select></label>
        <label style={{ display: "flex", alignItems: "center", gap: 8, border: "1.5px solid var(--ng-line)", borderRadius: 10, padding: "0 12px", height: 44, fontSize: 12.5 }}><ClipboardList size={15} color="var(--ng-link)" /><span style={{ color: "var(--ng-faint)" }}>{t("insp.status")}</span><select value={statusF} onChange={(e) => { setStatusF(e.target.value); setPage(1); }} style={{ border: 0, outline: 0, fontSize: 12.5, fontWeight: 700 }}><option value={ALL}>{t("c.all")}</option><option value="ongoing">{t("insp.stEnCours")}</option><option value="verify">{t("insp.stVerify")}</option><option value="closed">{t("insp.stClosed")}</option><option value="rejected">{t("insp.stRejected")}</option></select></label>
        <button className="btn-outline-blue" style={{ width: "auto", padding: "0 16px" }} onClick={resetF}><Filter size={14} /> {t("c.filters")}</button>
      </div></div>

      <div className="mock-kpis" style={{ marginBottom: 12 }}>
        {listQ.isLoading ? (
          [0, 1, 2, 3].map((i) => <KpiSkeleton key={i} />)
        ) : listQ.isError ? (
          <div style={{ gridColumn: "1 / -1" }}><ErrorState message={t("c.dbDown")} onRetry={() => listQ.refetch()} /></div>
        ) : (
          <>
            <div className="mock-kpi"><div className="mock-kpi-ic" style={{ background: "var(--ng-info)" }}><ClipboardList size={20} /></div><div><strong>{kpis.total}</strong><small>{t("insp.kpiTotal")}</small></div></div>
            <div className="mock-kpi"><div className="mock-kpi-ic" style={{ background: "var(--ng-ok)" }}><Check size={20} /></div><div><strong>{kpis.clot}</strong><small>{t("insp.kpiClosed")}</small></div></div>
            <div className="mock-kpi"><div className="mock-kpi-ic" style={{ background: "var(--ng-warn)" }}><Clock3 size={20} /></div><div><strong>{kpis.encours}</strong><small>{t("insp.kpiOngoing")}</small></div></div>
            <div className="mock-kpi"><div className="mock-kpi-ic" style={{ background: "var(--ng-crit)" }}><AlertTriangle size={20} /></div><div><strong>{kpis.risque}</strong><small>{t("insp.kpiRisk")}</small></div></div>
          </>
        )}
      </div>

      <div className="mock-card">
        <div style={{ overflowX: "auto", padding: 12 }}>
          {listQ.isLoading ? <TableSkeleton rows={6} cols={7} /> : listQ.isError ? <ErrorState message={t("c.dbDown")} onRetry={() => listQ.refetch()} /> : paged.length === 0 ? (
            <EmptyState title={t("insp.empty")} action={<Link href="/inspections/new" className="btn-blue" style={{ padding: "0 18px", textDecoration: "none" }}>{t("insp.new")}</Link>} />
          ) : (
          <table className="mock-table"><thead><tr><th><input type="checkbox" checked={paged.length > 0 && paged.every((i) => sel.includes(i.id))} onChange={() => setSel(paged.every((i) => sel.includes(i.id)) ? [] : paged.map((i) => i.id))} /></th><th>{t("insp.colDate")}</th><th>{t("insp.colVessel")}</th><th>{t("insp.colType")}</th><th>{t("insp.colPlace")}</th><th>{t("insp.colRisk")}</th><th>{t("insp.colStatus")}</th><th>{t("insp.colAgent")}</th><th></th></tr></thead><tbody>
            {paged.map((i) => { const v = vesselById.get(i.vesselId); const rc = riskCode(i.riskScore); const sc = statusCode(i.status); return (
              <tr key={i.id} onClick={() => navigate(`/inspections/${i.id}`)} style={{ cursor: "pointer" }}>
                <td onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={sel.includes(i.id)} onChange={() => setSel((s) => s.includes(i.id) ? s.filter((x) => x !== i.id) : [...s, i.id])} /></td>
                <td style={{ fontSize: 11.5 }}>{new Date(i.inspectionDate).toLocaleDateString(locale)}<br />{new Date(i.inspectionDate).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}</td>
                <td><div style={{ display: "flex", gap: 8, alignItems: "center" }}><img src="/boat-inspection.jpg" alt="" style={{ width: 44, height: 32, objectFit: "cover", borderRadius: 6 }} /><strong style={{ fontSize: 12.5 }}>{v?.name ?? v?.registrationNumber ?? `#${i.vesselId}`}</strong></div></td>
                <td><span className={`bdg ${v?.type === "Vedette" ? "bdg-purple" : v?.type === "Barge" ? "bdg-cyan" : "bdg-blue"}`}>{v?.type ?? "-"}</span></td>
                <td style={{ fontSize: 12 }}><MapPin size={12} color="var(--ng-link)" /> {i.place}</td>
                <td><span className={`bdg ${rc === "high" ? "bdg-orange" : rc === "med" ? "bdg-yellow" : "bdg-green"}`}>{rl(i.riskScore)}</span></td>
                <td><span className={`bdg ${sc === "closed" ? "bdg-green" : sc === "verify" ? "bdg-purple" : "bdg-cyan"}`}>{sl(i.status)}</span></td>
                <td style={{ fontSize: 12 }}>{i.agentId ? `Agent #${i.agentId}` : "-"}</td>
                <td><div className="mock-actions"><button className="icon-sq" onClick={(e) => { e.stopPropagation(); navigate(`/inspections/${i.id}`); }}><MoreHorizontal size={15} /></button>{!isObserver && <ArchiveButton archived={scope === "archived"} label={`Inspection #${i.id} - ${i.place}`} onConfirm={() => (scope === "archived" ? restoreMut.mutateAsync({ id: i.id }) : archiveMut.mutateAsync({ id: i.id }))} />}</div></td>
              </tr>); })}
          </tbody></table>)}
        </div>
        <div className="mock-pager"><small>{t("insp.showing", { a: paged.length ? (safe - 1) * PAGE + 1 : 0, b: (safe - 1) * PAGE + paged.length, n: rows.length })}</small>
          <div className="pg-btns"><button disabled={safe <= 1} onClick={() => setPage(safe - 1)}>←</button>{Array.from({ length: totalPages }).slice(0, 3).map((_, x) => <button key={x} className={safe === x + 1 ? "on" : ""} onClick={() => setPage(x + 1)}>{x + 1}</button>)}<button disabled={safe >= totalPages} onClick={() => setPage(safe + 1)}>→</button></div>
        </div>
      </div>
    </AppShell>
  );
}
