import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import {
  AlertTriangle, Anchor, ArrowLeft, Bell, ChevronRight, Clock3, CheckCheck, Edit3, FileCheck2, FileText, Filter, History, MapPin, Mic, Plus, Search, Send, ShieldCheck, Siren, Trash2, UserPlus, Users, X,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";

type ModalMode = { type: "detail" | "edit" | "delete" | "create"; id?: string | number } | null;

function PageHead({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="page-header">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1 className="page-title">{title}</h1>
        <p className="page-subtitle">{description}</p>
      </div>
      {action}
    </div>
  );
}

function Toolbar({ placeholder = "Rechercher...", onChange }: { placeholder?: string; onChange?: (value: string) => void }) {
  return (
    <div className="module-toolbar">
      <div className="table-search" style={{ width: 320, position: "relative" }}>
        <Search size={16} style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "var(--ng-text-muted)" }} />
        <input placeholder={placeholder} onChange={(event) => onChange?.(event.target.value)} className="input" style={{ paddingLeft: "2.5rem" }} />
      </div>
      <button className="btn btn-secondary" style={{ height: "auto", padding: "0 1rem", fontSize: "13px" }}>
        <Filter size={15} /> Filtres avances
      </button>
    </div>
  );
}

function ActionButton({ children, onClick, secondary = false, danger = false, disabled = false }: { children: React.ReactNode; onClick?: () => void; secondary?: boolean; danger?: boolean; disabled?: boolean }) {
  return (
    <button className={`btn ${secondary ? "btn-secondary" : "btn-primary"} ${danger ? "btn-danger" : ""}`} disabled={disabled} onClick={() => { onClick?.(); if (danger) toast.error("Action destructive confirmee"); else toast.success("Action prise en compte"); }}>
      {children}
    </button>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={onClose}><X size={18} /></button>
        {children}
      </div>
    </div>
  );
}

