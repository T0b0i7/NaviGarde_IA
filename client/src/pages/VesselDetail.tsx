import { useState } from "react";
import { AlertTriangle, Anchor, ArrowLeft, CalendarDays, Check, ChevronRight, Download, Edit3, FileText, Info, MapPin, MoreHorizontal, Navigation, PauseCircle, Printer, Share2, ShieldCheck, Sparkles, Wrench, X } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";

export default function VesselDetail() {
  const [tab, setTab] = useState("general");
  const [active, setActive] = useState(true);
  const [shared, setShared] = useState(false);
  const [alertOpen, setAlertOpen] = useState(true);

  const tabs: { key: string; label: string; Icon: React.ComponentType<any> }[] = [
    { key: "general", label: "Informations générales", Icon: Info },
    { key: "history", label: "Historique des inspections", Icon: FileText },
    { key: "photos", label: "Photos & Documents", Icon: Download },
    { key: "maintenance", label: "Maintenance", Icon: Wrench },
    { key: "location", label: "Localisation", Icon: MapPin },
  ];

  const print = () => { window.print(); toast.success("Impression préparée"); };
  const share = () => { setShared(true); toast.success("Lien de partage copié"); };

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <Link href="/embarcations" className="back-link"><ArrowLeft size={16} /> Retour</Link>
          <h1 className="page-title">Détail d'une embarcation</h1>
          <p className="page-subtitle">Consultez toutes les informations et l'historique de cette embarcation.</p>
        </div>
        <div className="head-actions">
          <button className="btn btn-secondary" onClick={print}><Printer size={16} /> Imprimer</button>
          <button className="btn btn-secondary" onClick={() => toast.success("Rapport téléchargé")}><Download size={16} /> Télécharger le rapport</button>
          <button className="btn btn-secondary" onClick={share}><Share2 size={16} /> {shared ? "Lien copié" : "Partager"}</button>
        </div>
      </div>

      <section className="vessel-detail-page">
        <div className="vessel-hero-detail">
          <div className="vessel-hero-photo">
            <img src="/boat-inspection.jpg" alt="Pirogue Océan" />
            <span className="hero-active"><Check size={14} /> {active ? "Active" : "Inactive"}</span>
            <span className="hero-more">Voir plus (5)</span>
          </div>
          <div className="vessel-identity">
            <h2>Pirogue Océan</h2>
            <strong>N°BK-0421 <button onClick={() => toast.success("Immatriculation copiée")}><FileText size={16} /></button></strong>
            <DetailFact icon={<Anchor size={15} />} label="Type" value="Pirogue" />
            <DetailFact icon={<Navigation size={15} />} label="Longueur" value="8,50 m" />
            <DetailFact icon={<Navigation size={15} />} label="Largeur" value="2,50 m" />
            <DetailFact icon={<ShieldCheck size={15} />} label="Capacité" value="12 passagers" />
            <DetailFact icon={<Info size={15} />} label="Propriétaire" value="Koffi DOSSA" />
            <DetailFact icon={<MapPin size={15} />} label="Port d'attache" value="Porto-Novo" />
          </div>
          <div className="vessel-gauge-card">
            <div className="vessel-gauge">
              <h3>Niveau de risque</h3>
              <div className="gauge-arc"><span><ShieldCheck size={28} /></span></div>
              <strong>Faible</strong>
              <em>Dernière évaluation :<br />29/10/2025</em>
            </div>
            <div className="vessel-gauge">
              <h3>Score de conformité</h3>
              <div className="gauge-arc"><span>92%</span></div>
              <strong>Très bon</strong>
              <em>Dernière évaluation :<br />29/10/2025</em>
            </div>
          </div>
        </div>

        <div className="vessel-tabs">
          {tabs.map((t) => (
            <button key={t.key} className={`tab-btn ${tab === t.key ? "tab-active" : ""}`} onClick={() => setTab(t.key)}>
              <t.Icon size={16} /> {t.label}
            </button>
          ))}
        </div>

        {tab === "general" && (
          <div className="card">
            <div className="card-body">
              <div className="current-alerts">
                <div className="alert-title"><AlertTriangle size={17} /> Alertes en cours <b>1</b></div>
                {alertOpen && (
                  <button className="btn btn-secondary vessel-alert" onClick={() => setAlertOpen(false)}>
                    <strong>Gilet de sauvetage manquant</strong>
                    <span style={{ fontSize: "11px", color: "var(--ng-text-muted)" }}>Pièce manquante à bord - action requise avant départ</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === "history" && (
          <div className="card">
            <div className="card-body" style={{ paddingTop: 0, overflowX: "auto" }}>
              <table className="table">
                <thead>
                  <tr><th>Date</th><th>Type</th><th>Résultat</th><th>Score</th><th>Agent</th><th>Action</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td>29/10/2025</td><td>Inspection</td><td><span className="badge badge-success"><Check size={12} /> Conforme</span></td><td>88/100</td><td>Koffi DOSSA</td><td><button className="icon-btn"><EyeIcon /></button></td>
                  </tr>
                  <tr>
                    <td>15/09/2025</td><td>Inspection</td><td><span className="badge badge-warning"><AlertTriangle size={12} /> À vérifier</span></td><td>62/100</td><td>Thomas ADJE</td><td><button className="icon-btn"><EyeIcon /></button></td>
                  </tr>
                  <tr>
                    <td>03/08/2025</td><td>Inspection</td><td><span className="badge badge-success"><Check size={12} /> Conforme</span></td><td>91/100</td><td>Adelaide HOUND</td><td><button className="icon-btn"><EyeIcon /></button></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "photos" && (
          <div className="card">
            <div className="card-body">
              <div className="photo-grid">
                <div className="photo-item"><img src="/boat-inspection.jpg" alt="Photo 1" /><span>29/10/2025</span></div>
                <div className="photo-item"><img src="/boat-inspection.jpg" alt="Photo 2" /><span>29/10/2025</span></div>
                <div className="photo-item"><img src="/boat-inspection.jpg" alt="Photo 3" /><span>15/09/2025</span></div>
              </div>
            </div>
          </div>
        )}

        {tab === "maintenance" && (
          <div className="card">
            <div className="card-body">
              <div className="maintenance-list">
                <div className="maintenance-item">
                  <strong>Vidange moteur</strong><span>29/10/2024 · À faire dans 6 mois</span>
                </div>
                <div className="maintenance-item">
                  <strong>Vérification coque</strong><span>15/09/2025 · Effectuée</span>
                </div>
                <div className="maintenance-item">
                  <strong>Révision électronique</strong><span>03/08/2025 · À faire dans 3 mois</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "location" && (
          <div className="card">
            <div className="card-body">
              <div className="map-placeholder">
                <div className="map-icon"><MapPin size={40} /></div>
                <p>Carte interactive de la zone de navigation - Porto-Novo</p>
              </div>
            </div>
          </div>
        )}
      </section>
    </AppShell>
  );
}

function DetailFact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="vessel-detail-fact">
      {icon}
      <span>{label} :</span>
      <strong>{value}</strong>
    </div>
  );
}

function EyeIcon() {
  return <span className="eye-simple">◉</span>;
}
