import { ChangeEvent, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Camera, Check, ChevronDown, ChevronRight, FileText, Info, Lightbulb, MapPin, Mic, Plus, ShipWheel, Square, Trash2, UploadCloud, UserRound } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";

const steps = ["Informations", "Photos", "Analyse", "Resultat"];
type Analysis = { passengersDetected: number; lifejacketsVisible: number; capacityRisk: string; riskScore: number; confidence: number; hull: string; engine: string; findings: string[]; recommendation: string; uncertainty: string[] };

async function toDataUrl(src: string): Promise<string> {
  if (src.startsWith("data:")) return src;
  const response = await fetch(src);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default function NewInspection() {
  const [step, setStep] = useState(0);
  const [photos, setPhotos] = useState<string[]>([]);
  const [form, setForm] = useState({ boat: "", type: "Pirogue", capacity: "30", place: "Porto-Novo", agent: "", comments: "" });
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [report, setReport] = useState("");
  const [aiError, setAiError] = useState("");
  const [inspectionId, setInspectionId] = useState<number | null>(null);

  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const onFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const accepted = Array.from(event.target.files ?? []).filter((file) => ["image/jpeg", "image/png", "image/webp"].includes(file.type) && file.size <= 10 * 1024 * 1024).slice(0, 10 - photos.length);
    if (accepted.length !== (event.target.files?.length ?? 0)) setAiError("Certaines images ont été refusees : formats JPG/PNG/WebP et taille maximale de 10 Mo.");
    setPhotos((current) => [...current, ...accepted.map((file) => URL.createObjectURL(file))]);
    event.target.value = "";
  };

  const removePhoto = (index: number) => setPhotos((current) => current.filter((_, i) => i !== index));

  const createVesselMutation = trpc.data.vessels.create.useMutation();
  const createInspectionMutation = trpc.data.inspections.create.useMutation();
  const uploadImageMutation = trpc.data.inspections.uploadImage.useMutation();
  const saveAnalysisMutation = trpc.data.inspections.saveAnalysis.useMutation();
  const analyzeMutation = trpc.ai.analyzeInspection.useMutation();
  const reportMutation = trpc.ai.generateReport.useMutation();

  const prepareInspection = async () => {
    if (inspectionId) return inspectionId;
    if (!form.boat.trim() || !form.place || !form.agent) throw new Error("Renseignez l'immatriculation, le lieu et l'agent responsable.");
    const vessel = await createVesselMutation.mutateAsync({ registrationNumber: form.boat.trim(), name: form.boat.trim(), type: form.type, ownerName: form.agent, capacity: Number(form.capacity) || 0, place: form.place, status: "conforme", riskScore: 0 });
    const created = await createInspectionMutation.mutateAsync({ vesselId: vessel.id, place: form.place, inspectionDate: new Date(), comments: form.comments, passengersDetected: 0, lifejacketsVisible: 0 });
    setInspectionId(created.id);
    const storedImages = await Promise.all((await Promise.all(photos.slice(0, 10).map(toDataUrl))).map((dataUrl) => uploadImageMutation.mutateAsync({ inspectionId: created.id, dataUrl, imageType: "inspection" })));
    toast.success("Inspection #" + created.id + " cree", { description: storedImages.length + " photo(s) stockee(s) de facon securisee." });
    return created.id;
  };

  const analyze = async () => {
    setAiError("");
    try {
      const id = await prepareInspection();
      const images = await Promise.all(photos.slice(0, 5).map(toDataUrl));
      const result = await analyzeMutation.mutateAsync({ boat: form.boat, type: form.type, capacity: Number(form.capacity) || 0, place: form.place, images });
      await saveAnalysisMutation.mutateAsync({ inspectionId: id, analysis: result });
      setAnalysis(result);
      setStep(3);
      toast.success("Analyse IA enregistree", { description: "Le resultat est disponible dans le dossier d'inspection." });
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "Analyse IA indisponible. Verifiez la configuration Baseten.");
    }
  };

  const generateReport = async () => {
    if (!analysis) return;
    setAiError("");
    try {
      const result = await reportMutation.mutateAsync({ boat: form.boat, type: form.type, capacity: Number(form.capacity) || 0, place: form.place, agent: form.agent, analysis: analysis as any });
      setReport(result);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "Generation du rapport indisponible.");
    }
  };

  const goNext = () => {
    if (step === 1) setStep(2);
    else if (step === 2) void analyze();
    else setStep((s) => Math.min(3, s + 1));
  };

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <Link href="/" className="back-link"><ArrowLeft size={16} /> Retour</Link>
          <h1 className="page-title">Nouvelle inspection</h1>
          <p className="page-subtitle">Renseignez les informations et obtenez un diagnostic explicable par IA.</p>
        </div>
      </div>
      <div className="stepper">
        {steps.map((label, index) => (
          <div key={label} className={`step ${index === step ? "current" : ""} ${index < step ? "done" : ""}`}>
            <span>{index < step ? <Check size={16} /> : index + 1}</span>
            <strong>{label}</strong>
            {index < steps.length - 1 && <i />}
          </div>
        ))}
      </div>
      <div className="inspection-layout">
        <section className="panel form-panel">
          {step === 0 && <InfoStep form={form} update={update} photos={photos} onFiles={onFiles} removePhoto={removePhoto} />}
          {step === 1 && <PhotosStep photos={photos} onFiles={onFiles} removePhoto={removePhoto} />}
          {step === 2 && <AnalysisStep summary={{ ...form, count: photos.length }} isLoading={analyzeMutation.isPending} error={aiError} onAnalyze={analyze} />}
          {step === 3 && <ResultStep summary={{ ...form, count: photos.length }} analysis={analysis} report={report} isLoading={reportMutation.isPending} error={aiError} onReport={generateReport} />}
          <div className="form-footer">
            {step > 0 ? <button className="btn btn-secondary" onClick={() => setStep((s) => s - 1)}><ArrowLeft size={17} /> Retour</button> : <Link href="/" className="btn btn-secondary">Annuler</Link>}
            {step === 2 ? <button className="btn btn-primary" disabled={analyzeMutation.isPending} onClick={goNext}>{analyzeMutation.isPending ? "Analyse en cours…" : "Analyser avec Muse Spark"}<ArrowRight size={17} /></button> : step < 3 ? <button className="btn btn-primary" onClick={goNext}>Suivant<ArrowRight size={17} /></button> : analysis && analysis.lifejacketsVisible < analysis.passengersDetected ? <button className="btn btn-primary blocked-action" disabled title="Validation bloquée : tous les passagers doivent disposer d'un gilet">Validation bloquée <Info size={17} /></button> : <Link href="/" className="btn btn-primary">Terminer <Check size={17} /></Link>}
          </div>
        </section>
        <section className="panel summary-panel">
          <SummaryCard summary={{ ...form, count: photos.length }} photos={photos} />
        </section>
      </div>
    </AppShell>
  );
}

