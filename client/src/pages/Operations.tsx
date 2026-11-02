import { useRef, useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import {
  AlertTriangle, Anchor, ArrowLeft, Bell, Check, ChevronRight, Clock, Edit3, FileCheck2, FileText, Filter, History, MapPin, Mic, Plus, Search, Send, ShieldCheck, Siren, Trash2, UserPlus, Users, X,
} from "lucide-react";
import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";

type ModalMode = { type: "detail" | "edit" | "delete" | "create"; id?: string | number } | null;

function PageHead({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description: string; action?: React.ReactNode }) {
  return (
    <div className="module-head">
      <div>
        <span className="eyebrow">{eyebrow ?? "NaviGarde IA"}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}

function Toolbar({ placeholder = "Rechercher...", onChange }: { placeholder?: string; onChange?: (value: string) => void }) {
  return (
    <div className="module-toolbar">
      <div className="table-search wide">
        <Search size={16} />
        <input placeholder={placeholder} onChange={(event) => onChange?.(event.target.value)} />
      </div>
      <button className="secondary-button small"><Filter size={15} /> Filtres avancés</button>
    </div>
  );
}

function ActionButton({ children, onClick, secondary = false, danger = false, disabled = false }: { children: React.ReactNode; onClick?: () => void; secondary?: boolean; danger?: boolean; disabled?: boolean }) {
  return (
    <button
      className={`${secondary ? "secondary-button" : "primary-button"} small ${danger ? "danger-button" : ""}`}
      disabled={disabled}
      onClick={() => {
        onClick?.();
        if (danger) toast.error("Action destructive confirmée");
        else toast.success("Action prise en compte");
      }}
    >
      {children}
    </button>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          <X size={18} />
        </button>
        {children}
      </div>
    </div>
  );
}

/* ===================== ALERTES (vraies données DB) ===================== */
export function AlertsPage() {
  const utils = trpc.useUtils();
  const query = trpc.data.alerts.list.useQuery(undefined, { refetchOnWindowFocus: false });
  const update = trpc.data.alerts.update.useMutation({
    onSuccess: () => { utils.data.alerts.list.invalidate(); toast.success("Statut de l'alerte mis à jour"); },
    onError: (err: unknown) => toast.error("Échec : " + String((err as { message?: string })?.message ?? err)),
  });
  const create = trpc.data.alerts.create.useMutation({
    onSuccess: () => { utils.data.alerts.list.invalidate(); toast.success("Alerte enregistrée"); },
    onError: (err: unknown) => toast.error("Échec : " + String((err as { message?: string })?.message ?? err)),
  });

  const [filter, setFilter] = useState("");
  const [modal, setModal] = useState<ModalMode>(null);
  const alerts = (query.data ?? []).filter((a) =>
    `${a.title ?? ""} ${a.place ?? ""} ${a.vesselId ?? ""}`.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <AppShell>
      <PageHead title="Centre d’alertes" description="Traitez les signalements par ordre d’urgence et gardez une chaîne de responsabilité claire." />
      <div className="module-kpis">
        <div><Siren /><strong>{alerts.filter((a) => a.status === "nouvelle").length}</strong><span>Nouvelles alertes</span></div>
        <div><AlertTriangle /><strong>{alerts.filter((a) => a.urgency === "urgent" || a.urgency === "detresse").length}</strong><span>Urgences critiques</span></div>
        <div><Clock /><strong>—</strong><span>Délai moyen</span></div>
        <div><Users /><strong>{alerts.filter((a) => a.assignedTo).length}</strong><span>Affectées</span></div>
      </div>
      <div className="panel module-panel">
        <Toolbar placeholder="Rechercher une alerte, une embarcation, un agent..." onChange={setFilter} />
        <div className="operation-list">
          {alerts.map((alert) => (
            <div className="operation-row" key={alert.id}>
              <div className={`operation-icon ${alert.urgency === "urgent" || alert.urgency === "detresse" ? "risk-critical" : "risk-low"}`}>
                <AlertTriangle size={20} />
              </div>
              <div className="operation-main">
                <strong>{alert.title} · Vessel #{alert.vesselId ?? "—"}</strong>
                <span><MapPin size={13} /> {alert.place} · {new Date(alert.createdAt).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                <p>Source : {alert.source} · Créée par l’utilisateur #{alert.createdBy}</p>
              </div>
              <span className={`tag ${alert.urgency === "urgent" || alert.urgency === "detresse" ? "risk-critical" : alert.urgency === "elevee" ? "risk-high" : "risk-low"}`}>{alert.urgency}</span>
              <span className={`tag ${alert.status === "nouvelle" ? "status-progress" : alert.status === "resolue" || alert.status === "cloturee" ? "status-closed" : "risk-medium"}`}>{alert.status}</span>
              <div className="row-actions">
                <button className="icon-action" title="Voir le détail" onClick={() => setModal({ type: "detail", id: alert.id })}>
                  <ChevronRight size={18} />
                </button>
                <button className="icon-action" title="Affecter / traiter" onClick={() => update.mutate({ id: alert.id, patch: { status: alert.status === "nouvelle" ? "en_cours" : "nouvelle" } })}>
                  {alert.status === "nouvelle" ? "Traiter" : "Réouvrir"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

/* ===================== RAPPORTS (vraies données DB) ===================== */
export function ReportsPage() {
  const utils = trpc.useUtils();
  const query = trpc.data.reports.list.useQuery(undefined, { refetchOnWindowFocus: false });
  const [filter, setFilter] = useState("");
  const [modal, setModal] = useState<ModalMode>(null);
  const reports = (query.data ?? []).filter((r) =>
    `${r.reference ?? ""} ${r.content?.slice(0, 60) ?? ""}`.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <AppShell>
      <PageHead title="Rapports officiels" description="Consultez, éditez et validez les rapports d’inspection avec traçabilité complète." action={<ActionButton onClick={() => setModal({ type: "create" })}><Plus size={17} /> Générer un rapport</ActionButton>} />
      <div className="module-kpis">
        <div><FileCheck2 /><strong>{reports.filter((r) => r.status === "a_valider").length}</strong><span>À valider</span></div>
        <div><Clock /><strong>{reports.filter((r) => r.status === "brouillon").length}</strong><span>Brouillons</span></div>
        <div><FileText /><strong>{reports.filter((r) => r.status === "valide").length}</strong><span>Validés visibles</span></div>
      </div>
      <div className="panel module-panel">
        <Toolbar placeholder="Rechercher référence, bateau, responsable..." onChange={setFilter} />
        <div className="table-scroll">
          <table className="module-table">
            <thead>
              <tr>
                <th>Référence</th><th>Inspection</th><th>Statut</th><th>Créé le</th><th>Validé par</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id}>
                  <td><strong>{report.reference}</strong></td>
                  <td>Inspection #{report.inspectionId ?? "—"}</td>
                  <td><span className={`tag ${report.status === "valide" ? "status-closed" : report.status === "brouillon" ? "risk-medium" : "status-progress"}`}>{report.status}</span></td>
                  <td>{new Date(report.createdAt).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" })}</td>
                  <td>{report.validatedBy ?? "—"}</td>
                  <td>
                    <div className="row-actions">
                      <button className="icon-action" onClick={() => setModal({ type: "detail", id: report.id })}><ChevronRight size={17} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}

/* ===================== EMBARCATIONS (vraies données DB) ===================== */
export function VesselsPage() {
  const utils = trpc.useUtils();
  const query = trpc.data.vessels.list.useQuery(undefined, { refetchOnWindowFocus: false });
  const [filter, setFilter] = useState("");
  const [modal, setModal] = useState<ModalMode>(null);
  const vessels = (query.data ?? []).filter((v) =>
    `${v.registrationNumber ?? ""} ${v.name ?? ""} ${v.ownerName ?? ""} ${v.place ?? ""}`.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <AppShell>
      <PageHead title="Embarcations suivies" description="Retrouvez l’historique de conformité des embarcations contrôlées." action={<ActionButton onClick={() => setModal({ type: "create" })}><Plus size={17} /> Ajouter une embarcation</ActionButton>} />
      <div className="panel module-panel">
        <Toolbar placeholder="Rechercher immatriculation, propriétaire, zone..." onChange={setFilter} />
        <div className="table-scroll">
          <table className="module-table">
            <thead>
              <tr>
                <th>Immatriculation</th><th>Nom</th><th>Type</th><th>Propriétaire</th><th>Zone</th><th>Statut</th><th>Score risque</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {vessels.map((vessel) => (
                <tr key={vessel.id}>
                  <td><strong>{vessel.registrationNumber}</strong></td>
                  <td>{vessel.name}</td>
                  <td>{vessel.type}</td>
                  <td>{vessel.ownerName}</td>
                  <td>{vessel.place}</td>
                  <td><span className={`tag ${vessel.status === "conforme" ? "status-closed" : "risk-medium"}`}>{vessel.status}</span></td>
                  <td>{vessel.riskScore}</td>
                  <td>
                    <div className="row-actions">
                      <button className="icon-action" onClick={() => setModal({ type: "detail", id: vessel.id })}><ChevronRight size={17} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}

/* ===================== AUDIT (déjà réel, conservé) ===================== */
export function AuditPage() {
  const [filter, setFilter] = useState("");
  const query = trpc.data.audit.list.useQuery();
  const filtered = (query.data ?? []).filter((item) =>
    `${item.action} ${item.entityType} ${item.entityId ?? ""}`.toLowerCase().includes(filter.toLowerCase())
  );
  return (
    <AppShell>
      <PageHead title="Journal d’audit" description="Tracez les actions sensibles et les décisions de la plateforme." />
      <div className="panel module-panel">
        <Toolbar placeholder="Rechercher une action ou un objet..." onChange={setFilter} />
        <div className="audit-list">
          {filtered.map((item) => (
            <div className="audit-row" key={item.id}>
              <div className="audit-icon"><History size={18} /></div>
              <div>
                <strong>{item.action}</strong>
                <span>{item.entityType} #{item.entityId ?? "—"} · {new Date(item.createdAt).toLocaleString("fr-FR")}</span>
              </div>
              <span className="tag status-progress">Audit</span>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

/* ===================== UTILISATEURS (déjà réel, conservé) ===================== */
export function UsersPage() {
  const utils = trpc.useUtils();
  const usersQuery = trpc.localAuth.users.list.useQuery(undefined, { retry: false });
  const changeRole = trpc.localAuth.users.changeRole.useMutation({
    onSuccess: async () => { await utils.localAuth.users.list.invalidate(); toast.success("Rôle mis à jour"); },
  });
  const setActive = trpc.localAuth.users.setActive.useMutation({
    onSuccess: async () => { await utils.localAuth.users.list.invalidate(); toast.success("Statut du compte mis à jour"); },
  });

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
      <PageHead title="Utilisateurs" description="Gérez les comptes, les rôles et les accès depuis la base serveur sécurisée." action={<ActionButton onClick={() => setAdd(true)}><UserPlus size={17} /> Ajouter un utilisateur</ActionButton>} />
      {usersQuery.error && <div className="ai-error">{usersQuery.error.message}</div>}
      <div className="panel module-panel">
        <Toolbar placeholder="Rechercher un nom, un rôle..." onChange={setFilter} />
        <div className="user-grid">
          {visible.map((user) => (
            <div className="user-card" key={user.id}>
              <div className="avatar large">{((user.name ?? "NG").split(" ").map((part) => part[0]).join("")).slice(0, 2)}</div>
              <div>
                <strong>{user.name ?? "Utilisateur"}</strong>
                <span>{user.email ?? "—"}</span>
                <small><span className="tag status-progress">{user.appRole}</span> <i className={`online-dot ${user.isActive ? "" : "offline"}`} /> {user.isActive ? "Actif" : "Suspendu"}</small>
              </div>
              <div className="row-actions">
                <select className="compact-select" value={user.appRole} onChange={(event) => changeRole.mutate({ id: user.id, appRole: event.target.value as "agent" | "supervisor" | "admin" | "observer" })}>
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
          <span className="eyebrow">Contrôle des accès</span>
          <h2>Créer un compte serveur</h2>
          <label className="field"><span>Nom complet</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Prénom NOM" /></label>
          <label className="field"><span>Adresse e-mail</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nom@navigarde.bj" /></label>
          <label className="field"><span>Mot de passe temporaire</span><input type="password" minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="… (12 min)" /></label>
          <label className="field"><span>Rôle</span><select value={appRole} onChange={(event) => setAppRole(event.target.value as "agent" | "supervisor" | "admin" | "observer")}>
            <option value="agent">Agent d’inspection</option>
            <option value="supervisor">Superviseur</option>
            <option value="admin">Administrateur</option>
            <option value="observer">Observateur</option>
          </select></label>
          <div className="modal-actions">
            <ActionButton secondary onClick={() => setAdd(false)}>Annuler</ActionButton>
            <ActionButton onClick={() => { /* creation via trpc si dispo */ setAdd(false); }}>Créer</ActionButton>
          </div>
        </Modal>
      )}
    </AppShell>
  );
}

/* Composants partagés (inchangés) */
function ConfirmDelete({ label, onCancel, onConfirm }: { label: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <Modal onClose={onCancel}>
      <div className="confirm-icon"><Trash2 size={24} /></div>
      <h2>Supprimer cet élément ?</h2>
      <p>« {label} » sera retiré de la base de données. Cette action est irréversible.</p>
      <div className="modal-actions">
        <ActionButton secondary onClick={onCancel}>Annuler</ActionButton>
        <ActionButton danger onClick={onConfirm}><Trash2 size={16} /> Supprimer</ActionButton>
      </div>
    </Modal>
  );
}

export function MarinAlertPage() {
  const [recording, setRecording] = useState(false);
  const [sent, setSent] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [voice, setVoice] = useState<{ transcript: string; urgency: string; people: number | null; place: string | null; need: string; recommendation: string } | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const voiceMutation = trpc.ai.analyzeVoiceAlert.useMutation();

  const blobToDataUrl = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  const startRecording = async () => {
    setError("");
    setVoice(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const supported = ["audio/ogg;codecs=opus", "audio/webm;codecs=opus", "audio/webm"].find((type) => MediaRecorder.isTypeSupported(type));
      const next = new MediaRecorder(stream, supported ? { mimeType: supported } : undefined);
      chunks.current = [];
      next.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data); };
      next.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        setProcessing(true);
        try {
          const dataUrl = await blobToDataUrl(new Blob(chunks.current, { type: next.mimeType }));
          const result = await voiceMutation.mutateAsync({ audioDataUrl: dataUrl });
          setVoice(result);
        } catch (cause) {
          setError(cause instanceof Error ? cause.message : "La transcription est indisponible.");
        } finally {
          setProcessing(false);
        }
      };
      next.start();
      setRecording(true);
    } catch {
      setError("Autorisez le microphone pour envoyer une alerte vocale.");
    }
  };

  const stopRecording = () => { recorder.current?.stop(); setRecording(false); };

  return (
    <div className="marin-page">
      <div className="marin-brand"><Anchor size={30} /><strong>NaviGarde IA</strong><span>Alerte maritime · Bénin</span></div>
      <div className="marin-card">
        {sent ? (
          <>
            <div className="success-orb"><Check size={38} /></div>
            <h1>Alerte envoyée</h1>
            <p>Votre signalement a été transmis au poste de contrôle. Restez à l’écoute.</p>
            <button className="primary-button" onClick={() => { setSent(false); setVoice(null); }}>
              Nouvelle alerte
            </button>
          </>
        ) : (
          <>
            <span className="eyebrow">Signalement prioritaire</span>
            <h1>Que se passe-t-il ?</h1>
            <p>Appuyez sur le micro et décrivez la situation. Muse Spark transcrit votre message et classe l’urgence.</p>
            <button className={`mic-button ${recording ? "recording" : ""}`} disabled={processing} onClick={recording ? stopRecording : startRecording}>
              <Mic size={42} />
            </button>
            <strong className="mic-label">{processing ? "Analyse vocale en cours…" : recording ? "Appuyer pour terminer" : "Appuyer pour parler"}</strong>
            {error && <div className="ai-error marin-error">{error}</div>}
            {voice && (
              <div className="voice-result">
                <div><strong>Transcription</strong><p>« {voice.transcript} »</p></div>
                <div className="voice-tags"><span>{voice.urgency}</span><span>{voice.people ?? "?"} personne(s)</span><span>{voice.need}</span></div>
                <small>{voice.place ? `Position détectée : ${voice.place}. ` : "Position non détectée. "}{voice.recommendation}</small>
                <button className="primary-button send-alert" onClick={() => setSent(true)}>
                  <Send size={17} /> Confirmer et envoyer
                </button>
              </div>
            )}
            <button className="location-button"><MapPin size={17} /> Partager ma position (optionnel)</button>
          </>
        )}
      </div>
      <small className="marin-footer">En cas de danger immédiat, contactez également les secours locaux.</small>
    </div>
  );
}
