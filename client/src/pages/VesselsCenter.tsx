import { useMemo, useState } from "react";
import { AlertTriangle, Anchor, ChevronLeft, Check, Download, Edit3, Filter, MapPin, Plus, Printer, RefreshCw, Search, ShipWheel, Trash2, UserRound } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";

type Vessel = { id: number; name: string; registration: string; type: string; port: string; status: "Active" | "Inactive"; risk: "Faible" | "Moyen" | "Élevé"; lastInspection: string; score: number };
const seed: Vessel[] = [
  { id: 1, name: "Pirogue Océan", registration: "N°BK-0421", type: "Pirogue", port: "Porto-Novo", status: "Active", risk: "Faible", lastInspection: "29/10/2025", score: 92 },
  { id: 2, name: "Vedette Horizon", registration: "N°VD-1187", type: "Vedette", port: "Cotonou", status: "Active", risk: "Moyen", lastInspection: "28/10/2025", score: 76 },
  { id: 3, name: "Barge du Port", registration: "N°BG-2234", type: "Barge", port: "Sèmè-Kpodji", status: "Active", risk: "Élevé", lastInspection: "27/10/2025", score: 58 },
  { id: 4, name: "Pirogue Espoir", registration: "N°BK-0765", type: "Pirogue", port: "Ouidah", status: "Inactive", risk: "Faible", lastInspection: "26/10/2025", score: 88 },
  { id: 5, name: "Coque Solidaire", registration: "N°CS-0098", type: "Coque", port: "Grand-Popo", status: "Active", risk: "Moyen", lastInspection: "25/10/2025", score: 74 },
  { id: 6, name: "Vedette Alliance", registration: "N°VA-1172", type: "Vedette", port: "Abomey-Calavi", status: "Active", risk: "Faible", lastInspection: "24/10/2025", score: 91 },
  { id: 7, name: "Pirogue Alliance", registration: "N°BK-0654", type: "Pirogue", port: "Cotonou", status: "Active", risk: "Élevé", lastInspection: "23/10/2025", score: 61 },
  { id: 8, name: "Barge Progrès", registration: "N°BG-1987", type: "Barge", port: "Sèmè-Kpodji", status: "Active", risk: "Moyen", lastInspection: "22/10/2025", score: 72 },
];

