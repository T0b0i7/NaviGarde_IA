import { useState } from "react";
import { AlertTriangle, Anchor, ArrowLeft, Ban, CalendarDays, Copy, Download, Eye, Info, MapPin, Pencil, Printer, Share2, Ship, Users, Wrench } from "lucide-react";
import { Link, useLocation, useRoute } from "wouter";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import { useLang } from "@/i18n/LanguageContext";
import { EmptyState, ErrorState, Skeleton, TableSkeleton } from "@/components/DashboardStates";
import { ArchiveButton } from "@/components/ArchiveButton";

export default function VesselDetail() {
  const { t, locale } = useLang();
  const [, params] = useRoute("/embarcations/:id");
  const [, navigate] = useLocation();
  const id = Number(params?.id ?? 0);
  const [tab, setTab] = useState("infos");
  const q = trpc.data.vessels.get.useQuery({ id }, { enabled: id > 0 });
  const utils = trpc.useUtils();
  const updateMut = trpc.data.vessels.update.useMutation({ onSuccess: () => { utils.data.vessels.get.invalidate({ id }); toast.success(t("vsd.updated")); }, onError: (e) => toast.error(e.message) });
  const archiveMut = trpc.data.vessels.remove.useMutation({
    onSuccess: () => { utils.data.vessels.list.invalidate(); toast.success(t("c.archive")); navigate("/embarcations"); },
    onError: (e) => toast.error(e.message),
  });
  const restoreMut = trpc.data.vessels.restore.useMutation({
    onSuccess: () => { utils.data.vessels.list.invalidate(); utils.data.vessels.get.invalidate({ id }); toast.success(t("c.restore")); },
    onError: (e) => toast.error(e.message),
  });

  const v = q.data?.vessel;
  const inspections = q.data?.inspections ?? [];
  const alerts = q.data?.alerts ?? [];
  const openAlerts = alerts.filter((a) => a.status !== "resolue" && a.status !== "cloturee");

  const me = trpc.auth.me.useQuery(undefined, { retry: false });
  const canEdit = me.data?.appRole === "admin" || me.data?.appRole === "supervisor";
  if (q.isLoading) return <AppShell><div style={{ padding: 16, display: "grid", gap: 12 }}><Skeleton style={{ height: 28, width: 200 }} /><Skeleton style={{ height: 260, borderRadius: 12 }} /><TableSkeleton rows={4} cols={5} /></div></AppShell>;
  if (q.isError) return <AppShell><ErrorState message={q.error.message} onRetry={() => q.refetch()} /></AppShell>;
  if (!v) return <AppShell><EmptyState title={t("vsd.notFound")} action={<Link href="/embarcations" className="btn-blue" style={{ padding: "0 18px", textDecoration: "none" }}>{t("c.back")}</Link>} /></AppShell>;

  const score = 100 - v.riskScore;
  const rc = v.riskScore >= 75 ? "high" : v.riskScore >= 40 ? "med" : "low";
  const riskLabel = rc === "high" ? t("risk.high") : rc === "med" ? t("risk.medium") : t("risk.low");
  const active = v.status !== "immobilisee";
  const last = inspections[0];
  const needleDeg = -90 + Math.min(100, Math.max(0, v.riskScore)) * 1.8;
  const dl = (d: string | Date) => new Date(d).toLocaleDateString(locale);

  return (
    <AppShell>
      <Link href="/embarcations" className="mock-back"><ArrowLeft size={14} /> {t("vsd.back")}</Link>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div><h1 className="mock-h1">{t("vsd.title")}</h1><p className="mock-sub">{t("vsd.sub")}</p></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn-outline-blue" style={{ width: "auto", padding: "0 16px" }} onClick={() => window.print()}><Printer size={15} /> {t("vsd.print")}</button>
          <button className="btn-outline-blue" style={{ width: "auto", padding: "0 16px" }} onClick={() => last && navigate(`/inspections/${last.id}`)}><Download size={15} /> {t("vsd.dl")}</button>
          <button className="btn-outline-blue" style={{ width: "auto", padding: "0 16px" }} onClick={async () => { try { await navigator.clipboard.writeText(window.location.href); toast.success(t("vsd.linkCopied")); } catch {} }}><Share2 size={15} /> {t("vsd.share")}</button>
          {canEdit && <ArchiveButton variant="text" archived={Boolean(v.archivedAt)} label={`${v.registrationNumber} - ${v.name ?? ""}`} onConfirm={() => (v.archivedAt ? restoreMut.mutateAsync({ id: v.id }) : archiveMut.mutateAsync({ id: v.id }))} />}
        </div>
      </div>
      <div style={{ height: 14 }} />

      <div className="mock-page" style={{ gridTemplateColumns: "minmax(0,1fr) 300px" }}>
        <div className="mock-main">
          <div className="mock-card"><div className="mock-card-b" style={{ display: "grid", gridTemplateColumns: "250px 1fr 170px 170px", gap: 16 }}>
            <div style={{ position: "relative" }}>
              <img src="/boat-inspection.jpg" alt="" style={{ width: "100%", height: 215, objectFit: "cover", borderRadius: 12 }} />
              <span className={`bdg ${active ? "bdg-green" : "bdg-gray"}`} style={{ position: "absolute", top: 8, left: 8 }}>{active ? t("c.active") : t("c.inactive")}</span>
              <span style={{ position: "absolute", bottom: 8, left: 8, background: "rgba(2,20,40,0.75)", color: "#fff", fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 8 }}>+ ({inspections.length})</span>
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 24, color: "var(--ng-ink)" }}>{v.name ?? "-"}</h2>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}><strong style={{ color: "var(--ng-link)", fontSize: 17 }}>N°{v.registrationNumber}</strong><button className="icon-sq" style={{ width: 26, height: 26 }} onClick={async () => { try { await navigator.clipboard.writeText(v.registrationNumber); toast.success(t("vsd.regCopied")); } catch {} }}><Copy size={13} /></button></div>
              <div style={{ marginTop: 12, display: "grid", gap: 7, fontSize: 13 }}>
                <div style={{ display: "flex", gap: 8 }}><Anchor size={15} color="var(--ng-link)" /><span style={{ color: "var(--ng-soft)", width: 110 }}>{t("vsd.type")} :</span><strong>{v.type}</strong></div>
                <div style={{ display: "flex", gap: 8 }}><Ship size={15} color="var(--ng-link)" /><span style={{ color: "var(--ng-soft)", width: 110 }}>{t("vsd.length")} :</span><strong>{v.lengthMeters ? `${v.lengthMeters} m` : "-"}</strong></div>
                <div style={{ display: "flex", gap: 8 }}><Ship size={15} color="var(--ng-link)" /><span style={{ color: "var(--ng-soft)", width: 110 }}>{t("vsd.width")} :</span><strong>{v.widthMeters ? `${v.widthMeters} m` : "-"}</strong></div>
                <div style={{ display: "flex", gap: 8 }}><Users size={15} color="var(--ng-link)" /><span style={{ color: "var(--ng-soft)", width: 110 }}>{t("vsd.capacity")} :</span><strong>{v.capacity} {t("vsd.pax")}</strong></div>
                <div style={{ display: "flex", gap: 8 }}><Users size={15} color="var(--ng-link)" /><span style={{ color: "var(--ng-soft)", width: 110 }}>{t("vsd.owner")} :</span><strong>{v.ownerName}</strong></div>
                <div style={{ display: "flex", gap: 8 }}><MapPin size={15} color="var(--ng-link)" /><span style={{ color: "var(--ng-soft)", width: 110 }}>{t("vsd.port")} :</span><strong>{v.place}</strong></div>
              </div>
            </div>
            <div style={{ textAlign: "center", borderLeft: "1px solid var(--ng-line-soft)", paddingLeft: 12 }}>
              <strong style={{ fontSize: 13 }}>{t("vsd.riskLvl")}</strong>
              <div className="gauge-semi" style={{ marginTop: 10 }}><div className="gauge-semi-bg" /><div className="gauge-needle" style={{ transform: `translateX(-50%) rotate(${needleDeg}deg)` }} /></div>
              <div style={{ fontSize: 20, fontWeight: 800, color: rc === "low" ? "var(--ng-ok)" : rc === "med" ? "var(--ng-high)" : "var(--ng-crit-2)" }}>{riskLabel}</div>
              <div style={{ fontSize: 11, color: "var(--ng-faint)", marginTop: 6 }}>{t("vsd.lastEval")} :<br />{dl(v.updatedAt)}</div>
            </div>
            <div style={{ textAlign: "center", borderLeft: "1px solid var(--ng-line-soft)", paddingLeft: 12 }}>
              <strong style={{ fontSize: 13 }}>{t("vsd.confScore")}</strong>
              <div style={{ width: 120, height: 120, borderRadius: "50%", margin: "10px auto", background: `conic-gradient(${score >= 80 ? "var(--ng-ok)" : score >= 60 ? "var(--ng-warn)" : "var(--ng-crit)"} ${score}%, var(--ng-grid) ${score}%)`, display: "grid", placeItems: "center" }}><div style={{ width: 92, height: 92, borderRadius: "50%", background: "var(--ng-surface)", display: "grid", placeItems: "center", fontWeight: 800, fontSize: 24 }}>{score}%</div></div>
              <span className={`bdg ${score >= 80 ? "bdg-green" : "bdg-yellow"}`}>{score >= 80 ? t("vsd.veryGood") : score >= 60 ? t("vsd.watch") : t("vsd.critical")}</span>
            </div>
          </div></div>

          <div className="mock-tabs">
            <button className={tab === "infos" ? "on" : ""} onClick={() => setTab("infos")}><Info size={14} /> {t("vsd.tabInfo")}</button>
            <button className={tab === "hist" ? "on" : ""} onClick={() => setTab("hist")}><CalendarDays size={14} /> {t("vsd.tabHist")}</button>
            <button className={tab === "photos" ? "on" : ""} onClick={() => setTab("photos")}><Eye size={14} /> {t("vsd.tabPhotos")}</button>
            <button className={tab === "maint" ? "on" : ""} onClick={() => setTab("maint")}><Wrench size={14} /> {t("vsd.tabMaint")}</button>
            <button className={tab === "loc" ? "on" : ""} onClick={() => setTab("loc")}><MapPin size={14} /> {t("vsd.tabLoc")}</button>
          </div>

          {tab === "infos" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.2fr", gap: 12 }}>
              <div className="mock-card"><div className="mock-card-h"><h3><Info size={15} /> {t("vsd.idCard")}</h3></div><div className="mock-card-b" style={{ display: "grid", gap: 7, fontSize: 12.5 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--ng-soft)" }}>{t("vsd.vname")} :</span><strong>{v.name ?? "-"}</strong></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--ng-soft)" }}>{t("vsd.reg")} :</span><strong>{v.registrationNumber}</strong></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--ng-soft)" }}>{t("vsd.type")} :</span><strong>{v.type}</strong></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--ng-soft)" }}>{t("vsd.owner")} :</span><strong>{v.ownerName}</strong></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--ng-soft)" }}>{t("vsd.contact")} :</span><strong>{v.ownerPhone ?? "-"}</strong></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--ng-soft)" }}>{t("vsd.port")} :</span><strong>{v.place}</strong></div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><span style={{ color: "var(--ng-soft)" }}>{t("vsd.status")} :</span><span className={`bdg ${active ? "bdg-green" : "bdg-gray"}`}>{active ? t("c.active") : t("c.inactive")}</span></div>
              </div></div>
              <div className="mock-card"><div className="mock-card-h"><h3><Wrench size={15} /> {t("vsd.tech")}</h3></div><div className="mock-card-b" style={{ display: "grid", gap: 7, fontSize: 12.5 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--ng-soft)" }}>{t("vsd.length")} :</span><strong>{v.lengthMeters ? `${v.lengthMeters} m` : "-"}</strong></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--ng-soft)" }}>{t("vsd.width")} :</span><strong>{v.widthMeters ? `${v.widthMeters} m` : "-"}</strong></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--ng-soft)" }}>{t("vsd.draft")} :</span><strong>{v.draftMeters ? `${v.draftMeters} m` : "-"}</strong></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--ng-soft)" }}>{t("vsd.capacity")} :</span><strong>{v.capacity} {t("vsd.pax")}</strong></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--ng-soft)" }}>{t("vsd.engine")} :</span><strong>{v.enginePower ? `${v.enginePower} HP` : "-"}</strong></div>
                <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--ng-soft)" }}>{t("vsd.fuel")} :</span><strong>{v.fuelType ?? "-"}</strong></div>
              </div></div>
              <div className="mock-card"><div className="mock-card-h"><h3><CalendarDays size={15} /> {t("vsd.lastInsp")}</h3>{last && <span className={`bdg ${last.riskScore < 25 ? "bdg-green" : "bdg-yellow"}`}>{last.riskScore < 25 ? t("conf.compliant") : t("insp.stVerify")}</span>}</div><div className="mock-card-b" style={{ display: "grid", gridTemplateColumns: "110px 1fr", gap: 12 }}>
                <img src="/boat-inspection.jpg" alt="" style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: 10 }} />
                <div style={{ fontSize: 12.5, display: "grid", gap: 6 }}>
                  {!last ? <span style={{ color: "var(--ng-faint)" }}>{t("vsd.noInsp")}</span> : (<>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--ng-soft)" }}>{t("vsd.date")} :</span><strong>{dl(last.inspectionDate)}</strong></div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--ng-soft)" }}>{t("vsd.score")} :</span><strong>{100 - last.riskScore}%</strong></div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "var(--ng-soft)" }}>{t("vsd.agent")} :</span><strong>{last.agentId ? `Agent #${last.agentId}` : "-"}</strong></div>
                    <button className="btn-outline-blue" style={{ height: 36, fontSize: 12 }} onClick={() => navigate(`/inspections/${last.id}`)}>{t("vsd.openReport")} →</button>
                  </>)}
                </div>
              </div></div>
            </div>
          )}

          {(tab === "infos" || tab === "hist") && (
            <div style={{ display: "grid", gridTemplateColumns: tab === "hist" ? "1fr" : "1.4fr 0.9fr", gap: 12 }}>
              <div className="mock-card"><div className="mock-card-h"><h3><CalendarDays size={15} /> {t("vsd.histTitle")}</h3>{tab !== "hist" && <button style={{ color: "var(--ng-link)", fontSize: 12, fontWeight: 700 }} onClick={() => setTab("hist")}>{t("vsd.seeAllHist")} →</button>}</div>
                <div style={{ padding: "0 12px 12px" }}>{inspections.length === 0 ? <EmptyState title={t("vsd.noInsp")} hint={canEdit ? t("vsd.noInspHint") : undefined} action={canEdit ? <button className="btn-blue" style={{ padding: "0 16px" }} onClick={() => navigate("/inspections/new")}><CalendarDays size={14} /> {t("vsd.plan")}</button> : undefined} /> : (
                <table className="mock-table"><thead><tr><th>{t("c.date")}</th><th>{t("c.type")}</th><th>{t("vsd.colResult")}</th><th>{t("vsd.score")}</th><th>{t("vsd.agent")}</th><th>{t("c.actions")}</th></tr></thead><tbody>
                  {inspections.slice(0, tab === "hist" ? 20 : 3).map((i) => (
                    <tr key={i.id}><td style={{ fontSize: 12 }}>{dl(i.inspectionDate)}</td><td style={{ fontSize: 12 }}>-</td>
                      <td><span className={`bdg ${i.riskScore < 25 ? "bdg-green" : "bdg-yellow"}`}>{i.riskScore < 25 ? t("conf.compliant") : t("insp.stVerify")}</span></td>
                      <td><strong>{100 - i.riskScore}%</strong></td><td style={{ fontSize: 12 }}>{i.agentId ? `Agent #${i.agentId}` : "-"}</td>
                      <td><button className="icon-sq" onClick={() => navigate(`/inspections/${i.id}`)}><Eye size={14} /></button></td></tr>
                  ))}
                </tbody></table>)}</div>
              </div>
              <div className="mock-card"><div className="mock-card-h"><h3>⚡ {t("vsd.quick")}</h3></div><div className="mock-card-b" style={{ display: "grid", gap: 8 }}>
                <button className="btn-blue" style={{ height: 42, fontSize: 12.5 }} onClick={() => navigate("/inspections/new")}><CalendarDays size={14} /> {t("vsd.plan")}</button>
                {canEdit && <button className="btn-outline-blue" onClick={() => toast.info(t("vsd.updateHint"))}><Pencil size={14} /> {t("vsd.update")}</button>}
                {canEdit && <button className="btn-outline-blue" style={{ borderColor: "var(--ng-crit-border)", color: "var(--ng-crit-strong)" }} disabled={updateMut.isPending} onClick={() => updateMut.mutate({ id: v.id, patch: { status: active ? "immobilisee" : "conforme" } })}><Ban size={14} /> {active ? t("vsd.disable") : t("vsd.enable")}</button>}
                {last?.recommendation && <div style={{ background: "var(--ng-tint)", borderRadius: 10, padding: 10, fontSize: 11.5, color: "var(--ng-ink)", lineHeight: 1.5 }}><strong>IA:</strong> {last.recommendation.slice(0, 140)}</div>}
              </div></div>
            </div>
          )}
          {tab === "photos" && <div className="mock-card"><div className="mock-card-b"><EmptyState title={t("vsd.photosHint", { n: inspections.length })} /></div></div>}
          {tab === "maint" && <div className="mock-card"><div className="mock-card-b"><EmptyState title={t("vsd.maintHint")} /></div></div>}
          {tab === "loc" && <div className="mock-card"><div className="mock-card-b"><strong>{v.place}</strong><div style={{ fontSize: 12, color: "var(--ng-faint)" }}>{v.latitude && v.longitude ? `${v.latitude} N, ${v.longitude} E` : t("vsd.gpsMissing")}</div></div></div>}
        </div>

        <div className="mock-side">
          <div className="mock-detail" style={{ borderColor: openAlerts.length ? "var(--ng-crit-border)" : "var(--ng-line-2)", background: openAlerts.length ? "var(--ng-crit-bg)" : "var(--ng-surface)" }}>
            <h3><AlertTriangle size={15} color="var(--ng-crit-2)" /> {t("vsd.alertsOpen")} <span className="bdg bdg-red" style={{ marginLeft: "auto" }}>{openAlerts.length}</span></h3>
            {openAlerts.length === 0 ? <div style={{ fontSize: 12.5, color: "var(--ng-faint)" }}>{t("vsd.noAlerts")}</div> : openAlerts.slice(0, 3).map((a) => (
              <div key={a.id} style={{ borderLeft: "3px solid var(--ng-warn)", paddingLeft: 10 }}>
                <strong style={{ fontSize: 13 }}>{a.title}</strong>
                <div style={{ fontSize: 12, color: "var(--ng-soft)" }}>{t("insp.risk")} : <span className="bdg bdg-yellow">{a.urgency}</span></div>
                <div style={{ fontSize: 11.5, color: "var(--ng-faint)" }}>{t("vsd.seenOn")} : {dl(a.createdAt)}</div>
              </div>
            ))}
          </div>
          <div className="mock-detail">
            <h3><MapPin size={15} /> {t("vsd.curLoc")}</h3>
            <div style={{ background: "var(--ng-tint)", borderRadius: 12, height: 130, display: "grid", placeItems: "center", color: "var(--ng-link)" }}><MapPin size={32} /></div>
            <div style={{ fontSize: 13 }}><strong>{v.place}, Benin</strong><div style={{ fontSize: 11.5, color: "var(--ng-faint)" }}>{v.latitude && v.longitude ? `${v.latitude} N, ${v.longitude} E` : t("vsd.gpsMissing")}</div></div>
            <button className="btn-outline-blue" onClick={() => setTab("loc")}>{t("vsd.seeMap")} →</button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