/* ===================== ALERTES ===================== */
export function AlertsPage() {
  const utils = trpc.useUtils();
  const query = trpc.data.alerts.list.useQuery(undefined, { refetchOnWindowFocus: false });
  const update = trpc.data.alerts.update.useMutation({ onSuccess: () => { utils.data.alerts.list.invalidate(); toast.success("Statut de l'alerte mis a jour"); }, onError: (err: unknown) => toast.error("Echec : " + String((err as { message?: string })?.message ?? err)) });
  const create = trpc.data.alerts.create.useMutation({ onSuccess: () => { utils.data.alerts.list.invalidate(); toast.success("Alerte enregistree"); }, onError: (err: unknown) => toast.error("Echec : " + String((err as { message?: string })?.message ?? err)) });

  const [filter, setFilter] = useState("");
  const [modal, setModal] = useState<ModalMode>(null);
  const alerts = (query.data ?? []).filter((a) => `${a.title ?? ""} ${a.place ?? ""} ${a.vesselId ?? ""}`.toLowerCase().includes(filter.toLowerCase()));

  return (
    <AppShell>
      <PageHead eyebrow="Centre de commandement" title="Centre d’alertes" description="Traitez les signalements par ordre d’urgence et gardez une chaine de responsabilite claire." />
      <div className="kpi-row">
        <div className="kpi-card"><div className="kpi-icon" style={{ backgroundColor: "#fee2e2" }}><Siren size={20} /></div><div className="kpi-content"><span className="kpi-label">Nouvelles alertes</span><strong className="kpi-value">{alerts.filter((a) => a.status === "nouvelle").length}</strong></div></div>
        <div className="kpi-card"><div className="kpi-icon" style={{ backgroundColor: "#fef3c7" }}><AlertTriangle size={20} /></div><div className="kpi-content"><span className="kpi-label">Urgences critiques</span><strong className="kpi-value">{alerts.filter((a) => a.urgency === "urgent" || a.urgency === "detresse").length}</strong></div></div>
        <div className="kpi-card"><div className="kpi-icon" style={{ backgroundColor: "#dbeafe" }}><Clock3 size={20} /></div><div className="kpi-content"><span className="kpi-label">Delai moyen</span><strong className="kpi-value">18 min</strong></div></div>
        <div className="kpi-card"><div className="kpi-icon" style={{ backgroundColor: "#dcfce7" }}><Users size={20} /></div><div className="kpi-content"><span className="kpi-label">Affectees</span><strong className="kpi-value">{alerts.filter((a) => a.assignedTo).length}</strong></div></div>
      </div>
      <div className="card">
        <Toolbar placeholder="Rechercher une alerte, une embarcation, un agent…" onChange={setFilter} />
        <div className="card-body" style={{ paddingTop: 0, display: "flex", flexDirection: "column", gap: 0 }}>
          {alerts.map((alert) => (
            <div key={alert.id} style={{ display: "flex", alignItems: "center", gap: 0.75, padding: "1rem", borderBottom: "1px solid var(--ng-line)", cursor: "pointer", transition: "all 0.15s" }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: alert.urgency === "urgent" || alert.urgency === "detresse" ? "#fee2e2" : alert.urgency === "elevee" ? "#fef3c7" : "#e0f2fe", color: alert.urgency === "urgent" || alert.urgency === "detresse" ? "var(--ng-danger)" : alert.urgency === "elevee" ? "var(--ng-warning)" : "var(--ng-info)", fontSize: 16 }}>
                <AlertTriangle size={18} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 0.25 }}>
                  <strong style={{ fontSize: "13px", color: "var(--ng-text)" }}>{alert.title}</strong>
                  <span style={{ fontSize: "11px", color: "var(--ng-text-muted)" }}>{alert.place} · {new Date(alert.createdAt).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <span style={{ fontSize: "11px", fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.05em" }}>{alert.urgency}</span>
                  <span style={{ fontSize: "11px", fontWeight: 600, color: alert.status === "nouvelle" ? "var(--ng-success)" : alert.status === "resolue" ? "var(--ng-info)" : "var(--ng-warning)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{alert.status}</span>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <button className="icon-btn" title="Voir le detail" onClick={() => setModal({ type: "detail", id: alert.id })}><ChevronRight size={14} /></button>
                <button className="icon-btn" title="Affecter / traiter" onClick={() => update.mutate({ id: alert.id, patch: { status: alert.status === "nouvelle" ? "en_cours" : "nouvelle" } })}>
                  {alert.status === "nouvelle" ? "Traiter" : "Reouvrir"}
                </button>
              </div>
            </div>
          ))}
          {alerts.length === 0 && (
            <div style={{ padding: "2rem", textAlign: "center", color: "var(--ng-text-muted)" }}>Aucune alerte trouvee</div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

/* ===================== RAPPORTS ===================== */
export function ReportsPage() {
  const utils = trpc.useUtils();
  const query = trpc.data.reports.list.useQuery(undefined, { refetchOnWindowFocus: false });
  const [filter, setFilter] = useState("");
  const [modal, setModal] = useState<ModalMode>(null);
  const reports = (query.data ?? []).filter((r) => `${r.reference ?? ""} ${r.content?.slice(0, 60) ?? ""}`.toLowerCase().includes(filter.toLowerCase()));

  return (
    <AppShell>
      <PageHead eyebrow="Rapports officiels" title="Rapports officiels" description="Consultez, editez et validez les rapports d’inspection avec tracabilite complete." action={<ActionButton onClick={() => setModal({ type: "create" })}><Plus size={17} /> Generer un rapport</ActionButton>} />
      <div className="kpi-row">
        <div className="kpi-card"><div className="kpi-icon" style={{ backgroundColor: "#fef3c7" }}><FileText size={20} /></div><div className="kpi-content"><span className="kpi-label">A valider</span><strong className="kpi-value">{reports.filter((r) => r.status === "a_valider").length}</strong></div></div>
        <div className="kpi-card"><div className="kpi-icon" style={{ backgroundColor: "#f1f5f9" }}><Clock3 size={20} /></div><div className="kpi-content"><span className="kpi-label">Brouillons</span><strong className="kpi-value">{reports.filter((r) => r.status === "brouillon").length}</strong></div></div>
        <div className="kpi-card"><div className="kpi-icon" style={{ backgroundColor: "#dcfce7" }}><FileCheck2 size={20} /></div><div className="kpi-content"><span className="kpi-label">Valides visibles</span><strong className="kpi-value">{reports.filter((r) => r.status === "valide").length}</strong></div></div>
      </div>
      <div className="card">
        <Toolbar placeholder="Rechercher reference, bateau, responsable…" onChange={setFilter} />
        <div className="card-body" style={{ paddingTop: 0, overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr><th>Reference</th><th>Inspection</th><th>Statut</th><th>Cree le</th><th>Valide par</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id}>
                  <td><strong>{report.reference}</strong></td>
                  <td>Inspection #{report.inspectionId ?? "—"}</td>
                  <td><span className={`badge ${report.status === "valide" ? "badge-success" : report.status === "brouillon" ? "badge-warning" : "badge-info"}`}>{report.status}</span></td>
                  <td>{new Date(report.createdAt).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" })}</td>
                  <td>{report.validatedBy ?? "—"}</td>
                  <td><div style={{ display: "flex", gap: 0.5 }}><button className="icon-btn" onClick={() => setModal({ type: "detail", id: report.id })}><ChevronRight size={17} /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}

/* ===================== EMBARCATIONS ===================== */
export function VesselsPage() {
  const utils = trpc.useUtils();
  const query = trpc.data.vessels.list.useQuery(undefined, { refetchOnWindowFocus: false });
  const [filter, setFilter] = useState("");
  const [modal, setModal] = useState<ModalMode>(null);
  const vessels = (query.data ?? []).filter((v) => `${v.registrationNumber ?? ""} ${v.name ?? ""} ${v.ownerName ?? ""} ${v.place ?? ""}`.toLowerCase().includes(filter.toLowerCase()));

  return (
    <AppShell>
      <PageHead eyebrow="Embarcations suivies" title="Embarcations suivies" description="Retrouvez l’historique de conformite des embarcations controlee." action={<ActionButton onClick={() => setModal({ type: "create" })}><Plus size={17} /> Ajouter une embarcation</ActionButton>} />
      <div className="card">
        <Toolbar placeholder="Rechercher immatriculation, proprietaire, zone…" onChange={setFilter} />
        <div className="card-body" style={{ paddingTop: 0, overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr><th>Immatriculation</th><th>Nom</th><th>Type</th><th>Proprietaire</th><th>Zone</th><th>Statut</th><th>Score risque</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {vessels.map((vessel) => (
                <tr key={vessel.id}>
                  <td><strong>{vessel.registrationNumber}</strong></td>
                  <td>{vessel.name}</td>
                  <td>{vessel.type}</td>
                  <td>{vessel.ownerName}</td>
                  <td>{vessel.place}</td>
                  <td><span className={`badge ${vessel.status === "conforme" ? "badge-success" : "badge-warning"}`}>{vessel.status}</span></td>
                  <td>{vessel.riskScore}</td>
                  <td><div style={{ display: "flex", gap: 0.5 }}><button className="icon-btn" onClick={() => setModal({ type: "detail", id: vessel.id })}><ChevronRight size={17} /></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}

/* ===================== AUDIT ===================== */
export function AuditPage() {
  const [filter, setFilter] = useState("");
  const query = trpc.data.audit.list.useQuery();
  const filtered = (query.data ?? []).filter((item) => `${item.action} ${item.entityType} ${item.entityId ?? ""}`.toLowerCase().includes(filter.toLowerCase()));
  return (
    <AppShell>
      <PageHead eyebrow="Journal d’audit" title="Journal d’audit" description="Tracez les actions sensibles et les decisions de la plateforme." />
      <div className="card">
        <Toolbar placeholder="Rechercher une action ou un objet…" onChange={setFilter} />
        <div className="card-body" style={{ paddingTop: 0, display: "flex", flexDirection: "column", gap: 0 }}>
          {filtered.map((item) => (
            <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 0.75, padding: "1rem", borderBottom: "1px solid var(--ng-line)" }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#f1f5f9", color: "var(--ng-blue)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
                <History size={18} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 0.25 }}>
                  <strong style={{ fontSize: "13px", color: "var(--ng-text)" }}>{item.action}</strong>
                  <span style={{ fontSize: "11px", color: "var(--ng-text-muted)" }}>{new Date(item.createdAt).toLocaleString("fr-FR")}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <span style={{ fontSize: "11px", color: "var(--ng-text-muted)" }}>{item.entityType}</span>
                  <span style={{ fontSize: "11px", color: "var(--ng-text-muted)" }}>#{item.entityId ?? "—"}</span>
                </div>
              </div>
              <span className="badge badge-neutral">Audit</span>
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: "2rem", textAlign: "center", color: "var(--ng-text-muted)" }}>Aucune activite recente</div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

/* ===================== UTILISATEURS ===================== */
export function UsersPage() {
  const utils = trpc.useUtils();
  const usersQuery = trpc.localAuth.users.list.useQuery(undefined, { retry: false });
  const changeRole = trpc.localAuth.users.changeRole.useMutation({ onSuccess: async () => { await utils.localAuth.users.list.invalidate(); toast.success("Role mis a jour"); } });
  const setActive = trpc.localAuth.users.setActive.useMutation({ onSuccess: async () => { await utils.localAuth.users.list.invalidate(); toast.success("Statut du compte mis a jour"); } });
  const [add, setAdd] = useState(false);
  const [filter, setFilter] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [appRole, setAppRole] = useState("agent");
  const users = usersQuery.data ?? [];
  const visible = users.filter((user) => `${user.name ?? ""} ${user.email ?? ""} ${user.appRole}`.toLowerCase().includes(filter.toLowerCase()));
  return (
    <AppShell>
      <PageHead eyebrow="Controle des acces" title="Utilisateurs" description="Gerrez les comptes, les roles et les acces depuis la base serveur securisee." action={<ActionButton onClick={() => setAdd(true)}><UserPlus size={17} /> Ajouter un utilisateur</ActionButton>} />
      {usersQuery.error && <div className="ai-error">{usersQuery.error.message}</div>}
      <div className="card">
        <Toolbar placeholder="Rechercher un nom, un role…" onChange={setFilter} />
        <div className="card-body" style={{ paddingTop: 0, display: "flex", flexDirection: "column", gap: 0 }}>
          {visible.map((user) => (
            <div key={user.id} style={{ display: "flex", alignItems: "center", gap: 1, padding: "1rem", borderBottom: "1px solid var(--ng-line)" }}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#e0f2fe", color: "var(--ng-blue)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14 }}>
                {((user.name ?? "NG").split(" ").map((part) => part[0]).join("")).slice(0, 2)}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: "var(--ng-text)", fontSize: "14px" }}>{user.name ?? "Utilisateur"}</div>
                <div style={{ fontSize: "13px", color: "var(--ng-text-muted)" }}>{user.email ?? "—"}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 0.5, fontSize: "12px" }}>
                <span className={`badge ${user.appRole === "admin" ? "badge-danger" : user.appRole === "supervisor" ? "badge-warning" : "badge-info"}`}>{user.appRole}</span>
                <span style={{ fontSize: "11px", color: user.isActive ? "var(--ng-success)" : "var(--ng-text-muted)" }}>{user.isActive ? "Actif" : "Suspendu"}</span>
              </div>
              <div style={{ display: "flex", gap: 0.5 }}>
                <select className="input" style={{ height: "auto", padding: "0 0.75", fontSize: "13", minWidth: 140 }} value={user.appRole} onChange={(event) => changeRole.mutate({ id: user.id, appRole: event.target.value as "agent" | "supervisor" | "admin" | "observer" })}>
                  <option value="agent">Agent d’inspection</option>
                  <option value="supervisor">Superviseur</option>
                  <option value="admin">Administrateur</option>
                  <option value="observer">Observateur</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>
      {add && (
        <Modal onClose={() => setAdd(false)}>
          <div className="modal-header"><span className="eyebrow">Controle des acces</span><h2 style={{ margin: "0.25rem 0 0", fontSize: "18px", fontWeight: 800, color: "var(--ng-text)" }}>Creer un compte serveur</h2></div>
          <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <label className="field"><span>Nom complet</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Prenom NOM" className="input" /></label>
            <label className="field"><span>Adresse e-mail</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nom@navigarde.bj" className="input" /></label>
            <label className="field"><span>Mot de passe temporaire</span><input type="password" minLength={12} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="… (12 min)" className="input" /></label>
            <label className="field"><span>Role</span><select value={appRole} onChange={(e) => setAppRole(e.target.value as "agent" | "supervisor" | "admin" | "observer")} className="input"><option value="agent">Agent d’inspection</option><option value="supervisor">Superviseur</option><option value="admin">Administrateur</option><option value="observer">Observateur</option></select></label>
          </div>
          <div className="modal-footer"><ActionButton secondary onClick={() => setAdd(false)}>Annuler</ActionButton><ActionButton onClick={() => setAdd(false)}>Creer</ActionButton></div>
        </Modal>
      )}
    </AppShell>
  );
}

function ConfirmDelete({ label, onCancel, onConfirm }: { label: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <Modal onClose={onCancel}>
      <div className="modal-header"><h2 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "var(--ng-text)" }}>Supprimer cet element ?</h2></div>
      <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <p>"{label}" sera retire de la base de donnees. Cette action est irreversible.</p>
      </div>
      <div className="modal-footer"><ActionButton secondary onClick={onCancel}>Annuler</ActionButton><ActionButton danger onClick={onConfirm}><Trash2 size={16} /> Supprimer</ActionButton></div>
    </Modal>
  );
}

export function MarinAlertPage() {
  const [recording, setRecording] = useState(false);
  const [sent, setSent] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [voice, setVoice] = useState<{ transcript: string; urgency: string; people: number | null; place: string | null; need: string; recommendation: string } | null>(null);
  const recorder = useState<MediaRecorder | null>(null)[0] as MediaRecorder | null;
  const chunks = useState<Blob[]>([])[0];
  const voiceMutation = trpc.ai.analyzeVoiceAlert.useMutation();
  const blobToDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob); });
  const startRecording = async () => {
    setError(""); setVoice(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const supported = ["audio/ogg;codecs=opus", "audio/webm;codecs=opus", "audio/webm"].find((type) => MediaRecorder.isTypeSupported(type));
      const next = new MediaRecorder(stream, supported ? { mimeType: supported } : undefined);
      chunks.length = 0;
      next.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      next.onstop = async () => { stream.getTracks().forEach((track) => track.stop()); setProcessing(true); try { const dataUrl = await blobToDataUrl(new Blob(chunks, { type: next.mimeType })); const result = await voiceMutation.mutateAsync({ audioDataUrl: dataUrl }); setVoice(result); } catch (cause) { setError(cause instanceof Error ? cause.message : "La transcription est indisponible."); } finally { setProcessing(false); } };
      next.start(); setRecording(true);
    } catch { setError("Autorisez le microphone pour envoyer une alerte vocale."); }
  };
  const stopRecording = () => { recorder?.stop(); setRecording(false); };
  return (
    <div className="marin-page">
      <div className="marin-brand"><Anchor size={30} /><strong>NaviGarde IA</strong><span>Alerte maritime · Benin</span></div>
      <div className="marin-card">{sent ? (
        <>
          <div className="success-orb"><CheckCheck size={38} /></div>
          <h1>Alerte envoyee</h1>
          <p>Votre signement a ete transmis au poste de controle. Restez a l’ecoute.</p>
          <button className="btn btn-primary" onClick={() => { setSent(false); setVoice(null); }}>Nouvelle alerte</button>
        </>
      ) : (
        <>
          <span className="eyebrow">Signalement prioritaire</span>
          <h1>Que se passe-t-il ?</h1>
          <p>Appuyez sur le micro et decrivez la situation. Muse Spark transcrit votre message et classe l’urgence.</p>
          <button className={`mic-button ${recording ? "recording" : ""}`} disabled={processing} onClick={recording ? stopRecording : startRecording}><Mic size={42} /></button>
          <strong className="mic-label">{processing ? "Analyse vocale en cours…" : recording ? "Appuyer pour terminer" : "Appuyer pour parler"}</strong>
          {error && <div className="ai-error marin-error">{error}</div>}
          {voice && (
            <div className="voice-result">
              <div><strong>Transcription</strong><p>"{voice.transcript}"</p></div>
              <div className="voice-tags"><span>{voice.urgency}</span><span>{voice.people ?? "?"} personne(s)</span><span>{voice.need}</span></div>
              <small>{voice.place ? "Position detectee : " + voice.place + ". " : "Position non detectee. "}{voice.recommendation}</small>
              <button className="btn btn-primary send-alert" onClick={() => setSent(true)}><Send size={17} /> Confirmer et envoyer</button>
            </div>
          )}
          <button className="location-button"><MapPin size={17} /> Partager ma position (optionnel)</button>
        </>
      )}
      </div>
      <small className="marin-footer">En cas de danger imminent, contactez egalement les secours locaux.</small>
    </div>
  );
}

function WavesIcon() { return <div className="marin-waves"><Anchor size={30} /></div> }
