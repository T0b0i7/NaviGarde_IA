import { useMemo, useState } from "react";
import { Archive, ArrowLeft, BadgeCheck, Bell, Check, Clock, Download, Eye, FileText, MapPin, MoreVertical, Newspaper, Plus, Search, Share2, TriangleAlert, X } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import { useLang } from "@/i18n/LanguageContext";
import { ChartSkeleton, EmptyState, ErrorState, KpiSkeleton, TableSkeleton } from "@/components/DashboardStates";

type Imp = "information" | "important" | "urgent" | "critique";
const ALL = "__ALL__";
const impBadge = (i: Imp) => i === "information" ? "bdg-cyan" : i === "important" ? "bdg-yellow" : "bdg-red";
const lvlBadge = (i: Imp) => i === "information" ? "bdg-green" : i === "important" ? "bdg-yellow" : "bdg-red";

export function BulletinsPage() {
  const { t, locale } = useLang();
  const utils = trpc.useUtils();
  const me = trpc.auth.me.useQuery(undefined, { retry: false });
  const isObserver = me.data?.appRole === "observer";
  const q = trpc.data.bulletins.list.useQuery(undefined, { refetchOnWindowFocus: false });
  const create = trpc.data.bulletins.create.useMutation({ onSuccess: () => { utils.data.bulletins.list.invalidate(); setShowCreate(false); toast.success(t("bu.saved")); }, onError: (e) => toast.error(e.message) });
  const update = trpc.data.bulletins.update.useMutation({ onSuccess: () => { utils.data.bulletins.list.invalidate(); toast.success(t("bu.updated")); }, onError: (e) => toast.error(e.message) });
  const impLabel = (i: Imp) => i === "information" ? t("lvl.info") : i === "important" ? t("lvl.warning") : t("lvl.alert");
  const lvlLabel = (i: Imp) => i === "information" ? t("risk.low") : i === "important" ? t("risk.medium") : t("risk.high");

  const [search, setSearch] = useState("");
  const [typeF, setTypeF] = useState(ALL);
  const [zoneF, setZoneF] = useState(ALL);
  const [lvlF, setLvlF] = useState(ALL);
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [cTitle, setCTitle] = useState(""); const [cZone, setCZone] = useState("Gulf of Guinea"); const [cCat, setCCat] = useState("Weather"); const [cImp, setCImp] = useState<Imp>("information"); const [cContent, setCContent] = useState("");
  const PAGE = 7;
  const dt = (d: string | Date) => new Date(d).toLocaleString(locale);

  const rows = useMemo(() => {
    return ((q.data ?? []) as Array<{ id: number; title: string; category: string; maritimeZone: string; importance: Imp; content: string; attachments: string | null; status: "brouillon" | "publie" | "archive"; createdAt: string | Date }>)
      .filter((b) => (!search || `${b.title} ${b.content} ${b.maritimeZone}`.toLowerCase().includes(search.toLowerCase())) && (typeF === ALL || b.category === typeF) && (zoneF === ALL || b.maritimeZone === zoneF) && (lvlF === ALL || b.importance === lvlF))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [q.data, search, typeF, zoneF, lvlF]);

  const kpis = useMemo(() => { const r = (q.data ?? []) as Array<{ status: string }>; return { total: r.length, encours: r.filter((x) => x.status === "brouillon").length, publies: r.filter((x) => x.status === "publie").length, archives: r.filter((x) => x.status === "archive").length }; }, [q.data]);
  const types = useMemo(() => [...new Set(((q.data ?? []) as Array<{ category: string }>).map((b) => b.category))], [q.data]);
  const zones = useMemo(() => [...new Set(((q.data ?? []) as Array<{ maritimeZone: string }>).map((b) => b.maritimeZone))], [q.data]);

  const barData = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of rows) map.set(b.category, (map.get(b.category) ?? 0) + 1);
    return [...map.entries()].slice(0, 8).map(([name, value]) => ({ name, value }));
  }, [rows]);
  const donut = useMemo(() => {
    const total = Math.max(1, rows.length);
    const cnt = (k: Imp) => rows.filter((b) => b.importance === k).length;
    return [
      { key: "information" as Imp, value: cnt("information"), color: "#16a34a", name: t("lvl.info") },
      { key: "important" as Imp, value: cnt("important"), color: "#f59e0b", name: t("lvl.warning") },
      { key: "urgent" as Imp, value: cnt("urgent"), color: "#f97316", name: t("lvl.alert") },
      { key: "critique" as Imp, value: cnt("critique"), color: "#ef4444", name: t("risk.critical") },
    ].filter((d) => d.value > 0).map((d) => ({ ...d, pct: Math.round((d.value / total) * 100) }));
  }, [rows, t]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE));
  const safePage = Math.min(page, totalPages);
  const paged = rows.slice((safePage - 1) * PAGE, safePage * PAGE);
  const selected = rows.find((b) => b.id === selectedId) ?? paged[0] ?? null;

  return (
    <AppShell>
      <Link href="/" className="mock-back"><ArrowLeft size={14} /> {t("c.back")}</Link>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <div><h1 className="mock-h1">{t("bu.title")}</h1><p className="mock-sub">{t("bu.sub")}</p></div>
        {!isObserver && <button className="btn-blue" style={{ padding: "0 18px" }} onClick={() => setShowCreate(true)}><Plus size={16} /> {t("bu.new")}</button>}
      </div>
      <div style={{ height: 14 }} />

      {q.isError ? <div className="mock-card"><ErrorState message={q.error.message ?? t("c.dbDown")} onRetry={() => q.refetch()} /></div> : (
      <div className="mock-page" style={{ gridTemplateColumns: "minmax(0,1fr) 340px" }}>
        <div className="mock-main">
          <div className="mock-kpis">
            {q.isLoading ? <><KpiSkeleton /><KpiSkeleton /><KpiSkeleton /><KpiSkeleton /></> : (
              <>
                <div className="mock-kpi"><div className="mock-kpi-ic" style={{ background: "#2563eb" }}><Newspaper size={22} /></div><div><small>{t("bu.kTotal")}</small><strong>{kpis.total}</strong></div></div>
                <div className="mock-kpi"><div className="mock-kpi-ic" style={{ background: "#f97316" }}>!</div><div><small>{t("bu.kDraft")}</small><strong>{kpis.encours}</strong></div></div>
                <div className="mock-kpi"><div className="mock-kpi-ic" style={{ background: "#16a34a" }}><Check size={22} /></div><div><small>{t("bu.kPub")}</small><strong>{kpis.publies}</strong></div></div>
                <div className="mock-kpi"><div className="mock-kpi-ic" style={{ background: "#7c3aed" }}><Archive size={22} /></div><div><small>{t("bu.kArch")}</small><strong>{kpis.archives}</strong></div></div>
              </>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 12 }}>
            <div className="mock-card">
              <div className="mock-card-h"><h3><FileText size={16} /> {t("bu.colType")}</h3></div>
              <div className="mock-card-b" style={{ height: 200 }}>{q.isLoading ? <ChartSkeleton height={180} /> : barData.length === 0 ? <div style={{ height: "100%", display: "grid", placeItems: "center", color: "#7b93a8", fontSize: 13 }}>{t("c.noResult")}</div> : <ResponsiveContainer width="100%" height="100%"><BarChart data={barData}><XAxis dataKey="name" tick={{ fontSize: 10, fill: "#7b93a8" }} axisLine={false} tickLine={false} /><Tooltip /><Bar dataKey="value" radius={[6, 6, 0, 0]}>{barData.map((_, i) => <Cell key={i} fill={i % 2 ? "#60a5fa" : "#2563eb"} />)}</Bar></BarChart></ResponsiveContainer>}</div>
            </div>
            <div className="mock-card">
              <div className="mock-card-h"><h3><TriangleAlert size={16} /> {t("bu.colLevel")}</h3></div>
              <div className="mock-card-b">{q.isLoading ? <ChartSkeleton height={160} /> : rows.length === 0 ? <div style={{ height: 160, display: "grid", placeItems: "center", color: "#7b93a8", fontSize: 13 }}>{t("c.noResult")}</div> : <div className="donut-wrap"><div style={{ width: 130, height: 130, position: "relative", flexShrink: 0 }}><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={donut} dataKey="value" innerRadius={44} outerRadius={62} paddingAngle={2} strokeWidth={0}>{donut.map((d, i) => <Cell key={i} fill={d.color} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer><div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}><div><div style={{ fontSize: 22, fontWeight: 800, color: "#0a2a5e" }}>{rows.length}</div><div style={{ fontSize: 11, color: "#7b93a8" }}>{t("nav.bulletins").toLowerCase()}</div></div></div></div><div className="legend">{donut.map((d) => <div key={String(d.key)}><i style={{ background: d.color }} />{d.name}<b>{d.pct}%</b><span className="n">({d.value})</span></div>)}</div></div>}</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: "1 1 220px" }}><Search size={16} style={{ position: "absolute", left: 12, top: 13, color: "#7b93a8" }} /><input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder={t("bu.searchPh")} style={{ width: "100%", height: 42, border: "1.5px solid #d9e6f2", borderRadius: 10, padding: "0 12px 0 36px", fontSize: 13 }} /></div>
            <select value={typeF} onChange={(e) => { setTypeF(e.target.value); setPage(1); }} style={{ height: 42, border: "1.5px solid #d9e6f2", borderRadius: 10, fontSize: 12.5, padding: "0 10px", background: "#fff" }}><option value={ALL}>{t("bu.allTypes")}</option>{types.map((x) => <option key={x} value={x}>{x}</option>)}</select>
            <select value={zoneF} onChange={(e) => { setZoneF(e.target.value); setPage(1); }} style={{ height: 42, border: "1.5px solid #d9e6f2", borderRadius: 10, fontSize: 12.5, padding: "0 10px", background: "#fff" }}><option value={ALL}>{t("bu.allZones")}</option>{zones.map((z) => <option key={z} value={z}>{z}</option>)}</select>
            <select value={lvlF} onChange={(e) => { setLvlF(e.target.value); setPage(1); }} style={{ height: 42, border: "1.5px solid #d9e6f2", borderRadius: 10, fontSize: 12.5, padding: "0 10px", background: "#fff" }}><option value={ALL}>{t("bu.allLevels")}</option><option value="information">{t("risk.low")}</option><option value="important">{t("risk.medium")}</option><option value="urgent">{t("risk.high")}</option><option value="critique">{t("risk.critical")}</option></select>
          </div>

          <div className="mock-card">
            <div style={{ overflowX: "auto", padding: 12 }}>
              {q.isLoading ? <TableSkeleton rows={6} cols={7} /> : paged.length === 0 ? (
                <EmptyState title={t("bu.empty")} hint={search || typeF !== ALL || zoneF !== ALL || lvlF !== ALL ? t("c.noResult") : undefined} action={!isObserver ? <button className="btn-blue" style={{ padding: "0 18px" }} onClick={() => setShowCreate(true)}><Plus size={15} /> {t("bu.new")}</button> : undefined} />
              ) : (
              <table className="mock-table"><thead><tr><th>{t("bu.colN")}</th><th>{t("bu.colTitle")}</th><th>{t("bu.colType")}</th><th>{t("bu.colZone")}</th><th>{t("bu.colLevel")}</th><th>{t("bu.colDate")}</th><th>{t("bu.colStatus")}</th><th>{t("c.actions")}</th></tr></thead><tbody>
                {paged.map((b) => (
                  <tr key={b.id} className={selected?.id === b.id ? "sel" : ""} onClick={() => setSelectedId(b.id)} style={{ cursor: "pointer" }}>
                    <td style={{ fontSize: 11.5, fontWeight: 700, color: "#0d7fdd" }}>BM-{new Date(b.createdAt).getFullYear()}-{String(b.id).padStart(3, "0")}</td>
                    <td style={{ maxWidth: 180 }}><strong style={{ fontSize: 12.5 }}>{b.title}</strong></td>
                    <td><span className={`bdg ${impBadge(b.importance)}`}>{impLabel(b.importance)}</span></td>
                    <td style={{ fontSize: 12 }}>{b.maritimeZone}</td>
                    <td><span className={`bdg ${lvlBadge(b.importance)}`}>{b.importance === "information" ? <Check size={11} /> : <TriangleAlert size={11} />}{lvlLabel(b.importance)}</span></td>
                    <td style={{ fontSize: 11.5 }}>{new Date(b.createdAt).toLocaleDateString(locale)}<br />{new Date(b.createdAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}</td>
                    <td>{b.status === "publie" ? <span className="bdg bdg-green"><Check size={11} /> {t("bu.published")}</span> : b.status === "archive" ? <span className="bdg bdg-gray"><Archive size={11} /> {t("bu.archived")}</span> : <span className="bdg bdg-yellow"><Clock size={11} /> {t("bu.draft")}</span>}</td>
                    <td><div className="mock-actions"><button className="icon-sq" onClick={(e) => { e.stopPropagation(); setSelectedId(b.id); }}><Eye size={14} /></button>{!isObserver && <button className="icon-sq" onClick={(e) => { e.stopPropagation(); update.mutate({ id: b.id, patch: { status: b.status === "publie" ? "archive" : "publie" } }); }}><MoreVertical size={14} /></button>}</div></td>
                  </tr>
                ))}
              </tbody></table>)}
            </div>
            <div className="mock-pager"><small>{t("bu.showing", { a: paged.length ? (safePage - 1) * PAGE + 1 : 0, b: (safePage - 1) * PAGE + paged.length, n: rows.length })}</small>
              <div className="pg-btns"><button disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>←</button>{Array.from({ length: totalPages }).slice(0, 5).map((_, i) => <button key={i} className={safePage === i + 1 ? "on" : ""} onClick={() => setPage(i + 1)}>{i + 1}</button>)}<button disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)}>→</button></div>
            </div>
          </div>
        </div>

        <div className="mock-side">
          <div className="mock-detail">
            <h3>{t("bu.detail")} {selected && <button style={{ marginLeft: "auto", color: "#7b93a8" }} onClick={() => setSelectedId(null)}><X size={16} /></button>}</h3>
            {!selected ? <div style={{ fontSize: 13, color: "#7b93a8" }}>{t("bu.selEmpty")}</div> : (
              <>
                <div style={{ position: "relative" }}>
                  <img src="/boat-inspection.jpg" alt="" style={{ width: "100%", height: 170, objectFit: "cover", borderRadius: 12 }} />
                  <span className={`bdg ${impBadge(selected.importance)}`} style={{ position: "absolute", top: 8, right: 8 }}><TriangleAlert size={11} /> {impLabel(selected.importance)}</span>
                </div>
                <h2 style={{ margin: 0, fontSize: 19, color: "#0a2a5e", lineHeight: 1.25 }}>{selected.title}</h2>
                <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#0d7fdd", fontWeight: 600, flexWrap: "wrap" }}><span style={{ display: "inline-flex", gap: 5, alignItems: "center" }}><Clock size={13} /> {dt(selected.createdAt)}</span><span style={{ display: "inline-flex", gap: 5, alignItems: "center" }}><MapPin size={13} /> {selected.maritimeZone}</span></div>
                <div style={{ background: selected.importance === "information" ? "#dcfce7" : "#fee2e2", color: selected.importance === "information" ? "#15803d" : "#b91c1c", borderRadius: 10, padding: "10px 12px", fontWeight: 800, fontSize: 13, display: "flex", gap: 8, alignItems: "center" }}><TriangleAlert size={16} /> {t("bu.level")} : {lvlLabel(selected.importance)}</div>
                <div><h4 style={{ margin: "0 0 6px", fontSize: 13, display: "flex", gap: 6, alignItems: "center" }}><BadgeCheck size={14} color="#0d7fdd" /> {t("bu.summary")}</h4><p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.55, color: "#0a2a5e" }}>{selected.content}</p></div>
                <div><h4 style={{ margin: "0 0 6px", fontSize: 13, display: "flex", gap: 6, alignItems: "center" }}><BadgeCheck size={14} color="#0d7fdd" /> {t("bu.reco")}</h4>
                  <div style={{ display: "grid", gap: 5, fontSize: 12.5 }}>{(selected.importance === "information" ? t("bu.recoSafe") : t("bu.recoBad")).split(",").map((r, i) => <div key={i} style={{ display: "flex", gap: 7 }}><Check size={14} color="#16a34a" style={{ flexShrink: 0, marginTop: 2 }} /><span>{r}</span></div>)}</div>
                </div>
                <div><h4 style={{ margin: "0 0 6px", fontSize: 13, display: "flex", gap: 6, alignItems: "center" }}><FileText size={14} color="#0d7fdd" /> {t("bu.files")}</h4>
                  {(() => { try { const atts = selected.attachments ? JSON.parse(selected.attachments) as string[] : []; if (!atts.length) return <div style={{ fontSize: 12, color: "#7b93a8" }}>{t("bu.noFiles")}</div>; return atts.map((u, i) => <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5, padding: "6px 0" }}><span style={{ color: "#0d7fdd", fontWeight: 600 }}>Bulletin_{String(selected.id).padStart(3, "0")}.pdf</span><button className="icon-sq" onClick={() => window.open(u, "_blank")}><Download size={14} /></button></div>); } catch { return <div style={{ fontSize: 12, color: "#7b93a8" }}>{t("bu.noFiles")}</div>; } })()}
                </div>
                <button className="btn-blue" onClick={() => { const atts = (() => { try { return selected.attachments ? JSON.parse(selected.attachments) as string[] : []; } catch { return []; } })(); if (atts[0]) window.open(atts[0], "_blank"); else toast.info(t("bu.noFileDl")); }}><Download size={15} /> {t("c.download")}</button>
                <button className="btn-outline-blue" onClick={async () => { try { await navigator.clipboard.writeText(`${selected.title} - ${selected.content}`); toast.success("OK"); } catch {} }}><Share2 size={15} /> {t("c.share")}</button>
                {!isObserver && <button className="btn-outline-blue" onClick={() => update.mutate({ id: selected.id, patch: { status: selected.status === "publie" ? "archive" : "publie" } })}>{selected.status === "publie" ? <><Archive size={15} /> {t("bu.archive")}</> : <><Bell size={15} /> {t("bu.publish")}</>}</button>}
              </>
            )}
          </div>
        </div>
      </div>
      )}

      {showCreate && !isObserver && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}><div className="modal-card" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header"><h2 style={{ margin: 0 }}>{t("bu.createTitle")}</h2><button className="modal-close" onClick={() => setShowCreate(false)}>×</button></div>
          <div className="modal-body" style={{ display: "grid", gap: 10 }}>
            <label className="field"><span>{t("bu.fTitle")} *</span><input className="input" value={cTitle} onChange={(e) => setCTitle(e.target.value)} placeholder={t("bu.fTitlePh")} /></label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label className="field"><span>{t("bu.fZone")} *</span><input className="input" value={cZone} onChange={(e) => setCZone(e.target.value)} /></label>
              <label className="field"><span>{t("bu.fCat")}</span><input className="input" value={cCat} onChange={(e) => setCCat(e.target.value)} /></label>
            </div>
            <label className="field"><span>{t("bu.fLevel")}</span><select className="input" value={cImp} onChange={(e) => setCImp(e.target.value as Imp)}><option value="information">{t("lvl.info")} / {t("risk.low")}</option><option value="important">{t("lvl.warning")} / {t("risk.medium")}</option><option value="urgent">{t("lvl.alert")} / {t("risk.high")}</option><option value="critique">{t("risk.critical")}</option></select></label>
            <label className="field"><span>{t("c.details")} *</span><textarea className="input" style={{ height: 100, padding: 12 }} value={cContent} onChange={(e) => setCContent(e.target.value)} /></label>
          </div>
          <div className="modal-footer"><button className="btn btn-secondary" onClick={() => setShowCreate(false)}>{t("c.cancel")}</button><button className="btn btn-primary" disabled={!cTitle.trim() || cContent.trim().length < 10 || create.isPending} onClick={() => create.mutate({ title: cTitle.trim(), category: cCat, maritimeZone: cZone.trim(), importance: cImp, content: cContent.trim(), attachments: [] })}>{create.isPending ? "…" : t("c.save")}</button></div>
        </div></div>
      )}
    </AppShell>
  );
}
