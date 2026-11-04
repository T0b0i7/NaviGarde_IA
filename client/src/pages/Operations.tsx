import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import { AlertTriangle, Anchor, Bell, CalendarDays, Check, CheckCheck, ChevronRight, Clock3, Copy, Download, Eye, FileText, Filter, History, MapPin, Mic, Pencil, Plus, RotateCcw, Search, Send, ShieldCheck, Trash2, Users, X, EyeOff } from "lucide-react";
import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import { useLang } from "@/i18n/LanguageContext";
import { EmptyState, ErrorState, KpiSkeleton, Skeleton, TableSkeleton } from "@/components/DashboardStates";
import { ArchiveButton } from "@/components/ArchiveButton";
import { ScopeSwitch, type ArchiveScope } from "@/components/ScopeSwitch";

type Level = "Urgente" | "Importante" | "Moyenne" | "Résolue";
function levelOf(a: { urgency: string; status: string }): Level {
  if (a.status === "resolue" || a.status === "cloturee") return "Résolue";
  if (a.urgency === "detresse" || a.urgency === "urgent") return "Urgente";
  if (a.urgency === "elevee") return "Importante";
  return "Moyenne";
}

/* ===================== ALERTES ===================== */
export function AlertsPage() {
  const { t, locale } = useLang();
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const me = trpc.auth.me.useQuery(undefined, { retry: false });
  const canManage = me.data?.appRole === "admin" || me.data?.appRole === "supervisor";
  const [scope, setScope] = useState<ArchiveScope>("active");
  const q = trpc.data.alerts.list.useQuery({ limit: 500, offset: 0, scope }, { refetchOnWindowFocus: false, refetchInterval: 20000 });
  const vesselsQ = trpc.data.vessels.list.useQuery(undefined, { refetchOnWindowFocus: false });
  const update = trpc.data.alerts.update.useMutation({ onSuccess: () => { utils.data.alerts.list.invalidate(); toast.success("OK"); }, onError: (e) => toast.error(e.message) });
  const create = trpc.data.alerts.create.useMutation({ onSuccess: () => { utils.data.alerts.list.invalidate(); setShowCreate(false); toast.success("OK"); }, onError: (e) => toast.error(e.message) });
  const archiveMut = trpc.data.alerts.remove.useMutation({ onSuccess: () => { utils.data.alerts.list.invalidate(); toast.success(t("c.archive")); }, onError: (e) => toast.error(e.message) });
  const restoreMut = trpc.data.alerts.restore.useMutation({ onSuccess: () => { utils.data.alerts.list.invalidate(); toast.success(t("c.restore")); }, onError: (e) => toast.error(e.message) });

  const [tab, setTab] = useState<"Toutes" | Level>("Toutes");
  const [period, setPeriod] = useState("d7");
  const [typeF, setTypeF] = useState("__ALL__");
  const [riskF, setRiskF] = useState<"__ALL__" | Level>("__ALL__");
  const [statusF, setStatusF] = useState("__ALL__");
  const [vesselF, setVesselF] = useState("__ALL__");
  const [page, setPage] = useState(1);
  const [selId, setSelId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [fTitle, setFTitle] = useState(""); const [fPlace, setFPlace] = useState("Cotonou"); const [fUrg, setFUrg] = useState<"information" | "elevee" | "urgent" | "detresse">("urgent"); const [fDesc, setFDesc] = useState("");
  const PAGE = 8;

  const vesselById = useMemo(() => new Map((vesselsQ.data ?? []).map((v) => [v.id, v])), [vesselsQ.data]);
  const rows = useMemo(() => {
    const days = period === "d7" ? 7 : period === "d30" ? 30 : 9999;
    const since = Date.now() - days * 86400000;
    return (q.data ?? []).filter((a) => {
      if (new Date(a.createdAt).getTime() < since) return false;
      if (tab !== "Toutes" && levelOf(a) !== tab) return false;
      if (typeF !== "__ALL__" && a.source !== typeF) return false;
      if (riskF !== "__ALL__" && levelOf(a) !== riskF) return false;
      if (statusF !== "__ALL__" && a.status !== statusF) return false;
      if (vesselF !== "__ALL__" && String(a.vesselId ?? "") !== vesselF) return false;
      return true;
    }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [q.data, tab, period, typeF, riskF, statusF, vesselF]);

  const kpis = useMemo(() => { const r = q.data ?? []; return { urg: r.filter((a) => levelOf(a) === "Urgente").length, imp: r.filter((a) => levelOf(a) === "Importante").length, moy: r.filter((a) => levelOf(a) === "Moyenne").length, res: r.filter((a) => levelOf(a) === "Résolue").length }; }, [q.data]);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE));
  const safe = Math.min(page, totalPages);
  const paged = rows.slice((safe - 1) * PAGE, safe * PAGE);
  const sel = rows.find((a) => a.id === selId) ?? paged[0] ?? null;
  const reset = () => { setPeriod("d7"); setTypeF("__ALL__"); setRiskF("__ALL__"); setStatusF("__ALL__"); setVesselF("__ALL__"); setTab("Toutes"); setPage(1); };
  const lvlLabel = (l: Level) => (l === "Urgente" ? t("al.tabUrg").replace(/s$/, "") : l === "Importante" ? t("al.tabImp").replace(/s$/, "") : l === "Moyenne" ? t("al.tabMid").replace(/s$/, "") : t("al.tabRes").replace(/s$/, ""));
  const srcLabel = (s: string) => (s === "agent" ? t("al.srcAgent") : s === "marin" ? t("al.srcMarin") : s === "ia" ? t("al.srcIa") : s === "meteo" ? t("al.srcMeteo") : t("al.srcSystem"));
  const dt = (d: string | Date) => new Date(d).toLocaleString(locale);

  return (
    <AppShell>
      <h1 className="mock-h1">{t("al.title")}</h1>
      <p className="mock-sub">{t("al.sub")}</p>
      <div style={{ height: 14 }} />
      <div className="mock-page" style={{ gridTemplateColumns: "minmax(0,1fr) 300px" }}>
        <div className="mock-main">
          <div className="mock-kpis">
            <button className="mock-kpi" style={{ textAlign: "left", cursor: "pointer" }} onClick={() => { setTab("Urgente"); setPage(1); }}><div className="mock-kpi-ic" style={{ background: "#ef4444" }}><AlertTriangle size={20} /></div><div><strong>{kpis.urg}</strong><small>{t("al.kUrg")}</small></div><ChevronRight size={16} style={{ marginLeft: "auto", color: "#8aa3bb" }} /></button>
            <button className="mock-kpi" style={{ textAlign: "left", cursor: "pointer" }} onClick={() => { setTab("Importante"); setPage(1); }}><div className="mock-kpi-ic" style={{ background: "#f97316" }}>!</div><div><strong>{kpis.imp}</strong><small>{t("al.kImp")}</small></div><ChevronRight size={16} style={{ marginLeft: "auto", color: "#8aa3bb" }} /></button>
            <button className="mock-kpi" style={{ textAlign: "left", cursor: "pointer" }} onClick={() => { setTab("Moyenne"); setPage(1); }}><div className="mock-kpi-ic" style={{ background: "#f59e0b" }}><Clock3 size={20} /></div><div><strong>{kpis.moy}</strong><small>{t("al.kMid")}</small></div><ChevronRight size={16} style={{ marginLeft: "auto", color: "#8aa3bb" }} /></button>
            <button className="mock-kpi" style={{ textAlign: "left", cursor: "pointer" }} onClick={() => { setTab("Résolue"); setPage(1); }}><div className="mock-kpi-ic" style={{ background: "#64748b" }}><Check size={20} /></div><div><strong>{kpis.res}</strong><small>{t("al.kRes")}</small></div><ChevronRight size={16} style={{ marginLeft: "auto", color: "#8aa3bb" }} /></button>
          </div>

          <div className="mock-card">
            <div style={{ display: "flex", gap: 8, padding: "12px 14px", flexWrap: "wrap", alignItems: "center" }}>
              {([["Toutes", t("al.tabAll"), (q.data ?? []).length], ["Urgente", t("al.tabUrg"), kpis.urg], ["Importante", t("al.tabImp"), kpis.imp], ["Moyenne", t("al.tabMid"), kpis.moy], ["Résolue", t("al.tabRes"), kpis.res]] as const).map(([key, label, n]) => {
                const on = tab === key;
                return <button key={key} onClick={() => { setTab(key as never); setPage(1); }} style={{ height: 36, padding: "0 14px", borderRadius: 9, fontSize: 12.5, fontWeight: 700, background: on ? "#0d7fdd" : "#eef5fb", color: on ? "#fff" : "#0a2a5e", display: "inline-flex", gap: 7, alignItems: "center" }}>{label} <span style={{ background: on ? "rgba(255,255,255,0.3)" : "#d9e6f2", borderRadius: 999, fontSize: 11, padding: "1px 7px" }}>{n}</span></button>;
              })}
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 12, color: "#5b7a96" }}>{t("al.sortBy")} <strong>{t("al.newest")}</strong></span>
              <ScopeSwitch value={scope} onChange={(v) => { setScope(v); setPage(1); setSelId(null); }} />
              {canManage && <button className="btn-blue" style={{ height: 38, fontSize: 12.5, padding: "0 14px" }} onClick={() => setShowCreate(true)}><Plus size={14} /> {t("al.new")}</button>}
            </div>
            <div>
              {q.isLoading ? <div style={{ padding: 12, display: "grid", gap: 10 }}>{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} style={{ height: 72, borderRadius: 10 }} />)}</div>
                : q.isError ? <ErrorState message={q.error.message} onRetry={() => q.refetch()} />
                : paged.length === 0 ? (
                  <EmptyState title={t("al.nominal")} hint={tab !== "Toutes" || typeF !== "__ALL__" ? t("c.noResultsHint") : undefined} action={canManage ? <button className="btn-blue" style={{ padding: "0 16px" }} onClick={() => setShowCreate(true)}><Plus size={14} /> {t("al.new")}</button> : undefined} />
              ) : paged.map((a) => { const v = a.vesselId ? vesselById.get(a.vesselId) : undefined; const lv = levelOf(a); return (
                <div key={a.id} onClick={() => setSelId(a.id)} style={{ display: "flex", gap: 12, alignItems: "center", padding: "12px 14px", borderTop: "1px solid #eef3f8", cursor: "pointer", background: sel?.id === a.id ? "#eaf4fc" : "#fff" }}>
                  <span style={{ width: 38, height: 38, borderRadius: "50%", display: "grid", placeItems: "center", color: "#fff", background: lv === "Urgente" ? "#ef4444" : lv === "Importante" ? "#f97316" : lv === "Moyenne" ? "#f59e0b" : "#64748b", flexShrink: 0 }}>{lv === "Résolue" ? <Check size={17} /> : lv === "Moyenne" ? <Clock3 size={17} /> : <AlertTriangle size={17} />}</span>
                  <img src="/boat-inspection.jpg" alt="" style={{ width: 62, height: 44, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}><strong style={{ fontSize: 13.5 }}>{a.title}</strong><div style={{ fontSize: 11.5, color: "#5b7a96" }}>{v ? `${v.name ?? ""} N°${v.registrationNumber}` : "-"}</div>
                    <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#0d7fdd", marginTop: 3 }}><span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}><MapPin size={11} /> {a.place}</span><span style={{ display: "inline-flex", gap: 4, alignItems: "center" }}><CalendarDays size={11} /> {dt(a.createdAt)}</span></div></div>
                  <span className={`bdg ${lv === "Urgente" ? "bdg-red" : lv === "Importante" ? "bdg-orange" : lv === "Moyenne" ? "bdg-yellow" : "bdg-blue"}`}>{lvlLabel(lv)}</span>
                  {canManage && <ArchiveButton archived={scope === "archived"} label={a.title} onConfirm={() => (scope === "archived" ? restoreMut.mutateAsync({ id: a.id }) : archiveMut.mutateAsync({ id: a.id }))} />}
                  <ChevronRight size={16} color="#0d7fdd" />
                </div>); })}
            </div>
            <div className="mock-pager"><small>{t("al.showing", { a: paged.length ? (safe - 1) * PAGE + 1 : 0, b: (safe - 1) * PAGE + paged.length, n: rows.length })}</small>
              <div className="pg-btns"><button disabled={safe <= 1} onClick={() => setPage(safe - 1)}>←</button><button className="on">{safe}</button><button disabled={safe >= totalPages} onClick={() => setPage(safe + 1)}>→</button></div>
            </div>
          </div>
        </div>

        <div className="mock-side">
          <div className="mock-filters">
            <h3><Filter size={15} /> {t("c.filters")} <button onClick={reset}><RotateCcw size={12} /> {t("c.reset")}</button></h3>
            <label><span className="t"><CalendarDays size={14} /> {t("insp.period")}</span><select value={period} onChange={(e) => { setPeriod(e.target.value); setPage(1); }}><option value="d7">{t("insp.last7")}</option><option value="d30">{t("insp.last30")}</option><option value="all">{t("insp.everything")}</option></select></label>
            <label><span className="t"><ShieldCheck size={14} /> {t("al.fType")}</span><select value={typeF} onChange={(e) => { setTypeF(e.target.value); setPage(1); }}><option value="__ALL__">{t("c.all")}</option><option value="agent">{t("al.srcAgent")}</option><option value="marin">{t("al.srcMarin")}</option><option value="ia">{t("al.srcIa")}</option><option value="meteo">{t("al.srcMeteo")}</option><option value="systeme">{t("al.srcSystem")}</option></select></label>
            <label><span className="t"><AlertTriangle size={14} /> {t("al.fRisk")}</span><select value={riskF} onChange={(e) => { setRiskF(e.target.value as never); setPage(1); }}><option value="__ALL__">{t("c.all")}</option><option value="Urgente">{t("al.tabUrg")}</option><option value="Importante">{t("al.tabImp")}</option><option value="Moyenne">{t("al.tabMid")}</option><option value="Résolue">{t("al.tabRes")}</option></select></label>
            <label><span className="t"><Check size={14} /> {t("al.fStatus")}</span><select value={statusF} onChange={(e) => { setStatusF(e.target.value); setPage(1); }}><option value="__ALL__">{t("c.all")}</option><option value="nouvelle">nouvelle</option><option value="en_cours">en_cours</option><option value="affectee">affectee</option><option value="resolue">resolue</option></select></label>
            <label><span className="t"><Bell size={14} /> {t("al.fVessel")}</span><select value={vesselF} onChange={(e) => { setVesselF(e.target.value); setPage(1); }}><option value="__ALL__">{t("c.all")}</option>{(vesselsQ.data ?? []).map((v) => <option key={v.id} value={String(v.id)}>{v.registrationNumber}</option>)}</select></label>
          </div>

          <div className="mock-detail">
            <h3><AlertTriangle size={15} color="#dc2626" /> {t("al.quickView")}</h3>
            {!sel ? <div style={{ fontSize: 13, color: "#7b93a8" }}>{t("al.select")}</div> : (() => { const v = sel.vesselId ? vesselById.get(sel.vesselId) : undefined; const lv = levelOf(sel); return (
              <><div style={{ display: "flex", gap: 10 }}><img src="/boat-inspection.jpg" alt="" style={{ width: 84, height: 64, objectFit: "cover", borderRadius: 10 }} /><div><strong style={{ fontSize: 13, color: lv === "Urgente" ? "#b91c1c" : "#0a2a5e" }}>{sel.title}</strong><div style={{ fontSize: 11, color: "#7b93a8" }}>{v ? `${v.name ?? ""} N°${v.registrationNumber}` : "-"}</div><span className={`bdg ${lv === "Urgente" ? "bdg-red" : lv === "Importante" ? "bdg-orange" : "bdg-yellow"}`} style={{ marginTop: 4 }}>{lvlLabel(lv)}</span></div></div>
                <div style={{ fontSize: 12, color: "#5b7a96" }}>{srcLabel(sel.source)} · {sel.place}</div>
                <div style={{ fontSize: 12, color: "#5b7a96" }}>{sel.description || ""}</div>
                <div style={{ fontSize: 11.5, color: "#7b93a8" }}>{dt(sel.createdAt)}</div>
                {canManage && sel.status !== "resolue" && <button className="btn-blue" disabled={update.isPending} onClick={() => update.mutate({ id: sel.id, patch: { status: sel.status === "nouvelle" ? "en_cours" : "resolue" } })}>{sel.status === "nouvelle" ? t("al.take") : t("al.resolve")} →</button>}
                <button className="btn-outline-blue" onClick={() => navigate("/inspections/new")}>{t("al.seeDetail")} →</button></>); })()}
          </div>

          <div className="mock-detail"><h3>⚡ {t("al.qa")}</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button className="btn-outline-blue" style={{ fontSize: 11.5 }} onClick={() => navigate("/inspections/new")}><Plus size={14} /> {t("al.qaInsp")}</button>
              <button className="btn-outline-blue" style={{ fontSize: 11.5 }} onClick={() => navigate("/rapports")}><FileText size={14} /> {t("al.qaReport")}</button>
              <button className="btn-outline-blue" style={{ fontSize: 11.5 }} onClick={() => setPage(1)}><Bell size={14} /> {t("al.qaCenter")}</button>
              <button className="btn-outline-blue" style={{ fontSize: 11.5 }} onClick={() => toast.success("OK")}><Download size={14} /> {t("c.export")}</button>
            </div>
          </div>
        </div>
      </div>

      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}><div className="modal-card" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header"><h2 style={{ margin: 0 }}>{t("al.newTitle")}</h2><button className="modal-close" onClick={() => setShowCreate(false)}>×</button></div>
          <div className="modal-body" style={{ display: "grid", gap: 10 }}>
            <label className="field"><span>{t("al.fTitle")} *</span><input className="input" value={fTitle} onChange={(e) => setFTitle(e.target.value)} placeholder={t("al.fTitlePh")} /></label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label className="field"><span>{t("al.fPlace")} *</span><input className="input" value={fPlace} onChange={(e) => setFPlace(e.target.value)} /></label>
              <label className="field"><span>{t("al.fUrg")}</span><select className="input" value={fUrg} onChange={(e) => setFUrg(e.target.value as never)}><option value="information">information</option><option value="elevee">elevee</option><option value="urgent">urgent</option><option value="detresse">detresse</option></select></label>
            </div>
            <label className="field"><span>{t("al.fDesc")}</span><textarea className="input" style={{ height: 80, padding: 10 }} value={fDesc} onChange={(e) => setFDesc(e.target.value)} placeholder={t("al.fDescPh")} /></label>
          </div>
          <div className="modal-footer"><button className="btn btn-secondary" onClick={() => setShowCreate(false)}>{t("c.cancel")}</button><button className="btn btn-primary" disabled={!fTitle.trim() || create.isPending} onClick={() => create.mutate({ title: fTitle.trim(), place: fPlace.trim(), description: fDesc, urgency: fUrg })}>{t("al.save")}</button></div>
        </div></div>
      )}
    </AppShell>
  );
}

