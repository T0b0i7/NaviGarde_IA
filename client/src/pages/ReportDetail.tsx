import { useState } from "react";
import { AlertTriangle, ArrowLeft, BarChart3, CalendarDays, Camera, Check, Clock3, Cpu, Download, Eye, FileText, Images, Lightbulb, MapPin, MessageSquare, Printer, Share2, ShieldCheck, Ship, User } from "lucide-react";
import { Link, useRoute } from "wouter";
import { toast } from "sonner";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import { useLang } from "@/i18n/LanguageContext";
import { ChartSkeleton, EmptyState, ErrorState, Skeleton, TableSkeleton } from "@/components/DashboardStates";

type Conf = "ok" | "minor" | "major" | "crit";
function confOf(risk: number): Conf { if (risk >= 75) return "crit"; if (risk >= 50) return "major"; if (risk >= 25) return "minor"; return "ok"; }

export default function ReportDetail() {
  const { t, locale } = useLang();
  const [, params] = useRoute("/rapports/:id");
  const id = Number(params?.id ?? 0);
  const [tab, setTab] = useState("overview");
  const q = trpc.data.reports.get.useQuery({ id }, { enabled: id > 0 });

  const report = q.data?.report;
  const insp = q.data?.inspection;
  const vessel = q.data?.vessel;
  const images = q.data?.images ?? [];
  const findings = q.data?.findings ?? [];
  const history = q.data?.history ?? [];
  const risk = insp?.riskScore ?? 0;
  const score = 100 - risk;
  const conf = confOf(risk);
  const mainPhoto = images[0]?.imageUrl ?? "/boat-inspection.jpg";
  const confLabel = conf === "ok" ? t("conf.compliant") : conf === "minor" ? t("conf.minor") : conf === "major" ? t("conf.major") : t("conf.critical");
  const dt = (d: string | Date) => new Date(d).toLocaleString(locale);

  const share = async () => { try { await navigator.clipboard.writeText(window.location.href); toast.success(t("rpd.linkCopied")); } catch { toast.error(t("rpd.copyFail")); } };
  const pdfHref = `/api/reports/${id}/pdf`;
  const openPdf = () => {
    const opened = window.open(pdfHref, "_blank", "noopener");
    if (!opened) window.location.assign(pdfHref);
  };

  if (q.isLoading) return <AppShell><div style={{ padding: 16, display: "grid", gap: 12 }}><Skeleton style={{ height: 28, width: 200 }} /><Skeleton style={{ height: 220, borderRadius: 12 }} /><ChartSkeleton height={180} /></div></AppShell>;
  if (q.isError) return <AppShell><ErrorState message={q.error.message} onRetry={() => q.refetch()} /></AppShell>;
  if (!report) return <AppShell><EmptyState title={t("rpd.notFound")} action={<Link href="/rapports" className="btn-blue" style={{ padding: "0 18px", textDecoration: "none" }}>{t("rp.center")}</Link>} /></AppShell>;

  const donutRaw = [
    { name: t("conf.minor"), value: findings.filter((f) => f.riskLevel === "faible" || f.riskLevel === "moyen").length, color: "#f59e0b" },
    { name: t("conf.major"), value: findings.filter((f) => f.riskLevel === "eleve").length, color: "#f97316" },
    { name: t("conf.critical"), value: findings.filter((f) => f.riskLevel === "critique").length, color: "#ef4444" },
  ];
  const donutNonCompliant = donutRaw.filter((d) => d.value > 0);
  const donut: { name: string; value: number; color: string }[] = findings.length === 0
    ? [{ name: t("conf.compliant"), value: 1, color: "#16a34a" }]
    : donutNonCompliant.length > 0 ? donutNonCompliant : [{ name: t("conf.compliant"), value: 1, color: "#16a34a" }];

  return (
    <AppShell>
      <Link href="/rapports" className="mock-back"><ArrowLeft size={14} /> {t("rpd.back")}</Link>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div><h1 className="mock-h1">{t("rpd.title")}</h1><p className="mock-sub">{t("rpd.sub")}</p></div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn-outline-blue" style={{ width: "auto", padding: "0 16px" }} onClick={openPdf}><Download size={15} /> {t("rpd.download")}</button>
          <button className="btn-outline-blue" style={{ width: "auto", padding: "0 16px" }} onClick={() => window.print()}><Printer size={15} /> {t("rpd.print")}</button>
          <button className="btn-outline-blue" style={{ width: "auto", padding: "0 16px" }} onClick={share}><Share2 size={15} /> {t("rpd.share")}</button>
        </div>
      </div>
      <div style={{ height: 14 }} />

      <div className="mock-page">
        <div className="mock-main">
          <div className="mock-card"><div className="mock-card-b" style={{ display: "grid", gridTemplateColumns: "220px 1fr 190px", gap: 18 }}>
            <div style={{ position: "relative" }}><img src={mainPhoto} alt="" style={{ width: "100%", height: 190, objectFit: "cover", borderRadius: 12 }} /><span style={{ position: "absolute", left: 8, bottom: 8, background: "rgba(2,20,40,0.75)", color: "#fff", fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 8, display: "inline-flex", gap: 6, alignItems: "center" }}><Camera size={13} /> {images.length} photos</span></div>
            <div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}><strong style={{ fontSize: 19, color: "#0a2a5e" }}>{vessel?.name ?? vessel?.registrationNumber ?? `#${report.inspectionId ?? "-"}`}</strong><span className={`bdg ${conf === "ok" ? "bdg-green" : conf === "crit" ? "bdg-red" : "bdg-yellow"}`}><Check size={12} /> {confLabel}</span></div>
              <div style={{ marginTop: 12, display: "grid", gap: 8, fontSize: 13 }}>
                <div style={{ display: "flex", gap: 8 }}><Ship size={15} color="#0d7fdd" /><span style={{ color: "#7b93a8", width: 140 }}>{t("rpd.vesselType")}</span><strong>{vessel?.type ?? "-"}</strong></div>
                <div style={{ display: "flex", gap: 8 }}><MapPin size={15} color="#0d7fdd" /><span style={{ color: "#7b93a8", width: 140 }}>{t("rpd.place")}</span><strong>{insp?.place ?? "-"}</strong></div>
                <div style={{ display: "flex", gap: 8 }}><CalendarDays size={15} color="#0d7fdd" /><span style={{ color: "#7b93a8", width: 140 }}>{t("rpd.dateTime")}</span><strong>{insp ? dt(insp.inspectionDate) : dt(report.createdAt)}</strong></div>
                <div style={{ display: "flex", gap: 8 }}><User size={15} color="#0d7fdd" /><span style={{ color: "#7b93a8", width: 140 }}>{t("rpd.agent")}</span><strong>{insp?.agentId ? `Agent #${insp.agentId}` : report.createdBy ? `Agent #${report.createdBy}` : "-"}</strong></div>
                <div style={{ display: "flex", gap: 8 }}><User size={15} color="#0d7fdd" /><span style={{ color: "#7b93a8", width: 140 }}>{t("rpd.capacity")}</span><strong>{vessel ? `${vessel.capacity} ${t("wiz.pax")}` : insp ? `${insp.passengersDetected}` : "-"}</strong></div>
              </div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ width: 130, height: 130, borderRadius: "50%", margin: "0 auto", background: `conic-gradient(${score >= 80 ? "#16a34a" : score >= 60 ? "#f59e0b" : "#ef4444"} ${score}%, #eef2f6 ${score}%)`, display: "grid", placeItems: "center" }}><div style={{ width: 102, height: 102, borderRadius: "50%", background: "#fff", display: "grid", placeItems: "center" }}><div><div style={{ fontSize: 24, fontWeight: 800 }}>{score}%</div><div style={{ fontSize: 11, color: "#7b93a8" }}>{t("rpd.compliance")}</div></div></div></div>
              <div style={{ marginTop: 10, background: conf === "ok" ? "#dcfce7" : "#fef3c7", borderRadius: 10, padding: "8px 10px", fontSize: 11.5, color: "#0a2a5e", textAlign: "left" }}><strong style={{ display: "flex", gap: 6, alignItems: "center" }}><Check size={13} /> {confLabel}</strong>{insp?.recommendation?.slice(0, 90) ?? ""}</div>
            </div>
          </div></div>

          <div className="mock-tabs">
            <button className={tab === "overview" ? "on" : ""} onClick={() => setTab("overview")}><Eye size={14} /> {t("rpd.tabOver")}</button>
            <button className={tab === "photos" ? "on" : ""} onClick={() => setTab("photos")}><Images size={14} /> {t("rpd.tabPhotos")}</button>
            <button className={tab === "ai" ? "on" : ""} onClick={() => setTab("ai")}><Cpu size={14} /> {t("rpd.tabAI")}</button>
            <button className={tab === "anomalies" ? "on" : ""} onClick={() => setTab("anomalies")}><AlertTriangle size={14} /> {t("rpd.tabAnom")} {findings.length > 0 && <span className="cnt">{findings.length}</span>}</button>
            <button className={tab === "reco" ? "on" : ""} onClick={() => setTab("reco")}><Lightbulb size={14} /> {t("rpd.tabReco")}</button>
            <button className={tab === "pdf" ? "on" : ""} onClick={() => setTab("pdf")}><FileText size={14} /> {t("rpd.tabPdf")}</button>
          </div>

          {(tab === "overview" || tab === "ai") && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 12 }}>
              <div className="mock-card"><div className="mock-card-h"><h3><ShieldCheck size={15} /> {t("rpd.eval")}</h3></div><div className="mock-card-b" style={{ display: "flex", gap: 14, alignItems: "center" }}>
                <div style={{ width: 110, height: 110, position: "relative", flexShrink: 0 }}><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={donut} dataKey="value" innerRadius={36} outerRadius={52} paddingAngle={2} strokeWidth={0}>{donut.map((d, i) => <Cell key={i} fill={d.color} />)}</Pie></PieChart></ResponsiveContainer><div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}><div><div style={{ fontWeight: 800, fontSize: 20 }}>{score}%</div><div style={{ fontSize: 10, color: "#7b93a8" }}>{t("rpd.compliance")}</div></div></div></div>
                <div className="legend">{donut.map((d) => <div key={d.name}><i style={{ background: d.color }} />{d.name}<b>{d.value}</b></div>)}</div>
              </div></div>
              <div className="mock-card"><div className="mock-card-h"><h3><Cpu size={15} /> {t("rpd.aiTitle")}</h3></div><div className="mock-card-b" style={{ fontSize: 12.5, color: "#0a2a5e", lineHeight: 1.55 }}>
                {insp?.recommendation ?? t("rpd.noAI")}
                <div style={{ marginTop: 10, background: "#eaf4fc", borderRadius: 10, padding: 10, fontSize: 11.5 }}><strong style={{ display: "flex", gap: 6, alignItems: "center", color: "#0d7fdd" }}><Check size={13} /> {risk >= 50 ? t("rpd.humanNeeded") : t("rpd.noCrit")}</strong><span style={{ color: "#5b7a96" }}>{t("rpd.conf")} : {insp?.confidence ?? 0}% · {t("rpd.provider")} : {insp?.analysisProvider ?? "-"}</span></div>
                <div style={{ marginTop: 8, display: "flex", gap: 12, fontSize: 11.5, color: "#7b93a8" }}><span>{t("rpd.version")} v{report.version}</span><span>·</span><span className={`bdg ${conf === "ok" ? "bdg-green" : "bdg-yellow"}`}><Check size={11} /> {confLabel}</span></div>
              </div></div>
            </div>
          )}

          {(tab === "overview" || tab === "anomalies") && (
            <div className="mock-card"><div className="mock-card-h"><h3 style={{ color: "#b91c1c" }}><AlertTriangle size={15} /> {t("rpd.anoms")} ({findings.length})</h3></div>
              <div className="table-scroll" style={{ padding: "0 12px 12px" }}>
                {findings.length === 0 ? <EmptyState title={t("rpd.noAnoms")} /> : (
                <table className="mock-table anomalies-table"><colgroup><col style={{ width: "6%" }} /><col style={{ width: "16%" }} /><col style={{ width: "38%" }} /><col style={{ width: "12%" }} /><col style={{ width: "13%" }} /><col style={{ width: "15%" }} /></colgroup><thead><tr><th>#</th><th>{t("rpd.cat")}</th><th>{t("rpd.issue")}</th><th>{t("rpd.risk")}</th><th>{t("c.status")}</th><th>{t("rpd.rec")}</th></tr></thead><tbody>
                  {findings.map((f, i) => (
                    <tr key={f.id}><td>{i + 1}</td><td>{f.anomalyType}</td><td>{f.description}</td>
                      <td><span className={`bdg ${f.riskLevel === "critique" ? "bdg-red" : f.riskLevel === "eleve" ? "bdg-orange" : "bdg-yellow"}`}>{f.riskLevel}</span></td>
                      <td><span className="bdg bdg-gray">{f.humanStatus}</span></td><td style={{ fontSize: 12 }}>{f.recommendation ?? "-"}</td></tr>
                  ))}
                </tbody></table>)}
              </div>
            </div>
          )}

          {(tab === "overview" || tab === "photos") && (
            <div className="mock-card"><div className="mock-card-h"><h3><Camera size={15} /> {t("rpd.photosAn")} ({images.length})</h3></div>
              <div className="mock-card-b" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
                {images.length === 0 ? <div style={{ gridColumn: "1/-1" }}><EmptyState title={t("rpd.noPhotos")} /></div> : images.slice(0, 5).map((img, i) => <div key={img.id}><div style={{ position: "relative" }}><img src={img.imageUrl} alt="" style={{ width: "100%", height: 96, objectFit: "cover", borderRadius: 10 }} /><span style={{ position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: "50%", background: "#16a34a", color: "#fff", display: "grid", placeItems: "center" }}><Check size={13} /></span></div><div style={{ fontSize: 11, color: "#0d7fdd", marginTop: 4 }}>{i + 1}. {img.imageType}</div></div>)}
              </div>
            </div>
          )}

          {tab === "reco" && (
            <div className="mock-card"><div className="mock-card-h"><h3><Lightbulb size={15} /> {t("rpd.tabReco")}</h3></div><div className="mock-card-b" style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{insp?.recommendation ?? report.content}</div></div>
          )}
          {tab === "pdf" && (
            <div className="mock-card"><div className="mock-card-b" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <FileText size={28} color="#0d7fdd" />
              <div style={{ flex: 1 }}><strong style={{ fontSize: 14 }}>{report.reference} - v{report.version}</strong><div style={{ fontSize: 11, color: "#7b93a8", fontFamily: "monospace" }}>{t("rpd.sha")} : {report.pdfSha256 ?? "-"}</div></div>
              <button className="btn-blue" style={{ padding: "0 18px" }} onClick={openPdf}><Download size={15} /> PDF</button>
            </div></div>
          )}
        </div>

        <div className="mock-side">
          <div className="mock-detail">
            <h3><FileText size={15} /> {t("rpd.resume")}</h3>
            <div className="mock-kv"><FileText size={15} /><div><small>{t("rpd.ref")}</small><strong>{report.reference}</strong></div></div>
            <div className="mock-kv"><Ship size={15} /><div><small>{t("rpd.vessel")}</small><strong>{vessel?.registrationNumber ?? "-"}</strong></div></div>
            <div className="mock-kv"><BarChart3 size={15} /><div><small>{t("rpd.inspType")}</small><strong>{vessel?.type ?? t("rpd.safetyCheck")}</strong></div></div>
            <div className="mock-kv"><Check size={15} /><div><small>{t("c.status")}</small><strong><span className={`bdg ${conf === "ok" ? "bdg-green" : "bdg-yellow"}`}>{confLabel}</span></strong></div></div>
            <div className="mock-kv"><CalendarDays size={15} /><div><small>{t("rpd.created")}</small><strong>{dt(report.createdAt)}</strong></div></div>
            <div className="mock-kv"><User size={15} /><div><small>{t("rpd.agentResp")}</small><strong>{insp?.agentId ? `Agent #${insp.agentId}` : "-"}</strong></div></div>
          </div>
          <div className="mock-detail">
            <h3><MapPin size={15} /> {t("rpd.loc")}</h3>
            <div style={{ background: "#eef5fb", borderRadius: 12, height: 110, display: "grid", placeItems: "center", color: "#0d7fdd" }}><MapPin size={30} /></div>
            <div style={{ fontSize: 13 }}><strong>{insp?.place ?? "-"}</strong><div style={{ fontSize: 11, color: "#7b93a8" }}>{vessel?.latitude && vessel?.longitude ? `${vessel.latitude} N, ${vessel.longitude} E` : t("rpd.gpsMissing")}</div></div>
          </div>
          <div className="mock-detail">
            <h3><MessageSquare size={15} /> {t("rpd.comments")}</h3>
            <div style={{ background: "#eef5fb", borderRadius: 10, padding: 10, fontSize: 12, color: "#0a2a5e" }}>{insp?.comments || insp?.humanNotes || t("rpd.noComments")}</div>
          </div>
          <div className="mock-detail">
            <h3><Clock3 size={15} /> {t("rpd.history")}</h3>
            <div className="timeline">
              {(history.length ? history.map((h) => ({ id: h.id, action: h.action, createdAt: h.createdAt, userId: h.userId })) : [{ id: 0, action: "created", createdAt: report.createdAt, userId: report.createdBy }]).slice(0, 5).map((item, i: number) => {
                return <div key={item.id || i} className="tl-item"><span className="tl-dot" /><div><strong>{item.action}</strong><small>{dt(item.createdAt)}{item.userId ? ` · ${t("rpd.byAgent")} #${item.userId}` : ` · ${t("rpd.bySystem")}`}</small></div></div>;
              })}
            </div>
            <button className="btn-blue" onClick={openPdf}><Eye size={15} /> {t("rpd.openFull")} →</button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
