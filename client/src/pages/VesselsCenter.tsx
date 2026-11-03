import { useMemo, useState } from "react";
import { ArrowLeft, Download, Eye, MoreVertical, Pencil, Plus, Printer, RotateCcw, Search, Ship, MapPin, CalendarDays, ShieldCheck } from "lucide-react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import { useLang } from "@/i18n/LanguageContext";
import { ChartSkeleton, EmptyState, ErrorState, KpiSkeleton, TableSkeleton } from "@/components/DashboardStates";

const ALL = "__ALL__";
function riskCode(score: number) { if (score >= 75) return "high"; if (score >= 40) return "med"; return "low"; }
function isActive(status: string) { return status !== "immobilisee"; }

export default function VesselsCenter() {
  const { t, locale } = useLang();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const me = trpc.auth.me.useQuery(undefined, { retry: false });
  const isObserver = me.data?.appRole === "observer";
  const canEdit = !isObserver;
  const q = trpc.data.vessels.list.useQuery(undefined, { refetchOnWindowFocus: false });
  const inspQ = trpc.data.inspections.list.useQuery({ limit: 500, offset: 0 }, { refetchOnWindowFocus: false });
  const createMut = trpc.data.vessels.create.useMutation({ onSuccess: () => { utils.data.vessels.list.invalidate(); toast.success(t("vs.saved")); }, onError: (e) => toast.error(e.message) });

  const [nameQ, setNameQ] = useState("");
  const [typeF, setTypeF] = useState(ALL);
  const [statusF, setStatusF] = useState(ALL);
  const [riskF, setRiskF] = useState(ALL);
  const [portF, setPortF] = useState(ALL);
  const [page, setPage] = useState(1);
  const [sel, setSel] = useState<number[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [fReg, setFReg] = useState(""); const [fName, setFName] = useState(""); const [fType, setFType] = useState("Pirogue"); const [fOwner, setFOwner] = useState(""); const [fPlace, setFPlace] = useState("Cotonou");
  const PAGE = 8;
  const rl = (s: number) => { const c = riskCode(s); return c === "high" ? t("risk.high") : c === "med" ? t("risk.medium") : t("risk.low"); };

  const lastInspByVessel = useMemo(() => {
    const m = new Map<number, { date: Date; score: number }>();
    for (const i of inspQ.data ?? []) { if (!m.has(i.vesselId)) m.set(i.vesselId, { date: new Date(i.inspectionDate), score: 100 - i.riskScore }); }
    return m;
  }, [inspQ.data]);

  const filtered = useMemo(() => (q.data ?? []).filter((v) =>
    (!nameQ || `${v.name ?? ""} ${v.registrationNumber}`.toLowerCase().includes(nameQ.toLowerCase())) &&
    (typeF === ALL || v.type === typeF) &&
    (statusF === ALL || (statusF === "on" ? isActive(v.status) : !isActive(v.status))) &&
    (riskF === ALL || riskCode(v.riskScore) === riskF) &&
    (portF === ALL || v.place === portF)
  ), [q.data, nameQ, typeF, statusF, riskF, portF]);

  const kpis = useMemo(() => {
    const rows = q.data ?? [];
    return { total: rows.length, actives: rows.filter((v) => isActive(v.status)).length, inactives: rows.filter((v) => !isActive(v.status)).length, risque: rows.filter((v) => v.riskScore >= 50).length };
  }, [q.data]);

  // charts: type breakdown + risk donut (useful visualizations)
  const barData = useMemo(() => {
    const map = new Map<string, number>();
    for (const v of filtered) map.set(v.type, (map.get(v.type) ?? 0) + 1);
    return [...map.entries()].map(([name, value]) => ({ name, value }));
  }, [filtered]);
  const donut = useMemo(() => {
    const total = Math.max(1, filtered.length);
    const c = (k: string) => filtered.filter((v) => riskCode(v.riskScore) === k).length;
    return [
      { key: "low", value: c("low"), color: "#16a34a", name: t("risk.low") },
      { key: "med", value: c("med"), color: "#f59e0b", name: t("risk.medium") },
      { key: "high", value: c("high"), color: "#ef4444", name: t("risk.high") },
    ].map((d) => ({ ...d, pct: Math.round((d.value / total) * 100) }));
  }, [filtered, t]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE, safePage * PAGE);
  const selected = (q.data ?? []).find((v) => v.id === selectedId) ?? paged[0] ?? null;
  const types = useMemo(() => [...new Set((q.data ?? []).map((v) => v.type))], [q.data]);
  const ports = useMemo(() => [...new Set((q.data ?? []).map((v) => v.place))], [q.data]);
  const reset = () => { setNameQ(""); setTypeF(ALL); setStatusF(ALL); setRiskF(ALL); setPortF(ALL); setPage(1); };

  const toggleSel = (id: number) => setSel((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id]);
  const exportCsv = () => {
    const rows = [["N", "Name", "Registration", "Type", "Port", "Status", "Risk"], ...filtered.map((v, i) => [i + 1, v.name ?? "", v.registrationNumber, v.type, v.place, v.status, v.riskScore])];
    const blob = new Blob([rows.map((r) => r.join(";")).join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "vessels.csv"; a.click();
    toast.success("OK");
  };
  const isError = q.isError;
  const vesselsErr = q.error?.message ?? t("c.dbDown");

  return (
    <AppShell>
      <Link href="/" className="mock-back"><ArrowLeft size={14} /> {t("vs.back")}</Link>
      <h1 className="mock-h1">{t("vs.title")}</h1>
      <p className="mock-sub">{t("vs.sub")}</p>
      <div style={{ height: 14 }} />
      {isError ? <div className="mock-card"><ErrorState message={vesselsErr} onRetry={() => q.refetch()} /></div> : (
      <div className="mock-page">
        <div className="mock-main">
          <div className="mock-kpis">
            {q.isLoading ? <><KpiSkeleton /><KpiSkeleton /><KpiSkeleton /><KpiSkeleton /></> : (
              <>
                <div className="mock-kpi"><div className="mock-kpi-ic" style={{ background: "#2563eb" }}><Ship size={22} /></div><div><small>{t("vs.kTotal")}</small><strong>{kpis.total}</strong></div></div>
                <div className="mock-kpi"><div className="mock-kpi-ic" style={{ background: "#16a34a" }}>✓</div><div><small>{t("vs.kAct")}</small><strong>{kpis.actives}</strong></div></div>
                <div className="mock-kpi"><div className="mock-kpi-ic" style={{ background: "#f97316" }}>❚❚</div><div><small>{t("vs.kInact")}</small><strong>{kpis.inactives}</strong></div></div>
                <div className="mock-kpi"><div className="mock-kpi-ic" style={{ background: "#ef4444" }}>!</div><div><small>{t("vs.kRisk")}</small><strong>{kpis.risque}</strong></div></div>
              </>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 12 }}>
            <div className="mock-card">
              <div className="mock-card-h"><h3><Ship size={16} /> {t("vs.colType")}</h3></div>
              <div className="mock-card-b" style={{ height: 200 }}>{q.isLoading ? <ChartSkeleton height={180} /> : barData.length === 0 ? <div style={{ height: "100%", display: "grid", placeItems: "center", color: "#7b93a8", fontSize: 13 }}>{t("c.noResult")}</div> : <ResponsiveContainer width="100%" height="100%"><BarChart data={barData}><XAxis dataKey="name" tick={{ fontSize: 10, fill: "#7b93a8" }} axisLine={false} tickLine={false} /><Tooltip /><Bar dataKey="value" radius={[6, 6, 0, 0]}>{barData.map((_, i) => <Cell key={i} fill={i % 2 ? "#60a5fa" : "#2563eb"} />)}</Bar></BarChart></ResponsiveContainer>}</div>
            </div>
            <div className="mock-card">
              <div className="mock-card-h"><h3><ShieldCheck size={16} /> {t("vs.colRisk")}</h3></div>
              <div className="mock-card-b">{q.isLoading ? <ChartSkeleton height={160} /> : <div className="donut-wrap"><div style={{ width: 130, height: 130, position: "relative", flexShrink: 0 }}><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={donut} dataKey="value" innerRadius={44} outerRadius={62} paddingAngle={2} strokeWidth={0}>{donut.map((d, i) => <Cell key={i} fill={d.color} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer><div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}><div><div style={{ fontSize: 22, fontWeight: 800, color: "#0a2a5e" }}>{filtered.length}</div><div style={{ fontSize: 11, color: "#7b93a8" }}>{t("nav.vessels").toLowerCase()}</div></div></div></div><div className="legend">{donut.map((d) => <div key={d.key}><i style={{ background: d.color }} />{d.name}<b>{d.pct}%</b><span className="n">({d.value})</span></div>)}</div></div>}</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {canEdit && <button className="btn-blue" style={{ padding: "0 18px" }} onClick={() => setShowCreate(true)}><Plus size={16} /> {t("vs.add")}</button>}
            <span style={{ flex: 1 }} />
            <button className="btn-outline-blue" style={{ width: "auto", padding: "0 18px" }} onClick={exportCsv}><Download size={15} /> {t("c.export")}</button>
            <button className="btn-outline-blue" style={{ width: "auto", padding: "0 18px" }} onClick={() => window.print()}><Printer size={15} /> {t("c.print")}</button>
          </div>

          <div className="mock-card">
            <div style={{ overflowX: "auto", padding: "12px" }}>
              {q.isLoading ? <TableSkeleton rows={6} cols={8} /> : paged.length === 0 ? (
                <EmptyState title={t("vs.empty")} hint={nameQ || typeF !== ALL || statusF !== ALL || riskF !== ALL || portF !== ALL ? t("c.noResult") : undefined} action={canEdit ? <button className="btn-blue" style={{ padding: "0 18px" }} onClick={() => setShowCreate(true)}><Plus size={15} /> {t("vs.create")}</button> : undefined} />
              ) : (
              <table className="mock-table"><thead><tr><th><input type="checkbox" checked={paged.length > 0 && paged.every((v) => sel.includes(v.id))} onChange={() => setSel(paged.every((v) => sel.includes(v.id)) ? [] : paged.map((v) => v.id))} /></th><th>{t("vs.colN")}</th><th>{t("vs.colPhoto")}</th><th>{t("vs.colName")}</th><th>{t("vs.colReg")}</th><th>{t("vs.colType")}</th><th>{t("vs.colPort")}</th><th>{t("vs.colStatus")}</th><th>{t("vs.colRisk")}</th><th>{t("c.actions")}</th></tr></thead><tbody>
                {paged.map((v, idx) => { const rc = riskCode(v.riskScore); const on = isActive(v.status); return (
                  <tr key={v.id} className={selected?.id === v.id ? "sel" : ""} onClick={() => setSelectedId(v.id)} style={{ cursor: "pointer" }}>
                    <td onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={sel.includes(v.id)} onChange={() => toggleSel(v.id)} /></td>
                    <td>{(safePage - 1) * PAGE + idx + 1}</td>
                    <td><img src="/boat-inspection.jpg" alt="" style={{ width: 64, height: 40, objectFit: "cover", borderRadius: 8 }} /></td>
                    <td><strong style={{ fontSize: 12.5 }}>{v.name ?? "-"}</strong></td>
                    <td style={{ fontSize: 12 }}>{v.registrationNumber}</td>
                    <td><span className={`bdg ${v.type === "Pirogue" ? "bdg-blue" : v.type === "Vedette" ? "bdg-purple" : v.type === "Barge" ? "bdg-orange" : "bdg-cyan"}`}>{v.type}</span></td>
                    <td style={{ fontSize: 12 }}>{v.place}</td>
                    <td><span style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 12, fontWeight: 700, color: on ? "#15803d" : "#64748b" }}><i style={{ width: 8, height: 8, borderRadius: "50%", background: on ? "#16a34a" : "#94a3b8" }} />{on ? t("c.active") : t("c.inactive")}</span></td>
                    <td><span className={`bdg ${rc === "low" ? "bdg-green" : rc === "med" ? "bdg-yellow" : "bdg-red"}`}>{rl(v.riskScore)}</span></td>
                    <td><div className="mock-actions"><button className="icon-sq" onClick={(e) => { e.stopPropagation(); navigate(`/embarcations/${v.id}`); }}><Eye size={15} /></button>{canEdit && <button className="icon-sq" onClick={(e) => { e.stopPropagation(); navigate(`/embarcations/${v.id}`); }}><Pencil size={15} /></button>}<button className="icon-sq" onClick={(e) => { e.stopPropagation(); setSelectedId(v.id); }}><MoreVertical size={15} /></button></div></td>
                  </tr>); })}
              </tbody></table>)}
            </div>
            <div className="mock-pager"><small>{t("vs.showing", { a: paged.length ? (safePage - 1) * PAGE + 1 : 0, b: (safePage - 1) * PAGE + paged.length, n: filtered.length })}</small>
              <div className="pg-btns"><button disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>←</button>{Array.from({ length: totalPages }).slice(0, 5).map((_, i) => <button key={i} className={safePage === i + 1 ? "on" : ""} onClick={() => setPage(i + 1)}>{i + 1}</button>)}<button disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)}>→</button></div>
            </div>
          </div>
        </div>

        <div className="mock-side">
          <div className="mock-filters">
            <h3>{t("c.filters")} <button onClick={reset}><RotateCcw size={13} /> {t("c.reset")}</button></h3>
            <label><span className="t">{t("vs.fName")}</span><span style={{ position: "relative", display: "block" }}><input value={nameQ} onChange={(e) => { setNameQ(e.target.value); setPage(1); }} placeholder={t("vs.fNamePh")} style={{ paddingRight: 36 }} /><Search size={15} style={{ position: "absolute", right: 12, top: 13, color: "#7b93a8" }} /></span></label>
            <label><span className="t">{t("vs.fType")}</span><select value={typeF} onChange={(e) => { setTypeF(e.target.value); setPage(1); }}><option value={ALL}>{t("c.all")}</option>{types.map((x) => <option key={x} value={x}>{x}</option>)}</select></label>
            <label><span className="t">{t("c.status")}</span><select value={statusF} onChange={(e) => { setStatusF(e.target.value); setPage(1); }}><option value={ALL}>{t("c.all")}</option><option value="on">{t("c.active")}</option><option value="off">{t("c.inactive")}</option></select></label>
            <label><span className="t">{t("vs.fRisk")}</span><select value={riskF} onChange={(e) => { setRiskF(e.target.value); setPage(1); }}><option value={ALL}>{t("c.all")}</option><option value="low">{t("risk.low")}</option><option value="med">{t("risk.medium")}</option><option value="high">{t("risk.high")}</option></select></label>
            <label><span className="t">{t("vs.fPort")}</span><select value={portF} onChange={(e) => { setPortF(e.target.value); setPage(1); }}><option value={ALL}>{t("c.all")}</option>{ports.map((p) => <option key={p} value={p}>{p}</option>)}</select></label>
          </div>

          <div className="mock-detail">
            {!selected ? <div style={{ fontSize: 13, color: "#7b93a8" }}>{t("vs.selEmpty")}</div> : (
              <>
                <h3><Ship size={15} /> {selected.name ?? selected.registrationNumber} <span className="bdg bdg-green" style={{ marginLeft: "auto" }}>{isActive(selected.status) ? t("c.active") : t("c.inactive")}</span></h3>
                <img src="/boat-inspection.jpg" alt="" className="mock-photo" style={{ height: 170 }} />
                <div style={{ fontSize: 13 }}><strong>N° {selected.registrationNumber}</strong> <span style={{ color: "#7b93a8" }}>• {selected.type}</span></div>
                <div className="mock-kv"><MapPin size={15} /><div><strong>{selected.place}</strong></div></div>
                <div className="mock-kv"><CalendarDays size={15} /><div><span>{t("vs.lastInsp")} : <strong>{lastInspByVessel.get(selected.id) ? lastInspByVessel.get(selected.id)!.date.toLocaleDateString(locale) : "-"}</strong></span></div></div>
                <div className="mock-kv"><ShieldCheck size={15} /><div><span>{t("vs.confScore")} : <strong>{lastInspByVessel.get(selected.id) ? `${lastInspByVessel.get(selected.id)!.score}%` : `${100 - selected.riskScore}%`}</strong></span></div></div>
                <button className="btn-outline-blue" onClick={() => navigate(`/embarcations/${selected.id}`)}><Eye size={15} /> {t("vs.openDetail")} →</button>
              </>
            )}
          </div>
        </div>
      </div>
      )}

      {showCreate && canEdit && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}><div className="modal-card" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header"><h2 style={{ margin: 0 }}>{t("vs.newTitle")}</h2><button className="modal-close" onClick={() => setShowCreate(false)}>×</button></div>
          <div className="modal-body" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label className="field"><span>{t("vs.fReg")} *</span><input className="input" value={fReg} onChange={(e) => setFReg(e.target.value)} placeholder="BJ-0000" /></label>
            <label className="field"><span>{t("c.name")}</span><input className="input" value={fName} onChange={(e) => setFName(e.target.value)} /></label>
            <label className="field"><span>{t("c.type")}</span><select className="input" value={fType} onChange={(e) => setFType(e.target.value)}><option>Pirogue</option><option>Vedette</option><option>Barge</option><option>Ferry</option><option>Coque</option></select></label>
            <label className="field"><span>{t("vs.fOwner")} *</span><input className="input" value={fOwner} onChange={(e) => setFOwner(e.target.value)} /></label>
            <label className="field"><span>{t("vs.fPort2")} *</span><select className="input" value={fPlace} onChange={(e) => setFPlace(e.target.value)}><option>Cotonou</option><option>Porto-Novo</option><option>Ouidah</option><option>Sèmè-Kpodji</option><option>Grand-Popo</option><option>Abomey-Calavi</option></select></label>
          </div>
          <div className="modal-footer"><button className="btn btn-secondary" onClick={() => setShowCreate(false)}>{t("c.cancel")}</button><button className="btn btn-primary" disabled={!fReg.trim() || !fOwner.trim() || createMut.isPending} onClick={() => { createMut.mutate({ registrationNumber: fReg.trim(), name: fName || undefined, type: fType, ownerName: fOwner.trim(), capacity: 0, place: fPlace, status: "conforme", riskScore: 0 }); setShowCreate(false); }}>{t("c.save")}</button></div>
        </div></div>
      )}
    </AppShell>
  );
}