export function ReportsPage() {
  const [, navigate] = useLocation();
  useMemo(() => { navigate("/rapports"); }, []);
  return <AppShell><div style={{ padding: "3rem", textAlign: "center", color: "#7b93a8" }}>…</div></AppShell>;
}
export function VesselsPage() {
  const [, navigate] = useLocation();
  useMemo(() => { navigate("/embarcations"); }, []);
  return <AppShell><div style={{ padding: "3rem", textAlign: "center", color: "#7b93a8" }}>…</div></AppShell>;
}

export function AuditPage() {
  const { t, locale } = useLang();
  const me = trpc.auth.me.useQuery(undefined, { retry: false });
  const isAllowed = me.data?.appRole === "admin" || me.data?.appRole === "supervisor";
  const [filter, setFilter] = useState("");
  const [actionF, setActionF] = useState("__ALL__");
  const [selected, setSelected] = useState<number | null>(null);
  const q = trpc.data.audit.list.useQuery({ limit: 500 }, { enabled: isAllowed, refetchInterval: 20000 });
  const detailQ = trpc.data.audit.get.useQuery({ id: selected ?? 0 }, { enabled: isAllowed && selected !== null });
  const logAccess = trpc.data.audit.logAccess.useMutation();
  useEffect(() => { if (isAllowed) logAccess.mutate(); }, [isAllowed]);
  const all = q.data ?? [];
  const actions = useMemo(() => [...new Set(all.map((i) => i.action))].sort(), [all]);
  const rows = useMemo(() => all.filter((i) => {
    if (actionF !== "__ALL__" && i.action !== actionF) return false;
    const hay = `${i.action} ${i.entityType} ${i.entityId ?? ""} ${i.entityLabel ?? ""} ${i.userName ?? ""} ${i.userEmail ?? ""}`.toLowerCase();
    return hay.includes(filter.toLowerCase());
  }), [all, actionF, filter]);
  const pretty = (raw?: string | null) => { if (!raw) return ""; try { return JSON.stringify(JSON.parse(raw), null, 2); } catch { return raw; } };
  if (me.isLoading) return <AppShell><div style={{ padding: 16, display: "grid", gap: 10 }}><Skeleton style={{ height: 28, width: 220 }} /><TableSkeleton rows={6} cols={3} /></div></AppShell>;
  if (!isAllowed) return <AppShell><EmptyState title={t("c.forbidden")} hint={t("au.forbiddenHint") ?? "Audit is restricted to supervisors and administrators."} /></AppShell>;
  return (
    <AppShell>
      <h1 className="mock-h1">{t("au.title")}</h1><p className="mock-sub">{t("au.sub", { n: rows.length })}</p><div style={{ height: 14 }} />
      <div className="mock-card"><div className="mock-card-b" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 280px" }}><Search size={16} style={{ position: "absolute", left: 12, top: 13, color: "#7b93a8" }} /><input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={t("au.searchPh")} style={{ width: "100%", height: 44, border: "1.5px solid #d9e6f2", borderRadius: 10, padding: "0 12px 0 36px", fontSize: 13 }} /></div>
        <select value={actionF} onChange={(e) => setActionF(e.target.value)} style={{ height: 44, border: "1.5px solid #d9e6f2", borderRadius: 10, padding: "0 12px", fontSize: 13, fontWeight: 700, color: "#0a2a5e" }}><option value="__ALL__">{t("c.all")}</option>{actions.map((a) => <option key={a} value={a}>{a}</option>)}</select>
      </div>
      <div style={{ padding: "0 18px 18px" }}>{q.isLoading ? <TableSkeleton rows={6} cols={3} />
        : q.isError ? <ErrorState message={q.error.message} onRetry={() => q.refetch()} />
        : rows.length === 0 ? <EmptyState title={t("au.empty")} hint={filter ? t("c.noResultsHint") : undefined} />
        : rows.map((it) => (
        <button key={it.id} type="button" onClick={() => setSelected(it.id)} className="audit-row">
          <span className="audit-ic"><History size={15} /></span>
          <span style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
            <span style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}><strong style={{ fontSize: 13 }}>{it.action}</strong><small style={{ fontSize: 11, color: "#7b93a8" }}>{new Date(it.createdAt).toLocaleString(locale)}</small></span>
            <span style={{ display: "block", fontSize: 12, color: "#7b93a8" }}>{it.entityLabel ?? `${it.entityType}${it.entityId ? ` #${it.entityId}` : ""}`} · {it.userName ?? `${t("au.user")} #${it.userId ?? "-"}`}</span>
          </span>
          <ChevronRight size={16} color="#7b93a8" />
        </button>))}</div>
      </div>

      {selected !== null && (
        <div className="ng-modal-back" onClick={() => setSelected(null)}>
          <div className="ng-modal wide" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div><h3 style={{ margin: 0 }}>{t("au.details")}</h3><p style={{ margin: "4px 0 0" }}>{detailQ.data ? new Date(detailQ.data.createdAt).toLocaleString(locale) : "…"}</p></div>
              <button className="icon-sq" onClick={() => setSelected(null)} aria-label={t("c.close")}><X size={15} /></button>
            </div>
            {detailQ.isLoading ? <TableSkeleton rows={3} cols={2} /> : detailQ.isError ? <ErrorState message={detailQ.error.message} onRetry={() => detailQ.refetch()} /> : detailQ.data ? (
              <div style={{ display: "grid", gap: 8, marginTop: 14, fontSize: 12.5 }}>
                <div className="audit-kv"><span>{t("au.action")}</span><strong>{detailQ.data.action}</strong></div>
                <div className="audit-kv"><span>{t("au.entity")}</span><strong>{detailQ.data.entityType}{detailQ.data.entityId ? ` #${detailQ.data.entityId}` : ""}</strong></div>
                {detailQ.data.entityLabel ? <div className="audit-kv"><span>{t("au.label")}</span><strong>{detailQ.data.entityLabel}</strong></div> : null}
                <div className="audit-kv"><span>{t("au.user")}</span><strong>{detailQ.data.userName ?? `#${detailQ.data.userId ?? "-"}`}{detailQ.data.userEmail ? ` · ${detailQ.data.userEmail}` : ""}{detailQ.data.userRole ? ` (${detailQ.data.userRole})` : ""}</strong></div>
                <div className="audit-kv"><span>{t("au.ip")}</span><strong>{detailQ.data.ip ?? "-"}</strong></div>
                <div className="audit-kv"><span>{t("au.agent")}</span><strong style={{ overflowWrap: "anywhere" }}>{detailQ.data.userAgent ?? "-"}</strong></div>
                <div><span style={{ fontSize: 11, fontWeight: 800, color: "#7b93a8", textTransform: "uppercase", letterSpacing: 0.4 }}>{t("au.metadata")}</span>
                  <pre className="audit-json">{pretty(detailQ.data.metadata) || "-"}</pre>
                  {detailQ.data.metadata ? <button className="ng-modal-ghost" style={{ marginTop: 8 }} onClick={() => { navigator.clipboard?.writeText(pretty(detailQ.data!.metadata)); toast.success(t("c.copied")); }}><Copy size={13} /> {t("c.copy")}</button> : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </AppShell>
  );
}

export function UsersPage() {
  const { t, locale } = useLang();
  const utils = trpc.useUtils();
  const me = trpc.auth.me.useQuery(undefined, { retry: false });
  const isAdmin = me.data?.appRole === "admin";
  const [scope, setScope] = useState<ArchiveScope>("active");
  const listQ = trpc.localAuth.users.list.useQuery({ scope }, { enabled: isAdmin, retry: false });
  const createM = trpc.localAuth.users.create.useMutation({ onSuccess: async () => { await utils.localAuth.users.list.invalidate(); setShow(false); toast.success(t("us.created")); }, onError: (e) => toast.error(e.message) });
  const roleM = trpc.localAuth.users.changeRole.useMutation({ onSuccess: async () => { await utils.localAuth.users.list.invalidate(); toast.success(t("us.roleSaved")); }, onError: (e) => toast.error(e.message) });
  const activeM = trpc.localAuth.users.setActive.useMutation({ onSuccess: async () => { await utils.localAuth.users.list.invalidate(); toast.success(t("us.statusSaved")); }, onError: (e) => toast.error(e.message) });
  const archiveM = trpc.localAuth.users.archive.useMutation({ onSuccess: async () => { await utils.localAuth.users.list.invalidate(); toast.success(t("c.archive")); }, onError: (e) => toast.error(e.message) });
  const restoreM = trpc.localAuth.users.restore.useMutation({ onSuccess: async () => { await utils.localAuth.users.list.invalidate(); toast.success(t("c.restore")); }, onError: (e) => toast.error(e.message) });
  const [q, setQ] = useState(""); const [roleF, setRoleF] = useState("__ALL__"); const [statusF, setStatusF] = useState("__ALL__");
  const [page, setPage] = useState(1); const [show, setShow] = useState(false);
  const [n, setN] = useState(""); const [e, setE] = useState(""); const [p, setP] = useState(""); const [r, setR] = useState<"agent" | "supervisor" | "admin" | "observer">("agent");
  const PAGE = 6;

  const rows = useMemo(() => (listQ.data ?? []).filter((u) =>
    (!q || `${u.name ?? ""} ${u.email ?? ""} ${u.appRole}`.toLowerCase().includes(q.toLowerCase())) &&
    (roleF === "__ALL__" || u.appRole === roleF) &&
    (statusF === "__ALL__" || (statusF === "on" ? u.isActive : !u.isActive))
  ), [listQ.data, q, roleF, statusF]);
  const kpis = useMemo(() => { const d = listQ.data ?? []; return { total: d.length, admin: d.filter((u) => u.appRole === "admin").length, sup: d.filter((u) => u.appRole === "supervisor").length, agent: d.filter((u) => u.appRole === "agent").length, obs: d.filter((u) => u.appRole === "observer").length }; }, [listQ.data]);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE));
  const safe = Math.min(page, totalPages);
  const paged = rows.slice((safe - 1) * PAGE, safe * PAGE);
  const roleBadge = (role: string) => role === "admin" ? <span className="bdg bdg-blue">👑 {t("us.rAdmin")}</span> : role === "supervisor" ? <span className="bdg bdg-purple">🛡 {t("us.rSup")}</span> : role === "agent" ? <span className="bdg bdg-green">🛠 {t("us.rAgentFull")}</span> : <span className="bdg bdg-cyan">👁 {t("us.rObs")}</span>;
  const roleShort = (role: string) => role === "admin" ? t("us.rAdmin") : role === "supervisor" ? t("us.rSup") : role === "agent" ? t("us.rAgent") : t("us.rObs");

  if (me.isLoading) return <AppShell><div style={{ padding: 16, display: "grid", gap: 10 }}><Skeleton style={{ height: 28, width: 220 }} /><div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10 }}>{Array.from({ length: 5 }).map((_, i) => <KpiSkeleton key={i} />)}</div><TableSkeleton rows={6} cols={6} /></div></AppShell>;
  if (!isAdmin) return <AppShell><EmptyState title={t("c.forbidden")} hint={t("us.forbiddenHint") ?? "User management is restricted to administrators."} /></AppShell>;
  return (
    <AppShell>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div><h1 className="mock-h1"><Users size={26} color="#0d7fdd" style={{ verticalAlign: "-4px", marginRight: 8 }} />{t("us.title")}</h1><p className="mock-sub">{t("us.sub")}</p></div>
        <button className="btn-blue" style={{ padding: "0 18px" }} onClick={() => setShow(true)}><Plus size={16} /> {t("us.add")}</button>
      </div>
      <div style={{ height: 14 }} />

      {listQ.isLoading ? <div className="mock-kpis" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>{Array.from({ length: 5 }).map((_, i) => <KpiSkeleton key={i} />)}</div> : (
      <div className="mock-kpis" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
        <div className="mock-kpi"><div className="mock-kpi-ic" style={{ background: "#2563eb" }}><Users size={20} /></div><div><small>{t("us.kTotal")}</small><strong>{kpis.total}</strong></div></div>
        <div className="mock-kpi"><div className="mock-kpi-ic" style={{ background: "#7c3aed" }}><ShieldCheck size={20} /></div><div><small>{t("us.kAdmin")}</small><strong>{kpis.admin}</strong></div></div>
        <div className="mock-kpi"><div className="mock-kpi-ic" style={{ background: "#0d9488" }}><CheckCheck size={20} /></div><div><small>{t("us.kSup")}</small><strong>{kpis.sup}</strong></div></div>
        <div className="mock-kpi"><div className="mock-kpi-ic" style={{ background: "#f59e0b" }}><Bell size={20} /></div><div><small>{t("us.kAgent")}</small><strong>{kpis.agent}</strong></div></div>
        <div className="mock-kpi"><div className="mock-kpi-ic" style={{ background: "#0ea5e9" }}><Eye size={20} /></div><div><small>{t("us.kObs")}</small><strong>{kpis.obs}</strong></div></div>
      </div>)}
      <div style={{ height: 12 }} />

      <div className="mock-card" style={{ marginBottom: 12 }}><div className="mock-card-b" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "1 1 260px" }}><Search size={16} style={{ position: "absolute", left: 12, top: 13, color: "#7b93a8" }} /><input value={q} onChange={(ev) => { setQ(ev.target.value); setPage(1); }} placeholder={t("us.searchPh")} style={{ width: "100%", height: 44, border: "1.5px solid #d9e6f2", borderRadius: 10, padding: "0 12px 0 36px", fontSize: 13 }} /></div>
        <select value={roleF} onChange={(ev) => { setRoleF(ev.target.value); setPage(1); }} style={{ height: 44, border: "1.5px solid #d9e6f2", borderRadius: 10, fontSize: 13, padding: "0 12px" }}><option value="__ALL__">{t("us.allRoles")}</option><option value="admin">{t("us.rAdmin")}</option><option value="supervisor">{t("us.rSup")}</option><option value="agent">{t("us.rAgent")}</option><option value="observer">{t("us.rObs")}</option></select>
        <select value={statusF} onChange={(ev) => { setStatusF(ev.target.value); setPage(1); }} style={{ height: 44, border: "1.5px solid #d9e6f2", borderRadius: 10, fontSize: 13, padding: "0 12px" }}><option value="__ALL__">{t("us.allStatus")}</option><option value="on">{t("c.active")}</option><option value="off">{t("c.inactive")}</option></select>
        <button className="btn-outline-blue" style={{ width: "auto", padding: "0 18px" }} onClick={() => toast.success("OK")}><Download size={15} /> {t("c.export")}</button>
        <ScopeSwitch value={scope} onChange={(v) => { setScope(v); setPage(1); }} />
      </div></div>

      <div className="mock-card">
        <div style={{ overflowX: "auto", padding: 12 }}>
          {listQ.isLoading ? <TableSkeleton rows={6} cols={6} />
            : listQ.isError ? <ErrorState message={listQ.error.message} onRetry={() => listQ.refetch()} />
            : paged.length === 0 ? <EmptyState title={t("us.empty")} hint={q ? t("c.noResultsHint") : undefined} action={<button className="btn-blue" style={{ padding: "0 16px" }} onClick={() => setShow(true)}><Plus size={14} /> {t("us.add")}</button>} /> : (
          <table className="mock-table"><thead><tr><th>{t("us.colUser")}</th><th>{t("us.colEmail")}</th><th>{t("us.colRole")}</th><th>{t("us.colStatus")}</th><th>{t("us.colLast")}</th><th>{t("c.actions")}</th></tr></thead><tbody>
            {paged.map((u) => (
              <tr key={u.id}>
                <td><div style={{ display: "flex", gap: 10, alignItems: "center" }}><span style={{ width: 36, height: 36, borderRadius: "50%", background: "#0a2a5e", color: "#fff", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 12 }}>{((u.name ?? "NG").split(" ").map((x) => x[0]).join("")).slice(0, 2).toUpperCase()}</span><div><strong style={{ fontSize: 13 }}>{u.name ?? "User"}</strong><div style={{ fontSize: 11, color: "#7b93a8" }}>{u.appRole === "admin" ? t("us.mainAdmin") : roleShort(u.appRole)}</div></div></div></td>
                <td style={{ fontSize: 12.5 }}>{u.email ?? "-"}</td>
                <td>{roleBadge(u.appRole)}<div style={{ marginTop: 6 }}><select value={u.appRole} onChange={(ev) => roleM.mutate({ id: u.id, appRole: ev.target.value as never })} style={{ fontSize: 11.5, border: "1px solid #d9e6f2", borderRadius: 7, padding: "3px 6px" }}><option value="agent">{t("us.rAgent")}</option><option value="supervisor">{t("us.rSup")}</option><option value="admin">{t("us.rAdmin")}</option><option value="observer">{t("us.rObs")}</option></select></div></td>
                <td>{u.isActive ? <span className="bdg bdg-green"><Check size={11} /> {t("c.active")}</span> : <span className="bdg bdg-red"><X size={11} /> {t("c.inactive")}</span>}</td>
                <td style={{ fontSize: 12 }}><CalendarDays size={12} color="#0d7fdd" /> {u.lastSignedIn ? new Date(u.lastSignedIn).toLocaleString(locale) : "-"}</td>
                <td><div className="mock-actions"><button className="icon-sq" title={t("us.view")}><Eye size={14} /></button><button className="icon-sq" title={u.isActive ? t("us.suspend") : t("us.reactivate")} onClick={() => activeM.mutate({ id: u.id, isActive: !u.isActive })}>{u.isActive ? <EyeOff size={14} /> : <Pencil size={14} />}</button><button className="icon-sq danger" title={t("us.suspend")} onClick={() => { if (confirm(`${t("us.suspend")} ${u.email} ?`)) activeM.mutate({ id: u.id, isActive: false }); }}><Trash2 size={14} /></button><ArchiveButton archived={scope === "archived"} label={`${u.name ?? ""} · ${u.email ?? ""}`} disabled={u.id === me.data?.id} onConfirm={() => (scope === "archived" ? restoreM.mutateAsync({ id: u.id }) : archiveM.mutateAsync({ id: u.id }))} /></div></td>
              </tr>
            ))}
          </tbody></table>)}
        </div>
        <div className="mock-pager"><small>{t("us.showing", { a: paged.length ? (safe - 1) * PAGE + 1 : 0, b: (safe - 1) * PAGE + paged.length, n: rows.length })}</small>
          <div className="pg-btns"><button disabled={safe <= 1} onClick={() => setPage(safe - 1)}>←</button>{Array.from({ length: totalPages }).slice(0, 4).map((_, i) => <button key={i} className={safe === i + 1 ? "on" : ""} onClick={() => setPage(i + 1)}>{i + 1}</button>)}<button disabled={safe >= totalPages} onClick={() => setPage(safe + 1)}>→</button></div>
        </div>
      </div>

      {show && (
        <div className="modal-overlay" onClick={() => setShow(false)}><div className="modal-card" onClick={(ev) => ev.stopPropagation()}>
          <div className="modal-header"><h2 style={{ margin: 0 }}>{t("us.createTitle")}</h2><button className="modal-close" onClick={() => setShow(false)}>×</button></div>
          <div className="modal-body" style={{ display: "grid", gap: 10 }}>
            <label className="field"><span>{t("us.fName")} *</span><input className="input" value={n} onChange={(ev) => setN(ev.target.value)} /></label>
            <label className="field"><span>{t("us.fEmail")} *</span><input className="input" type="email" value={e} onChange={(ev) => setE(ev.target.value)} /></label>
            <label className="field"><span>{t("us.fPass")} *</span><input className="input" type="password" value={p} onChange={(ev) => setP(ev.target.value)} /></label>
            <label className="field"><span>{t("us.fRole")}</span><select className="input" value={r} onChange={(ev) => setR(ev.target.value as never)}><option value="agent">{t("us.rAgentFull")}</option><option value="supervisor">{t("us.rSup")}</option><option value="admin">{t("us.rAdmin")}</option><option value="observer">{t("us.rObs")}</option></select></label>
          </div>
          <div className="modal-footer"><button className="btn btn-secondary" onClick={() => setShow(false)}>{t("c.cancel")}</button><button className="btn btn-primary" disabled={!n.trim() || !e.trim() || p.length < 12 || createM.isPending} onClick={() => createM.mutate({ name: n.trim(), email: e.trim(), password: p, appRole: r })}>{t("c.save")}</button></div>
        </div></div>
      )}
    </AppShell>
  );
}