function InfoStep({ form, update, photos, onFiles, removePhoto }: { form: any; update: (key: any, value: string) => void; photos: string[]; onFiles: (event: ChangeEvent<HTMLInputElement>) => void; removePhoto: (index: number) => void }) {
  return (
    <>
      <div className="section-title"><ShipWheel size={21} /><div><h2>Informations de l'embarcation</h2><p>Identifiez l'embarcation et le contexte de la mission.</p></div></div>
      <div className="field-grid three">
        <Field label="Nom ou immatriculation *" icon={<ShipWheel size={16} />} value={form.boat} onChange={(e) => update("boat", e.target.value)} />
        <label className="field"><span>Type d'embarcation *</span><div className="select-wrap"><ShipWheel size={16} /><select value={form.type} onChange={(e) => update("type", e.target.value)}><option>Pirogue</option><option>Vedette</option><option>Barge</option><option>Ferry</option></select><ChevronDown size={15} /></div></label>
        <Field label="Capacite de passagers *" icon={<UserRound size={16} />} value={form.capacity} onChange={(e) => update("capacity", e.target.value)} />
      </div>
      <div className="form-separator" />
      <div className="section-title"><MapPin size={21} /><div><h2>Lieu et date de l'inspection</h2></div></div>
      <div className="field-grid two">
        <label className="field"><span>Lieu *</span><div className="select-wrap"><MapPin size={16} /><select value={form.place} onChange={(e) => update("place", e.target.value)}><option>Porto-Novo</option><option>Cotonou</option><option>Ouidah</option><option>Seme-Kpodji</option></select><ChevronDown size={15} /></div></label>
        <Field label="Date et heure *" icon={<CalendarDays size={16} />} value="29/10/2025 14:32" readOnly />
      </div>
      <div className="form-separator" />
      <div className="section-title"><UserRound size={21} /><div><h2>Agent responsable</h2></div></div>
      <div className="field-grid two">
        <label className="field"><span>Selectionner un agent *</span><div className="select-wrap"><UserRound size={16} /><select value={form.agent} onChange={(e) => update("agent", e.target.value)}><option>Thomas ADJE</option><option>Adelaide HOUND</option><option>Koffi DOSSA</option></select><ChevronDown size={15} /></div></label>
        <Field label="Commentaires" icon={<FileText size={16} />} value={form.comments} onChange={(e) => update("comments", e.target.value)} />
      </div>
    </>
  );
}

