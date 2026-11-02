import { useMemo, useState } from "react";
import { CalendarDays, Check, ChevronLeft, ChevronDown, ChevronRight, Download, Eye, FileText, Filter, Plus, ShieldAlert, Search, TriangleAlert } from "lucide-react";
import { Link } from "wouter";
import { toast } from "sonner";
import AppShell from "@/components/AppShell";

type Report = { ref: string; vessel: string; type: string; place: string; date: string; status: "Conforme" | "Anomalie mineure" | "Anomalie majeure" | "Critique"; score: number };
const reports: Report[] = [
  { ref: "RPT-2025-0412", vessel: "Pirogue N°BK-0421", type: "Pirogue", place: "Porto-Novo", date: "29/10/2025 · 14:32", status: "Conforme", score: 92 },
  { ref: "RPT-2025-0411", vessel: "Vedette N°BN-1187", type: "Vedette", place: "Cotonou", date: "28/10/2025 · 16:20", status: "Anomalie mineure", score: 76 },
  { ref: "RPT-2025-0410", vessel: "Barge N°BJ-2234", type: "Barge", place: "Sèmè-Kpodji", date: "27/10/2025 · 11:47", status: "Anomalie majeure", score: 58 },
  { ref: "RPT-2025-0409", vessel: "Pirogue N°BK-0765", type: "Pirogue", place: "Ouidah", date: "26/10/2025 · 16:05", status: "Critique", score: 42 },
  { ref: "RPT-2025-0408", vessel: "Vedette N°BN-0098", type: "Vedette", place: "Grand-Popo", date: "25/10/2025 · 13:22", status: "Conforme", score: 88 },
  { ref: "RPT-2025-0407", vessel: "Pirogue N°BK-0112", type: "Pirogue", place: "Cotonou", date: "24/10/2025 · 10:18", status: "Anomalie mineure", score: 74 },
];

export default function ReportsCenter() {
  const [period, setPeriod] = useState("7 derniers jours");
  const [type, setType] = useState("Tous");
  const [status, setStatus] = useState("Tous");
  const [place, setPlace] = useState("Tous");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => reports.filter((report) =>
    `${report.ref} ${report.vessel} ${report.place}`.toLowerCase().includes(query.toLowerCase()) &&
    (type === "Tous" || report.type === type) &&
    (status === "Tous" || report.status === status) &&
    (place === "Tous" || report.place === place)
  ), [query, type, status, place]);

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <Link href="/" className="back-link"><ChevronLeft size={16} /> Retour</Link>
          <span className="eyebrow">Centre de rapports</span>
          <h1 className="page-title">Centre de rapports</h1>
          <p className="page-subtitle">Consultez, téléchargez et gérez tous les rapports d'inspection de la flotte.</p>
        </div>
        <button className="btn btn-primary" onClick={() => toast.success("Nouveau rapport prêt à être généré")}><Plus size={17} /> Nouveau rapport</button>
      </div>

      <section className="kpi-row">
        <KpiCard icon={<FileText size={20} />} color="#2563eb" label="Total des rapports" value="128" delta="+12%" />
        <KpiCard icon={<Check size={20} />} color="#0ca7b0" label="Rapports conformes" value="89" delta="69% du total" />
        <KpiCard icon={<TriangleAlert size={20} />} color="#f59e0b" label="Rapports anomalies" value="32" delta="25% du total" />
        <KpiCard icon={<ShieldAlert size={20} />} color="#ef4444" label="Rapports critiques" value="7" delta="5% du total" />
      </section>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1, marginBottom: 1 }}>
          <div className="table-search" style={{ width: 300, position: "relative" }}>
            <Search size={16} style={{ position: "absolute", left: "1rem", top: "50%", transform: "translateY(-50%)", color: "var(--ng-text-muted)" }} />
            <input placeholder="Rechercher référence, bateau, zone…" value={query} onChange={(e) => setQuery(e.target.value)} className="input" style={{ paddingLeft: "2.5rem" }} />
          </div>
          <div className="filter-row">
            <FilterPill label="Type" value={type} options={["Tous", "Pirogue", "Vedette", "Barge"]} onChange={setType} />
            <FilterPill label="Statut" value={status} options={["Tous", "Conforme", "Anomalie mineure", "Anomalie majeure", "Critique"]} onChange={setStatus} />
          </div>
        </div>
        <div className="card-body" style={{ paddingTop: 0, overflowX: "auto" }}>
          <table className="table">
            <thead>
              <tr>
                <th>Référence</th>
                <th>Embarcation</th>
                <th>Type</th>
                <th>Zone</th>
                <th>Date</th>
                <th>Statut</th>
                <th>Score</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((report) => (
                <tr key={report.ref}>
                  <td><strong>{report.ref}</strong></td>
                  <td>{report.vessel}</td>
                  <td>{report.type}</td>
                  <td>{report.place}</td>
                  <td>{report.date}</td>
                  <td><span className={`badge ${report.status === "Conforme" ? "badge-success" : report.status === "Critique" ? "badge-danger" : report.status === "Anomalie majeure" ? "badge-warning" : "badge-info"}`}>{report.status}</span></td>
                  <td>{report.score}</td>
                  <td><div style={{ display: "flex", gap: 0.5 }}>
                    <button className="icon-btn" title="Télécharger"><Download size={14} /></button>
                    <button className="icon-btn" title="Voir"><Eye size={14} /></button>
                  </div></td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: "center", color: "var(--ng-text-muted)", padding: "2rem" }}>Aucun rapport trouvé</td></tr>
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