export function MarinAlertPage() {
  const { t } = useLang();
  const [sent, setSent] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [recording, setRecording] = useState(false);
  const [title, setTitle] = useState(""); const [place, setPlace] = useState("Cotonou"); const [description, setDescription] = useState(""); const [phone, setPhone] = useState("");
  const [voice, setVoice] = useState<{ transcript: string; urgency: string; people: number | null; place: string | null; need: string; recommendation: string } | null>(null);
  const createPublic = trpc.data.alerts.createPublic.useMutation();
  const voiceMutation = trpc.ai.analyzeVoiceAlert.useMutation();
  const startRecording = async () => {
    setError(""); setVoice(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ["audio/ogg;codecs=opus", "audio/webm;codecs=opus", "audio/webm"].find((x) => { try { return MediaRecorder.isTypeSupported(x); } catch { return false; } });
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks: Blob[] = [];
      rec.ondataavailable = (ev) => { if (ev.data.size) chunks.push(ev.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((x) => x.stop()); setRecording(false); setProcessing(true);
        try {
          const blob = new Blob(chunks, { type: rec.mimeType });
          const dataUrl: string = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(blob); });
          const result = await voiceMutation.mutateAsync({ audioDataUrl: dataUrl });
          setVoice(result); if (!title) setTitle(result.transcript.slice(0, 120) || "Mariner alert"); if (result.place) setPlace(result.place); if (!description) setDescription(result.transcript);
        } catch { setError("Voice NA"); }
        finally { setProcessing(false); }
      };
      (window as never as { __marinRec?: MediaRecorder }).__marinRec = rec;
      rec.start(); setRecording(true);
      setTimeout(() => { try { rec.state !== "inactive" && rec.stop(); } catch {} }, 60000);
    } catch { setError("Mic NA"); }
  };
  const stopRecording = () => { try { (window as never as { __marinRec?: MediaRecorder }).__marinRec?.stop(); } catch {} setRecording(false); };
  const submit = async () => {
    setError("");
    if (!title.trim() || !place.trim()) { setError("Title/zone"); return; }
    try { await createPublic.mutateAsync({ title: title.trim(), description: description || voice?.transcript || "Mariner report", place: place.trim(), urgency: voice?.urgency === "détresse" ? "detresse" : "urgent", contactPhone: phone || undefined }); setSent(true); }
    catch (err) { setError(err instanceof Error ? err.message : "Send failed"); }
  };
  return (
    <div className="marin-page">
      <div className="marin-brand"><Anchor size={30} /><strong>NaviGarde IA</strong><span>{t("ma.brand")}</span></div>
      <div className="marin-card">{sent ? (<><div className="success-orb"><CheckCheck size={38} /></div><h1>{t("ma.sent")}</h1><p>{t("ma.sentSub")}</p><button className="btn btn-primary" onClick={() => { setSent(false); setVoice(null); setTitle(""); setDescription(""); }}>{t("ma.new")}</button></>)
      : (<><span className="eyebrow">{t("ma.kicker")}</span><h1>{t("ma.title")}</h1><p>{t("ma.sub")}</p>
        <button className={`mic-button ${recording ? "recording" : ""}`} disabled={processing} onClick={recording ? stopRecording : startRecording}><Mic size={42} /></button>
        <strong className="mic-label" style={{ display: "block", marginTop: "0.5rem" }}>{processing ? t("ma.analyzing") : recording ? t("ma.tapStop") : t("ma.tapTalk")}</strong>
        {error && <div className="ai-error" style={{ marginTop: "1rem" }}>{error}</div>}
        {voice && <div className="voice-result"><div><strong>{t("ma.transcript")}</strong><p>"{voice.transcript}"</p></div><div className="voice-tags"><span>{voice.urgency}</span><span>{voice.people ?? "?"} 👥</span><span>{voice.need}</span></div><small>{voice.recommendation}</small></div>}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.7rem", marginTop: "1.25rem", textAlign: "left" }}>
          <label className="field"><span>{t("ma.titleF")} *</span><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.7rem" }}>
            <label className="field"><span>{t("ma.zone")} *</span><input className="input" value={place} onChange={(e) => setPlace(e.target.value)} /></label>
            <label className="field"><span>{t("ma.phone")}</span><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
          </div>
          <label className="field"><span>{t("ma.desc")}</span><textarea className="input" style={{ height: 80, padding: "0.75rem" }} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
        </div>
        <button className="btn btn-primary" style={{ width: "100%", marginTop: "1.25rem" }} disabled={createPublic.isPending} onClick={submit}><Send size={17} /> {createPublic.isPending ? t("ma.sending") : t("ma.send")}</button></>)}
      </div>
      <small className="marin-footer">SOS · VHF 16</small>
    </div>
  );
}