export default function VesselsCenter() {
  const [vessels, setVessels] = useState(seed);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("Tous");
  const [status, setStatus] = useState("Tous");
  const [risk, setRisk] = useState("Tous");
  const [port, setPort] = useState("Tous");
  const [page, setPage] = useState(1);
const [modal, setModal] = useState<"create" | null>(null);

  const filtered = useMemo(() => vessels.filter((vessel) =>
    `${vessel.name} ${vessel.registration}`.toLowerCase().includes(query.toLowerCase()) &&
    (type === "Tous" || vessel.type === type) &&
    (status === "Tous" || vessel.status === status) &&
    (risk === "Tous" || vessel.risk === risk) &&
    (port === "Tous" || vessel.port === port)
  ), [vessels, query, type, status, risk, port]);

  const reset = () => { setQuery(""); setType("Tous"); setStatus("Tous"); setRisk("Tous"); setPort("Tous"); toast.success("Filtres réinitialisés"); };

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <Link href="/" className="back-link"><ChevronLeft size={16} /> Retour</Link>
          <h1 className="page-title">Gestion des embarcations</h1>
          <p className="page-subtitle">Consultez, gérez et suivez toutes les embarcations enregistrées dans le système.</p>
        </div>
      </div>

      <section className="kpi-row">
        <KpiCard icon={<ShipWheel size={20} />} color="#2563eb" label="Total embarcations" value="245" delta="+5%" />
        <KpiCard icon={<Check size={20} />} color="#0ca7b0" label="Actives" value="212" delta="+3%" />
        <KpiCard icon={<RefreshCw size={20} />} color="#f59e0b" label="Inactives" value="21" delta="+1%" />
        <KpiCard icon={<AlertTriangle size={20} />} color="#ef4444" label="À risque" value="12" delta="-1%" />
      </section>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1, marginBottom: 1 }}>
          <Toolbar placeholder="Rechercher immatriculation, propriétaire, zone…" onChange={setQuery} />
          <div className="filter-row">
            <FilterPill label="Type" value={type} options={["Tous", "Pirogue", "Vedette", "Barge", "Coque"]} onChange={setType} />
            <FilterPill label="Statut" value={status} options={["Tous", "Active", "Inactive"]} onChange={setStatus} />
            <FilterPill label="Risque" value={risk} options={["Tous", "Faible", "Moyen", "Élevé"]} onChange={setRisk} />
          </div>
          <div className="filter-actions">
            <button className="btn btn-secondary" onClick={reset}>Réinitialiser</button>
            <button className="btn btn-primary" onClick={() => setModal("create")}><Plus size={17} /> Nouvelle embarcation</button>
          </div>
        </div>
        <Toolbar placeholder="Rechercher immatriculation, propriétaire, zone…" onChange={setQuery} />
        <div className="card-body" style={{ paddingTop: 0, overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>N°</th>
                <th>Photo</th>
                <th>Nom</th>
                <th>Immatriculation</th>
                <th>Type</th>
                <th>Port d'attache</th>
                <th>Statut</th>
                <th>Score risque</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((vessel, index) => (
                <tr key={vessel.id}>
                  <td>{index + 1}</td>
                  <td><img className="vessel-thumb" src="/boat-inspection.jpg" alt={vessel.name} /></td>
                  <td><strong>{vessel.name}</strong></td>
                  <td>{vessel.registration}</td>
                  <td><span className={`badge ${vessel.type === "Pirogue" ? "badge-info" : vessel.type === "Vedette" ? "badge-warning" : "badge-neutral"}`}>{vessel.type}</span></td>
                  <td>{vessel.port}</td>
                  <td><span className={`badge ${vessel.status === "Active" ? "badge-success" : "badge-danger"}`}>{vessel.status}</span></td>
                  <td>{vessel.score}</td>
                  <td><div style={{ display: "flex", gap: 0.5 }}>
                    <button className="icon-btn" title="Détails"><MapPin size={14} /></button>
                    <button className="icon-btn" title="Éditer"><Edit3 size={14} /></button>
                  </div></td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: "center", color: "var(--ng-text-muted)", padding: "2rem" }}>Aucune embarcation trouvée</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}

function KpiCard({ icon: Icon, color, label, value, delta }: { icon: any; color: string; label: string; value: string; delta?: string }) {
  return (
    <div className="kpi-card">
      <div className="kpi-icon" style={{ backgroundColor: color }}><Icon size={20} /></div>
      <div className="kpi-content">
        <span className="kpi-label">{label}</span>
        <strong className="kpi-value">{value}</strong>
        {delta && <span className="kpi-trend up">{delta}</span>}
      </div>
    </div>
  );
}

function FilterPill({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div className="filter-pill">
      <button className="pill-trigger" onClick={() => {}}>{label}</button>
      <select className="pill-select" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function FilterPillSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div className="filter-pill">
      <select className="pill-select" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function VesselThumbnail({ src, alt }: { src: string; alt: string }) {
  return <img className="vessel-thumb" src={src} alt={alt} />;
}

function Toolbar({ placeholder = "Rechercher...", onChange }: { placeholder?: string; onChange?: (value: string) => void }) {
  return (
    <div className="table-search" style={{ width: 320, position: "relative" }}>
      <Search size={16} style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "var(--ng-text-muted)" }} />
      <input placeholder={placeholder} onChange={(event) => onChange?.(event.target.value)} className="input" style={{ paddingLeft: "2.5rem" }} />
    </div>
  );
}