function PhotosStep({ photos, onFiles, removePhoto }: { photos: string[]; onFiles: (event: ChangeEvent<HTMLInputElement>) => void; removePhoto: (index: number) => void }) {
  return (
    <>
      <div className="section-title"><Camera size={21} /><div><h2>Ajouter des photographies</h2><p>Prenez des photos claires ou importez des images de l'embarcation.</p></div></div>
      <div className="upload-advice">
        <label className="dropzone"><UploadCloud size={42} /><strong>Glissez vos photos ici</strong><span>ou cliquez pour parcourir</span><small>JPG, PNG · Max 10 Mo · Jusqu'à 10 photos</small><input type="file" accept="image/jpeg,image/png" multiple onChange={onFiles} /></label>
        <div className="advice-box"><Lightbulb size={22} /><strong>Conseils</strong><span><Check size={15} /> Photos bien eclairees</span><span><Check size={15} /> Plusieurs angles</span><span><Check size={15} /> Details importants</span><span><Check size={15} /> Eviter les flous</span></div>
      </div>
      <div className="form-separator" />
      <div className="photos-added">
        <h3>Photos ajoutees ({photos.length}/10)</h3>
        <button onClick={() => photos.forEach((_, i) => removePhoto(i))}><Trash2 size={15} /> Tout supprimer</button>
      </div>
      <PhotoStrip photos={photos} onFiles={onFiles} removePhoto={removePhoto} />
    </>
  );
}

function AnalysisStep({ summary, isLoading, error, onAnalyze }: { summary: any; isLoading: boolean; error: string; onAnalyze: () => void }) {
  return (
    <div className="analysis-state">
      <div className="analysis-orb"><ShipWheel size={34} /></div>
      <h2>{isLoading ? "Analyse IA en cours…" : "Analyse prête à demarrer"}</h2>
      <p>Les photos de <strong>{summary.boat}</strong> seront envoyées de façon sécurisée à Muse Spark Open pour détecter les passagers, gilets, coque et moteur.</p>
      {isLoading && (<><div className="analysis-progress"><span style={{ width: "72%" }} /></div><small>Lecture des elements visibles · traitement securise</small></>)}
      {error && <div className="ai-error"><Info size={17} /> {error}</div>}
      <div className="analysis-note"><Info size={18} /> L'IA propose, l'humain decide. Vous pourrez corriger chaque comptage.</div>
      <button className="btn btn-primary ai-cta" disabled={isLoading} onClick={onAnalyze}>{isLoading ? "Connexion a Baseten…" : "Lancer l'analyse IA"}</button>
    </div>
  );
}

function ResultStep({ summary, analysis, report, isLoading, error, onReport }: { summary: any; analysis: Analysis | null; report: string; isLoading: boolean; error: string; onReport: () => void }) {
  const result = analysis ?? { passengersDetected: 12, lifejacketsVisible: 8, confidence: 82, riskScore: 74, capacityRisk: "élevé", findings: ["Résultat de démonstration"], recommendation: "Vérifier les éléments avant validation." };
  return (
    <div className="result-state">
      <div className="result-top">
        <div>
          <span className="eyebrow">Diagnostic Muse Spark Open</span>
          <h2>Inspection analysée</h2>
          <p>{summary.boat} · {summary.place}</p>
        </div>
        <span className="tag badge-neutral">{result.capacityRisk}</span>
      </div>
      <div className="result-metrics">
        <div><strong>{result.passengersDetected}</strong><span>Passagers détectés</span></div>
        <div><strong>{result.lifejacketsVisible}</strong><span>Gilets visibles</span></div>
        <div><strong>{result.confidence}%</strong><span>Confiance IA</span></div>
      </div>
      <div className={`result-warning ${result.lifejacketsVisible < result.passengersDetected ? "safety-block" : ""}`}><span>!</span><div><strong>Score de risque : {result.riskScore}/100</strong><p>{result.findings?.join(" · ") || "Aucune anomalie textuelle retournée."}</p><p>{result.recommendation}</p>{result.lifejacketsVisible < result.passengersDetected && <p><strong>Départ bloqué :</strong> le ratio de gilets est inférieur à 100 %.</p>}</div></div>
      {error && <div className="ai-error"><Info size={17} /> {error}</div>}
      {report ? <div className="report-generated"><FileText size={17} /><div><strong>Rapport généré</strong><p>{report}</p></div></div> : <button className="btn btn-secondary" disabled={isLoading} onClick={onReport}><FileText size={17} /> {isLoading ? "Génération…" : "Générer le rapport officiel"}</button>}
    </div>
  );
}

