import { useState } from "react";
import { AlertTriangle, ArrowLeft, BarChart3, Camera, Check, Cpu, Download, Eye, FileText, Images, MapPin, MessageSquare, Plus, Printer, Share2, ShieldCheck, Ship, User, Zap } from "lucide-react";
import { Link, useLocation, useRoute } from "wouter";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import { useLang } from "@/i18n/LanguageContext";
import { EmptyState, ErrorState, Skeleton, TableSkeleton } from "@/components/DashboardStates";

export default function InspectionDetail() {
  const { t, locale } = useLang();
  const [, params] = useRoute("/inspections/:id");
  const [, navigate] = useLocation();
  const id = Number(params?.id ?? 0);
  const [tab, setTab] = useState("overview");
  const q = trpc.data.inspections.get.useQuery({ id }, { enabled: id > 0 });
  const createReport = trpc.data.reports.createFromInspection.useMutation({ onSuccess: (r) => { toast.success(r.reference); navigate(`/rapports/${r.id}`); }, onError: (e) => toast.error(e.message) });

  const insp = q.data?.inspection;
  const vessel = q.data?.vessel;
  const images = q.data?.images ?? [];
  const findings = q.data?.findings ?? [];
  const score = insp ? 100 - insp.riskScore : 0;
  const done = insp && ["validee", "terminee", "cloturee"].includes(insp.status);

  if (q.isLoading) return <AppShell><div style={{ padding: 16, display: "grid", gap: 12 }}><Skeleton style={{ height: 28, width: 200 }} /><Skeleton style={{ height: 220, borderRadius: 12 }} /><TableSkeleton rows={3} cols={6} /></div></AppShell>;
  if (q.isError) return <AppShell><ErrorState message={q.error.message} onRetry={() => q.refetch()} /></AppShell>;
  if (!insp) return <AppShell><EmptyState title={t("inspd.notFound")} action={<Link href="/inspections" className="btn-blue" style={{ padding: "0 18px", textDecoration: "none" }}>{t("insp.title")}</Link>} /></AppShell>;

  const riskTxt = insp.riskScore >= 50 ? t("risk.high") : t("conf.compliant");
  const dt = (d: string | Date) => new Date(d).toLocaleString(locale);

  return (
    <AppShell>
      <Link href="/inspections" className="mock-back"><ArrowLeft size={14} /> {t("inspd.back")}</Link>
      <h1 className="mock-h1">{t("inspd.title")}</h1>
      <p className="mock-sub">{t("inspd.sub")}</p>
      <div style={{ height: 14 }} />

      <div className="mock-page" style={{ gridTemplateColumns: "minmax(0,1fr) 300px" }}>
        <div className="mock-main">
          <div className="mock-card"><div className="mock-card-b" style={{ display: "grid", gridTemplateColumns: "210px 1fr 170px", gap: 18 }}>
            <div style={{ position: "relative" }}><img src={images[0]?.imageUrl ?? "/boat-inspection.jpg"} alt="" style={{ width: "100%", height: 175, objectFit: "cover", borderRadius: 12 }} /><span style={{ position: "absolute", left: 8, bottom: 8, background: "rgba(2,20,40,0.75)", color: "#fff", fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 8 }}>📷 {images.length} photos</span></div>
            <div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}><strong style={{ fontSize: 18 }}>{vessel?.name ?? vessel?.registrationNumber ?? `#${insp.vesselId}`}</strong><span className={`bdg ${done ? "bdg-green" : "bdg-yellow"}`}>{done ? t("inspd.done") : insp.status}</span></div>
              <div style={{ marginTop: 10, display: "grid", gap: 7, fontSize: 13 }}>
                <div style={{ display: "flex", gap: 8 }}><Ship size={15} color="#0d7fdd" /><span style={{ color: "#5b7a96", width: 110 }}>{t("inspd.type")} :</span><strong>{vessel?.type ?? "-"}</strong></div>
                <div style={{ display: "flex", gap: 8 }}><MapPin size={15} color="#0d7fdd" /><span style={{ color: "#5b7a96", width: 110 }}>{t("wiz.fPlace")} :</span><strong>{insp.place}</strong></div>
                <div style={{ display: "flex", gap: 8 }}><BarChart3 size={15} color="#0d7fdd" /><span style={{ color: "#5b7a96", width: 110 }}>{t("wiz.fDate")} :</span><strong>{dt(insp.inspectionDate)}</strong></div>
                <div style={{ display: "flex", gap: 8 }}><User size={15} color="#0d7fdd" /><span style={{ color: "#5b7a96", width: 110 }}>{t("wiz.fAgent")} :</span><strong>{insp.agentId ? `Agent #${insp.agentId}` : "-"}</strong></div>
                <div style={{ display: "flex", gap: 8 }}><MapPin size={15} color="#0d7fdd" /><span style={{ color: "#5b7a96", width: 110 }}>{t("inspd.capacity")} :</span><strong>{vessel ? `${vessel.capacity} ${t("wiz.pax")}` : `${insp.passengersDetected}`}</strong></div>
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ width: 110, height: 110, borderRadius: "50%", margin: "0 auto", background: `conic-gradient(${score >= 80 ? "#16a34a" : "#f59e0b"} ${score}%, #eef2f6 ${score}%)`, display: "grid", placeItems: "center" }}><div style={{ width: 86, height: 86, borderRadius: "50%", background: "#fff", display: "grid", placeItems: "center" }}><div><div style={{ fontWeight: 800, fontSize: 20 }}>{score}%</div><div style={{ fontSize: 10, color: "#7b93a8" }}>{t("rpd.compliance")}</div></div></div></div>
              <div style={{ marginTop: 8, background: "#dcfce7", borderRadius: 10, padding: 8, fontSize: 11, textAlign: "left" }}><strong style={{ display: "flex", gap: 5, alignItems: "center", color: "#15803d" }}><Check size={12} /> {riskTxt}</strong><span style={{ color: "#5b7a96" }}>{insp.recommendation?.slice(0, 80) ?? ""}</span></div>
            </div>
          </div></div>

          <div className="mock-tabs">
            <button className={tab === "overview" ? "on" : ""} onClick={() => setTab("overview")}><Eye size={14} /> {t("inspd.tabOver")}</button>
            <button className={tab === "photos" ? "on" : ""} onClick={() => setTab("photos")}><Images size={14} /> {t("inspd.tabPhotos")}</button>
            <button className={tab === "ai" ? "on" : ""} onClick={() => setTab("ai")}><Cpu size={14} /> {t("inspd.tabAI")}</button>
            <button className={tab === "results" ? "on" : ""} onClick={() => setTab("results")}><BarChart3 size={14} /> {t("inspd.tabResults")}</button>
            <button className={tab === "pdf" ? "on" : ""} onClick={() => setTab("pdf")}><FileText size={14} /> {t("inspd.tabPdf")}</button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 12 }}>
            <div className="mock-card"><div className="mock-card-h"><h3><ShieldCheck size={15} /> {t("inspd.summary")}</h3></div><div className="mock-card-b" style={{ display: "grid", gap: 12 }}>
              <div style={{ background: "#eef6fd", borderRadius: 10, padding: 10, fontSize: 12.5, color: "#0d7fdd" }}>{t("inspd.summaryTxt")}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                {[[t("inspd.safety"), `${insp.lifejacketsVisible}/${Math.max(insp.passengersDetected, 1)}`, "#16a34a"], [t("inspd.equip"), `${findings.length}/5`, "#f59e0b"], [t("inspd.struct"), insp.hullStatus === "bon" ? "0/5" : "1/5", "#0d7fdd"], [t("inspd.global"), `${score}%`, "#64748b"]].map(([label, val, c]) => (
                  <div key={label as string} style={{ border: "1px solid #e3ecf4", borderRadius: 10, padding: 10, textAlign: "center" }}><div style={{ fontSize: 11.5, fontWeight: 700, color: c as string }}>{label}</div><div style={{ fontWeight: 800, fontSize: 16, margin: "4px 0" }}>{val}</div></div>
                ))}
              </div>
            </div></div>
            <div className="mock-card"><div className="mock-card-h"><h3>{t("inspd.state")}</h3></div><div className="mock-card-b"><div className="timeline">
              {[[t("inspd.stGeneral"), dt(insp.inspectionDate)], [t("inspd.stPhotos"), `${images.length} photos`], [t("inspd.stAI"), insp.analyzedAt ? dt(insp.analyzedAt) : "…"], [t("inspd.stFinal"), insp.status]].map(([label, sub]) => (
                <div key={label as string} className="tl-item"><span className="tl-dot" /><div><strong>{label}</strong><small>{sub}</small></div></div>
              ))}
            </div></div></div>
          </div>

          <div className="mock-card"><div className="mock-card-h"><h3 style={{ color: "#b91c1c" }}><AlertTriangle size={15} /> {t("inspd.anoms")} ({findings.length})</h3></div>
            <div style={{ padding: "0 12px 12px" }}>{findings.length === 0 ? <EmptyState title={t("inspd.noAnom")} /> : (
            <table className="mock-table"><thead><tr><th>N°</th><th>{t("inspd.colCat")}</th><th>{t("inspd.colIssue")}</th><th>{t("inspd.colRisk")}</th><th>{t("inspd.colStatus")}</th><th>{t("inspd.colReco")}</th></tr></thead><tbody>
              {findings.map((f, i) => <tr key={f.id}><td>{i + 1}</td><td>{f.anomalyType}</td><td style={{ fontSize: 12 }}>{f.description}</td><td><span className={`bdg ${f.riskLevel === "critique" ? "bdg-red" : f.riskLevel === "eleve" ? "bdg-orange" : "bdg-yellow"}`}>{f.riskLevel}</span></td><td><span className="bdg bdg-gray">{f.humanStatus}</span></td><td style={{ fontSize: 12 }}>{f.recommendation ?? "-"}</td></tr>)}
            </tbody></table>)}</div>
          </div>

          <div className="mock-card"><div className="mock-card-h"><h3><Camera size={15} /> {t("inspd.photosDone")} ({images.length})</h3></div>
            <div className="mock-card-b" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
              {images.length === 0 ? <div style={{ gridColumn: "1/-1" }}><EmptyState title={t("inspd.noPhotos")} /></div>
              : images.slice(0, 5).map((img, i) => <div key={img.id}><div style={{ position: "relative" }}><img src={img.imageUrl} alt="" style={{ width: "100%", height: 90, objectFit: "cover", borderRadius: 10 }} /><span style={{ position: "absolute", top: 5, right: 5, width: 20, height: 20, borderRadius: "50%", background: "#16a34a", color: "#fff", display: "grid", placeItems: "center" }}><Check size={12} /></span></div><div style={{ fontSize: 10.5, color: "#0d7fdd", marginTop: 3 }}>{i + 1}. {img.imageType}</div></div>)}
            </div>
          </div>
        </div>

        <div className="mock-side">
          <div className="mock-detail">
            <h3><Ship size={15} /> {t("inspd.vesselBox")}</h3>
            <div style={{ display: "flex", gap: 10 }}><img src={images[0]?.imageUrl ?? "/boat-inspection.jpg"} alt="" style={{ width: 84, height: 64, objectFit: "cover", borderRadius: 10 }} /><div><strong style={{ fontSize: 13 }}>{vessel?.name ?? vessel?.registrationNumber ?? "-"}</strong><div style={{ fontSize: 11.5, color: "#5b7a96" }}>{t("inspd.type")} : {vessel?.type ?? "-"}<br />{t("inspd.capacity")} : {vessel ? `${vessel.capacity}` : "-"}</div><span className="bdg bdg-green" style={{ marginTop: 4 }}>{t("c.active")}</span></div></div>
            <h3 style={{ marginTop: 6 }}><MapPin size={15} /> {t("inspd.locBox")}</h3>
            <div className="mock-kv"><MapPin size={14} /><div><strong>{insp.place}</strong></div></div>
            <div className="mock-kv"><BarChart3 size={14} /><div><small>{t("wiz.fDate")}</small><strong>{dt(insp.inspectionDate)}</strong></div></div>
            <div className="mock-kv"><User size={14} /><div><small>{t("wiz.fAgent")}</small><strong>{insp.agentId ? `Agent #${insp.agentId}` : "-"}</strong></div></div>
          </div>
          <div className="mock-detail"><h3><MessageSquare size={15} /> {t("inspd.comments")}</h3><div style={{ background: "#eef6fd", borderRadius: 10, padding: 10, fontSize: 12 }}>{insp.comments || insp.humanNotes || t("inspd.noComments")}</div></div>
          <div className="mock-detail"><h3><Zap size={15} /> {t("inspd.quick")}</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button className="btn-outline-blue" style={{ fontSize: 11.5 }} onClick={() => createReport.mutate({ inspectionId: insp.id })}><Download size={14} /> {t("inspd.dlReport")}</button>
              <button className="btn-outline-blue" style={{ fontSize: 11.5 }} onClick={async () => { try { await navigator.clipboard.writeText(window.location.href); toast.success(t("rpd.linkCopied")); } catch {} }}><Share2 size={14} /> {t("c.share")}</button>
              <button className="btn-outline-blue" style={{ fontSize: 11.5 }} onClick={() => navigate("/inspections/new")}><Plus size={14} /> {t("inspd.newInsp")}</button>
              <button className="btn-outline-blue" style={{ fontSize: 11.5 }} onClick={() => window.print()}><Printer size={14} /> {t("inspd.exportPdf")}</button>
            </div>
            <button className="btn-blue" disabled={createReport.isPending} onClick={() => createReport.mutate({ inspectionId: insp.id })}><Eye size={15} /> {createReport.isPending ? t("inspd.generating") : `${t("inspd.openReport")} →`}</button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
