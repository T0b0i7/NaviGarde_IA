import { ChangeEvent, useEffect, useState } from "react";
import { ArrowLeft, CalendarDays, Camera, Check, CloudUpload, Cpu, Info, Lightbulb, MapPin, Plus, Ship, Trash2, User, X } from "lucide-react";
import { Link, useLocation } from "wouter";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";
import { useLang } from "@/i18n/LanguageContext";

type Analysis = { passengersDetected: number; lifejacketsVisible: number; capacityRisk: string; riskScore: number; confidence: number; hull: string; engine: string; findings: string[]; recommendation: string; uncertainty: string[] };
async function toDataUrl(src: string): Promise<string> {
  if (src.startsWith("data:")) return src;
  const r = await fetch(src); const b = await r.blob();
  return new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = rej; fr.readAsDataURL(b); });
}

export default function NewInspection() {
  const { t, locale } = useLang();
  const [, navigate] = useLocation();
  const [step, setStep] = useState(0);
  const [photos, setPhotos] = useState<string[]>([]);
  const [form, setForm] = useState({ boat: "", type: "Pirogue", capacity: "30", place: "Porto-Novo", owner: "", comments: "" });
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [aiError, setAiError] = useState("");
  const [inspectionId, setInspectionId] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const me = trpc.auth.me.useQuery(undefined, { retry: false });
  const createFull = trpc.data.inspections.createFull.useMutation();
  const uploadImg = trpc.data.inspections.uploadImage.useMutation();
  const saveAnalysis = trpc.data.inspections.saveAnalysis.useMutation();
  const analyzeMut = trpc.ai.analyzeInspection.useMutation();
  const genReport = trpc.data.reports.createFromInspection.useMutation({ onSuccess: (r) => { toast.success(`${r.reference}`); navigate(`/rapports/${r.id}`); }, onError: (e) => toast.error(e.message) });
  const upd = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const STEPS = [t("wiz.stepInfo"), t("wiz.stepPhotos"), t("wiz.stepAnalysis"), t("wiz.stepResult")];
  const titles = [t("wiz.t0"), t("wiz.t1"), t("wiz.t2"), t("wiz.t3")];
  const subs = [t("wiz.s0"), t("wiz.s1"), t("wiz.s2"), t("wiz.s3")];

  const onFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const acc = Array.from(e.target.files ?? []).filter((f) => ["image/jpeg", "image/png", "image/webp"].includes(f.type) && f.size <= 10 * 1024 * 1024).slice(0, 10 - photos.length);
    if (acc.length !== (e.target.files?.length ?? 0)) setAiError(t("wiz.errImg"));
    setPhotos((p) => [...p, ...acc.map((f) => URL.createObjectURL(f))]);
    e.target.value = "";
  };

  useEffect(() => {
    if (step === 2 && (analyzeMut.isPending || createFull.isPending)) {
      setProgress(8);
      const timer = setInterval(() => setProgress((p) => Math.min(96, p + Math.random() * 7)), 600);
      return () => clearInterval(timer);
    }
    if (step === 3) setProgress(100);
  }, [step, analyzeMut.isPending, createFull.isPending]);

  const analyze = async () => {
    setAiError("");
    try {
      let id = inspectionId;
      if (!id) {
        if (!form.boat.trim() || !form.owner.trim()) throw new Error(t("wiz.errRegOwner"));
        if (!photos.length) throw new Error(t("wiz.errPhoto"));
        const c = await createFull.mutateAsync({ registrationNumber: form.boat.trim(), vesselType: form.type, ownerName: form.owner.trim(), capacity: Number(form.capacity) || 0, place: form.place, comments: form.comments });
        id = c.inspectionId; setInspectionId(id);
        const urls = await Promise.all(photos.slice(0, 10).map(toDataUrl));
        for (const d of urls) { try { await uploadImg.mutateAsync({ inspectionId: id, dataUrl: d, imageType: "inspection" }); } catch {} }
      }
      const imgs = await Promise.all(photos.slice(0, 5).map(toDataUrl));
      const res = await analyzeMut.mutateAsync({ boat: form.boat, type: form.type, capacity: Number(form.capacity) || 0, place: form.place, images: imgs });
      await saveAnalysis.mutateAsync({ inspectionId: id, analysis: res });
      setAnalysis(res); setStep(3); toast.success(t("wiz.done"));
    } catch (err) { setAiError(err instanceof Error ? err.message : "AI unavailable"); }
  };

  const riskWord = !analysis ? "" : analysis.riskScore >= 75 ? t("risk.critical") : analysis.riskScore >= 50 ? t("risk.high") : analysis.riskScore >= 25 ? t("risk.medium") : t("risk.low");

  return (
    <AppShell>
      <Link href="/inspections" className="mock-back"><ArrowLeft size={14} /> {t("c.back")} <span style={{ color: "#7b93a8" }}>| {t("wiz.t0")}{step === 3 ? ` | ${t("wiz.stepResult")}` : ""}</span></Link>
      <h1 className="mock-h1">{titles[step]}</h1>
      <p className="mock-sub">{subs[step]}</p>
      <div style={{ height: 14 }} />

      <div className="mock-page" style={{ gridTemplateColumns: "minmax(0,1fr) 320px" }}>
        <div className="mock-main">
          <div className="mock-card"><div className="mock-card-b" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {STEPS.map((s, i) => (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
                <span style={{ width: 30, height: 30, borderRadius: "50%", display: "grid", placeItems: "center", background: i <= step ? "#0d7fdd" : "#cbd9e6", color: "#fff", fontWeight: 800, fontSize: 13, flexShrink: 0 }}>{i < step ? <Check size={15} /> : i + 1}</span>
                <strong style={{ fontSize: 12.5, color: i <= step ? "#0a2a5e" : "#8aa3bb" }}>{s}</strong>
                {i < 3 && <span style={{ flex: 1, height: 2, background: i < step ? "#0d7fdd" : "#d9e6f2", borderRadius: 2 }} />}
              </div>
            ))}
          </div></div>

          {step === 0 && (
            <div className="mock-card"><div className="mock-card-b" style={{ display: "grid", gap: 18 }}>
              <div><h3 style={{ margin: "0 0 12px", fontSize: 15, display: "flex", gap: 8, alignItems: "center" }}><Ship size={17} color="#0d7fdd" /> {t("wiz.vesselInfo")}</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  <F label={`${t("wiz.reg")} *`}><div className="inp"><Ship size={15} /><input value={form.boat} onChange={(e) => upd("boat", e.target.value)} placeholder={t("wiz.regPh")} /></div></F>
                  <F label={`${t("wiz.vtype")} *`}><div className="inp"><Ship size={15} /><select value={form.type} onChange={(e) => upd("type", e.target.value)}><option>Pirogue</option><option>Vedette</option><option>Barge</option><option>Ferry</option><option>Chalutier</option><option>Coque</option></select></div></F>
                  <F label={`${t("wiz.capacity")} *`}><div className="inp"><User size={15} /><input value={form.capacity} onChange={(e) => upd("capacity", e.target.value)} inputMode="numeric" /></div></F>
                </div></div>
              <div><h3 style={{ margin: "0 0 12px", fontSize: 15, display: "flex", gap: 8, alignItems: "center" }}><MapPin size={17} color="#0d7fdd" /> {t("wiz.placeDate")}</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <F label={`${t("wiz.place")} *`}><div className="inp"><MapPin size={15} /><select value={form.place} onChange={(e) => upd("place", e.target.value)}><option>Cotonou</option><option>Porto-Novo</option><option>Ouidah</option><option>Sèmè-Kpodji</option><option>Grand-Popo</option><option>Abomey-Calavi</option></select></div></F>
                  <F label={`${t("wiz.dateTime")} *`}><div className="inp"><CalendarDays size={15} /><input value={new Date().toLocaleString(locale)} readOnly /></div></F>
                </div></div>
              <div><h3 style={{ margin: "0 0 12px", fontSize: 15, display: "flex", gap: 8, alignItems: "center" }}><User size={17} color="#0d7fdd" /> {t("wiz.agentBlock")}</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <F label={`${t("wiz.agentNow")} *`}><div className="inp"><User size={15} /><input value={me.data?.name ?? "…"} readOnly /></div></F>
                  <F label={`${t("wiz.owner")} *`}><div className="inp"><User size={15} /><input value={form.owner} onChange={(e) => upd("owner", e.target.value)} placeholder={t("wiz.ownerPh")} /></div></F>
                </div>
                <div style={{ marginTop: 12 }}><F label={`${t("wiz.comments")} (${t("c.optional")})`}><div className="inp"><input value={form.comments} onChange={(e) => upd("comments", e.target.value)} placeholder={t("wiz.commentsPh")} maxLength={200} /></div></F><div style={{ textAlign: "right", fontSize: 11, color: "#8aa3bb" }}>{form.comments.length}/200</div></div></div>
              <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #edf2f7", paddingTop: 14 }}>
                <Link href="/inspections" className="btn-outline-blue" style={{ width: "auto", padding: "0 22px", textDecoration: "none" }}>{t("c.cancel")}</Link>
                <button className="btn-blue" style={{ padding: "0 26px" }} onClick={() => { if (!form.boat.trim() || !form.owner.trim()) { toast.error(t("wiz.errRegOwner")); return; } setStep(1); }}>{t("wiz.next")} →</button>
              </div>
            </div></div>
          )}

          {step === 1 && (
            <div className="mock-card"><div className="mock-card-b" style={{ display: "grid", gap: 16 }}>
              <div><h3 style={{ margin: 0, fontSize: 16, display: "flex", gap: 8, alignItems: "center" }}><Camera size={18} color="#0d7fdd" /> {t("wiz.addPhotos")}</h3><p style={{ margin: "4px 0 0", fontSize: 13, color: "#5b7a96" }}>{t("wiz.addPhotosSub")}</p></div>
              <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 12 }}>
                <label style={{ border: "1.5px dashed #9ec7e8", borderRadius: 14, background: "#f4f9fe", padding: "2rem 1rem", textAlign: "center", cursor: "pointer", display: "grid", gap: 6, placeItems: "center" }}>
                  <CloudUpload size={44} color="#5b8fc4" /><strong style={{ fontSize: 14 }}>{t("wiz.drop")}<br /><span style={{ fontWeight: 500, color: "#0d7fdd" }}>{t("wiz.browse")}</span></strong><small style={{ color: "#7b93a8", fontSize: 11.5 }}>{t("wiz.constraints")}</small>
                  <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={onFiles} style={{ display: "none" }} />
                </label>
                <div style={{ background: "#eef6fd", borderRadius: 14, padding: 16 }}>
                  <strong style={{ fontSize: 13, display: "flex", gap: 7, alignItems: "center", color: "#0d7fdd" }}><Lightbulb size={15} /> {t("wiz.tips")}</strong>
                  <div style={{ marginTop: 10, display: "grid", gap: 8, fontSize: 12.5 }}>{[t("wiz.tip1"), t("wiz.tip2"), t("wiz.tip3"), t("wiz.tip4")].map((c) => <span key={c} style={{ display: "flex", gap: 8, alignItems: "center" }}><Check size={14} color="#0d7fdd" />{c}</span>)}</div>
                </div>
              </div>
              <div><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}><strong style={{ fontSize: 13 }}>{t("wiz.added")} ({photos.length}/10)</strong><button style={{ color: "#0d7fdd", fontSize: 12, fontWeight: 700, display: "inline-flex", gap: 6, alignItems: "center" }} onClick={() => setPhotos([])}><Trash2 size={13} /> {t("wiz.clearAll")}</button></div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10 }}>
                  {photos.map((src, i) => <div key={i} style={{ position: "relative" }}><img src={src} alt="" style={{ width: "100%", height: 84, objectFit: "cover", borderRadius: 10 }} /><button onClick={() => setPhotos((p) => p.filter((_, x) => x !== i))} style={{ position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: "50%", background: "#0a2a5e", color: "#fff", display: "grid", placeItems: "center" }}><X size={12} /></button><span style={{ position: "absolute", bottom: 4, left: 4, width: 22, height: 22, borderRadius: "50%", background: "#0a2a5e", color: "#fff", fontSize: 11, fontWeight: 800, display: "grid", placeItems: "center" }}>{i + 1}</span></div>)}
                  <label style={{ height: 84, border: "1.5px dashed #9ec7e8", borderRadius: 10, display: "grid", placeItems: "center", color: "#0d7fdd", cursor: "pointer", fontSize: 12 }}><span style={{ textAlign: "center" }}><Plus size={20} style={{ margin: "0 auto" }} /><br />{t("wiz.addOne")}</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={onFiles} style={{ display: "none" }} /></label>
                </div></div>
              {aiError && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: 10, fontSize: 13, color: "#b91c1c" }}>{aiError}</div>}
              <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #edf2f7", paddingTop: 14 }}>
                <button className="btn-outline-blue" style={{ width: "auto", padding: "0 22px" }} onClick={() => setStep(0)}><ArrowLeft size={15} /> {t("c.back")}</button>
                <button className="btn-blue" style={{ padding: "0 26px" }} onClick={() => { if (!photos.length) { toast.error(t("wiz.errPhoto")); return; } setStep(2); }}>{t("wiz.next")} →</button>
              </div>
            </div></div>
          )}

          {step === 2 && (
            <div className="mock-card"><div className="mock-card-b" style={{ display: "grid", gap: 18, justifyItems: "center", textAlign: "center" }}>
              <div style={{ width: 190, height: 190, borderRadius: "50%", background: `conic-gradient(#0ea5e9 ${progress}%, #dceefb ${progress}%)`, display: "grid", placeItems: "center" }}>
                <div style={{ width: 158, height: 158, borderRadius: "50%", background: "#fff", display: "grid", placeItems: "center" }}><div><Cpu size={40} color="#0d7fdd" style={{ margin: "0 auto" }} /><div style={{ fontSize: 28, fontWeight: 800, color: "#0a2a5e" }}>{Math.round(progress)}%</div></div></div>
              </div>
              <div style={{ fontWeight: 700, color: "#0a2a5e" }}>{analyzeMut.isPending || createFull.isPending ? t("wiz.running") : t("wiz.ready")}</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, width: "100%", background: "#f4f9fe", borderRadius: 12, padding: 16 }}>
                {[[t("wiz.prep"), analyzeMut.isPending || progress > 15 ? "done" : "todo"], [t("wiz.detect"), progress > 40 ? "done" : "todo"], [t("wiz.anom"), analyzeMut.isPending ? "run" : progress >= 96 ? "done" : "todo"], [t("wiz.eval"), "todo"]].map(([label, st]) => (
                  <div key={label as string} style={{ display: "grid", gap: 6, justifyItems: "center", fontSize: 11.5 }}>
                    <span style={{ width: 26, height: 26, borderRadius: "50%", display: "grid", placeItems: "center", background: st === "done" ? "#16a34a" : st === "run" ? "#0d7fdd" : "#fff", border: st === "todo" ? "2px solid #cbd9e6" : "0", color: "#fff" }}>{st === "done" ? <Check size={14} /> : st === "run" ? <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#fff" }} /> : null}</span>
                    <span style={{ fontWeight: 600, color: "#0a2a5e" }}>{label}</span>
                  </div>
                ))}
              </div>
              {aiError && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: 10, fontSize: 13, color: "#b91c1c", width: "100%" }}>{aiError}</div>}
              <div style={{ background: "#eef6fd", borderRadius: 10, padding: "10px 14px", fontSize: 12.5, color: "#0d7fdd", width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center" }}><span>{t("wiz.aiNote")}</span><span className="bdg bdg-blue">{analyzeMut.isPending ? t("wiz.running") : t("wiz.ready")}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", width: "100%", borderTop: "1px solid #edf2f7", paddingTop: 14 }}>
                <button className="btn-outline-blue" style={{ width: "auto", padding: "0 22px" }} disabled={analyzeMut.isPending} onClick={() => setStep(1)}><ArrowLeft size={15} /> {t("c.back")}</button>
                <button className="btn-blue" style={{ padding: "0 26px" }} disabled={analyzeMut.isPending || createFull.isPending} onClick={() => void analyze()}>{analyzeMut.isPending || createFull.isPending ? `${t("wiz.running")}` : t("wiz.launch")} →</button>
              </div>
            </div></div>
          )}

          {step === 3 && (
            !analysis ? <div className="mock-card"><div className="mock-card-b" style={{ textAlign: "center", color: "#7b93a8" }}>{t("wiz.noResult")}{aiError && <div style={{ marginTop: 10, color: "#b91c1c" }}>{aiError}</div>}<div style={{ marginTop: 12 }}><button className="btn-blue" style={{ padding: "0 22px" }} onClick={() => setStep(2)}>{t("wiz.backToAnalysis")}</button></div></div></div> : (
            <>
              <div className="mock-card"><div className="mock-card-b" style={{ display: "grid", gridTemplateColumns: "280px 1fr 220px", gap: 16 }}>
                <div><div style={{ position: "relative" }}><img src={photos[0] ?? "/boat-inspection.jpg"} alt="" style={{ width: "100%", height: 190, objectFit: "cover", borderRadius: 12 }} /><span style={{ position: "absolute", top: 8, left: 8, background: "rgba(2,20,40,0.75)", color: "#fff", fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 8 }}>📷 {photos.length} photos</span></div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6, marginTop: 8 }}>{photos.slice(0, 5).map((s, i) => <img key={i} src={s} alt="" style={{ width: "100%", height: 44, objectFit: "cover", borderRadius: 8 }} />)}</div></div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}><span className="bdg bdg-green"><Check size={11} /> {t("wiz.done")}</span><span style={{ color: "#7b93a8" }}>{t("wiz.confidence")} {analysis.confidence}%</span></div>
                  <div style={{ width: 150, height: 150, borderRadius: "50%", margin: "12px auto", background: `conic-gradient(#16a34a ${analysis.confidence}%, #eef2f6 ${analysis.confidence}%)`, display: "grid", placeItems: "center" }}><div style={{ width: 118, height: 118, borderRadius: "50%", background: "#fff", display: "grid", placeItems: "center" }}><div><div style={{ fontSize: 26, fontWeight: 800 }}>{analysis.confidence}%</div><div style={{ fontSize: 11, color: "#7b93a8" }}>{t("wiz.confidence")}</div></div></div></div>
                </div>
                <div>
                  <div style={{ background: analysis.riskScore >= 50 ? "#fef2f2" : "#dcfce7", borderRadius: 12, padding: 12, textAlign: "center" }}><small style={{ color: "#7b93a8", fontSize: 11 }}>{t("wiz.globalRisk")}</small><div style={{ fontSize: 22, fontWeight: 800, color: analysis.riskScore >= 75 ? "#b91c1c" : analysis.riskScore >= 50 ? "#c2410c" : "#15803d" }}>{riskWord}</div></div>
                  <div style={{ marginTop: 10, display: "grid", gap: 6, fontSize: 12.5 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}><i style={{ width: 10, height: 10, borderRadius: "50%", background: "#ef4444" }} /> {t("wiz.crit")} <b style={{ marginLeft: "auto" }}>{analysis.riskScore >= 75 ? 1 : 0}</b></div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}><i style={{ width: 10, height: 10, borderRadius: "50%", background: "#f97316" }} /> {t("wiz.maj")} <b style={{ marginLeft: "auto" }}>{analysis.findings.length}</b></div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}><i style={{ width: 10, height: 10, borderRadius: "50%", background: "#f59e0b" }} /> {t("wiz.pass")} <b style={{ marginLeft: "auto" }}>{analysis.passengersDetected}</b></div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}><i style={{ width: 10, height: 10, borderRadius: "50%", background: "#16a34a" }} /> {t("wiz.vests")} <b style={{ marginLeft: "auto" }}>{analysis.lifejacketsVisible}</b></div>
                  </div>
                </div>
              </div></div>
              <div className="mock-card"><div className="mock-card-h"><h3 style={{ color: "#b91c1c" }}>⚠ {t("wiz.anoms")} ({analysis.findings.length})</h3></div>
                <div style={{ padding: "0 12px 12px" }}>
                <table className="mock-table"><thead><tr><th>N°</th><th>{t("wiz.colAnomaly")}</th><th>{t("wiz.colRisk")}</th><th>{t("wiz.colConf")}</th><th>{t("wiz.colStatus")}</th></tr></thead><tbody>
                  {analysis.findings.map((f, i) => <tr key={i}><td>{i + 1}</td><td style={{ fontSize: 12.5 }}>{f}</td><td><span className={`bdg ${analysis.riskScore >= 75 ? "bdg-red" : analysis.riskScore >= 50 ? "bdg-orange" : "bdg-yellow"}`}>{riskWord}</span></td><td>{analysis.confidence}%</td><td><span className="bdg bdg-red">{t("wiz.open")}</span></td></tr>)}
                </tbody></table></div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <button className="btn-outline-blue" style={{ width: "auto", padding: "0 22px" }} onClick={() => setStep(2)}><ArrowLeft size={15} /> {t("c.back")}</button>
                <div style={{ display: "flex", gap: 8 }}>
                  {inspectionId && <button className="btn-outline-blue" style={{ width: "auto", padding: "0 18px" }} onClick={() => navigate(`/inspections/${inspectionId}`)}>{t("wiz.viewFile")}</button>}
                  <button className="btn-blue" style={{ padding: "0 22px" }} disabled={!inspectionId || genReport.isPending} onClick={() => inspectionId && genReport.mutate({ inspectionId })}>{genReport.isPending ? t("wiz.generating") : `${t("wiz.genReport")} →`}</button>
                </div>
              </div>
            </>
            )
          )}
        </div>

        <div className="mock-side">
          <div className="mock-detail">
            <h3>{step === 0 ? t("wiz.recap") : t("wiz.recapFull")}</h3>
            <img src={photos[0] ?? "/boat-inspection.jpg"} alt="" style={{ width: "100%", height: 150, objectFit: "cover", borderRadius: 12 }} />
            <div className="mock-kv"><Ship size={15} /><div><small>{t("wiz.fVessel")}</small><strong>{form.boat || "-"}</strong></div></div>
            <div className="mock-kv"><Ship size={15} /><div><small>{t("wiz.fType")}</small><strong>{form.type}</strong></div></div>
            <div className="mock-kv"><User size={15} /><div><small>{t("wiz.fCap")}</small><strong>{form.capacity} {t("wiz.pax")}</strong></div></div>
            <div className="mock-kv"><MapPin size={15} /><div><small>{t("wiz.fPlace")}</small><strong>{form.place}</strong></div></div>
            <div className="mock-kv"><CalendarDays size={15} /><div><small>{t("wiz.fDate")}</small><strong>{new Date().toLocaleString(locale)}</strong></div></div>
            <div className="mock-kv"><User size={15} /><div><small>{t("wiz.fAgent")}</small><strong>{me.data?.name ?? "…"}</strong></div></div>
            {step >= 2 && analysis && (
              <>
                <div className="mock-kv"><Info size={15} /><div><small>{t("wiz.riskEval")}</small><strong style={{ color: analysis.riskScore >= 50 ? "#b91c1c" : "#15803d" }}>{analysis.riskScore}/100 · {riskWord}</strong></div></div>
                <div style={{ fontSize: 12, color: "#0a2a5e" }}><strong>{t("wiz.recos")}</strong><p style={{ margin: "6px 0 0", color: "#5b7a96" }}>{analysis.recommendation}</p></div>
              </>
            )}
            <div style={{ background: "#eef6fd", borderRadius: 10, padding: 10, fontSize: 12, color: "#0d7fdd", display: "flex", gap: 8 }}><Info size={15} style={{ flexShrink: 0, marginTop: 1 }} />{step === 0 ? t("wiz.infoNext") : step === 1 ? t("wiz.photosNext") : t("wiz.wait")}</div>
            {step === 0 && <div style={{ border: "1px solid #e3ecf4", borderRadius: 10, padding: 10, fontSize: 12 }}><strong style={{ display: "flex", gap: 6, alignItems: "center" }}><Lightbulb size={14} color="#0d7fdd" /> {t("wiz.tipTitle")}</strong><p style={{ margin: "6px 0 0", color: "#5b7a96" }}>{t("wiz.tipText")}</p></div>}
          </div>
        </div>
      </div>

      <style>{`.inp{display:flex;align-items:center;gap:8px;border:1.5px solid #d9e6f2;border-radius:10px;padding:0 12px;height:46px;background:#fff}.inp input,.inp select{flex:1;border:0;outline:0;font-size:13.5px;background:transparent;color:#0a2a5e}.inp svg{color:#5b7a96;flex-shrink:0}`}</style>
    </AppShell>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, fontWeight: 700, color: "#0a2a5e" }}>{label}{children}</label>;
}