function VoiceMemo({ onTranscript }: { onTranscript: (value: string) => void }) {
  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const voiceMutation = trpc.ai.analyzeVoiceAlert.useMutation();
  const toggle = async () => {
    if (recording && recorder.current) { recorder.current.stop(); setRecording(false); return; }
    if (!navigator.mediaDevices?.getUserMedia) { setStatus("Microphone indisponible sur cet appareil."); return; }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    chunks.current = [];
    mediaRecorder.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data); };
    mediaRecorder.onstop = async () => {
      stream.getTracks().forEach((track) => track.stop());
      const blob = new Blob(chunks.current, { type: "audio/webm" });
      const reader = new FileReader();
      reader.onload = async () => {
        setStatus("Transcription IA en cours…");
        try {
          const result = await voiceMutation.mutateAsync({ audioDataUrl: String(reader.result) });
          onTranscript(result.transcript);
          setStatus("Observation ajoutée au rapport.");
        } catch { setStatus("Transcription indisponible, réessayez."); }
      };
      reader.readAsDataURL(blob);
    };
    recorder.current = mediaRecorder;
    mediaRecorder.start();
    setRecording(true);
    setStatus("Dictée en cours… cliquez pour arrêter.");
  };
  return (
    <div className="voice-memo">
      <button type="button" className={recording ? "voice-recording" : "voice-button"} onClick={() => void toggle()} disabled={voiceMutation.isPending}>{recording ? <Square size={15} /> : <Mic size={15} />} {recording ? "Arreter la dictée" : "Dicter une observation"}</button>
      {status && <span>{status}</span>}
    </div>
  );
}

function Field({ label, icon, value, onChange, readOnly }: { label: string; icon: React.ReactNode; value: string; onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void; readOnly?: boolean }) {
  return (
    <label className="field"><span>{label}</span><div className="input-wrap">{icon}<input value={value} onChange={onChange} readOnly={readOnly} /></div></label>
  );
}

function PhotoStrip({ photos, onFiles, removePhoto, compact }: { photos: string[]; onFiles: (event: ChangeEvent<HTMLInputElement>) => void; removePhoto: (index: number) => void; compact?: boolean }) {
  return (
    <div className={`photo-strip ${compact ? "compact" : ""}`}>
      {photos.map((src, index) => (
        <div key={`${src}-${index}`} className="photo-thumb">
          <img src={src} alt={`Photo ${index + 1}`} />
          <button onClick={() => removePhoto(index)} aria-label="Supprimer la photo"><span>×</span></button>
          <b>{index + 1}</b>
        </div>
      ))}
      <label className="add-photo"><Plus size={25} /><span>Ajouter une photo</span><input type="file" accept="image/jpeg,image/png" multiple onChange={onFiles} /></label>
    </div>
  );
}

function SummaryCard({ summary, photos }: { summary: any; photos: string[] }) {
  return (
    <aside className="panel summary-card">
      <div className="section-title"><FileText size={20} /><h2>Recapitulatif</h2></div>
      <img className="summary-image" src={photos[0] || "/boat-inspection.jpg"} alt="Embarcation sélectionnée" />
      <SummaryRow icon={<ShipWheel size={17} />} label="Embarcation" value={summary.boat} />
      <SummaryRow icon={<ShipWheel size={17} />} label="Type" value={summary.type} />
      <SummaryRow icon={<UserRound size={17} />} label="Capacite" value={`${summary.capacity} passagers`} />
      <SummaryRow icon={<MapPin size={17} />} label="Lieu" value={summary.place} />
      <SummaryRow icon={<CalendarDays size={17} />} label="Date et heure" value="29/10/2025 · 14:32" />
      <SummaryRow icon={<UserRound size={17} />} label="Agent" value={summary.agent} />
      <div className="info-callout"><Info size={17} /> Les informations peuvent être modifiées à la prochaine étape.</div>
      <div className="tip-card"><Lightbulb size={19} /><div><strong>Conseil</strong><p>Prenez des photos claires de l'embarcation, de l'intérieur et de la zone de vie.</p></div></div>
    </aside>
  );
}

function SummaryRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="summary-row">{icon}<div><small>{label}</small><strong>{value}</strong></div></div>
  );
}
