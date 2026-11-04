import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, ChevronRight, FileText, Plus, ShipWheel, Waves } from "lucide-react";
import AppShell from "@/components/AppShell";

export default function ComponentShowcase() {
  const [value, setValue] = useState("option1");

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <span className="eyebrow">Bibliotheque de composants</span>
          <h1 className="page-title">UI Component Showcase</h1>
          <p className="page-subtitle">Demonstration des composants du design system NaviGarde IA.</p>
        </div>
      </div>

      <section className="kpi-row">
        <KpiCard icon={<ShipWheel size={20} />} color="var(--ng-info)" label="Composants disponibles" value="24" delta="+" />
        <KpiCard icon={<Check size={20} />} color="var(--ng-teal)" label="Accessibilite" value="WCAG 2.1" delta="AA" />
        <KpiCard icon={<Waves size={20} />} color="var(--ng-purple)" label="Themes" value="2" delta="Clair / Sombre" />
      </section>

      <div className="card">
        <div className="card-header">
          <div>
            <h2 style={{ fontSize: "18px", fontWeight: 800, color: "var(--ng-text)", margin: "0 0 4px" }}>Boutons</h2>
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--ng-text-muted)" }}>Boutons principaux, secondaires et de danger.</p>
          </div>
        </div>
        <div className="card-body" style={{ paddingTop: 0, display: "flex", gap: 1, flexWrap: "wrap" }}>
          <button className="btn btn-primary"><Plus size={16} /> Action principale</button>
          <button className="btn btn-secondary">Action secondaire</button>
          <button className="btn btn-danger">Action de danger</button>
          <button className="btn btn-primary" disabled>Desactive</button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 1 }}>
        <div className="card-header">
          <div>
            <h2 style={{ fontSize: "18px", fontWeight: 800, color: "var(--ng-text)", margin: "0 0 4px" }}>Badges et alertes</h2>
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--ng-text-muted)" }}>Badges de statut et alertes contextuelles.</p>
          </div>
        </div>
        <div className="card-body" style={{ paddingTop: 0, display: "flex", gap: 1, flexWrap: "wrap" }}>
          <span className="badge badge-success">Conforme</span>
          <span className="badge badge-warning">A verifier</span>
          <span className="badge badge-danger">Critique</span>
          <span className="badge badge-info">Information</span>
          <span className="badge badge-neutral">Neutre</span>
          <div className="ai-error"><Info size={16} /> Message d'erreur d'exemple</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 1 }}>
        <div className="card-header">
          <div>
            <h2 style={{ fontSize: "18px", fontWeight: 800, color: "var(--ng-text)", margin: "0 0 4px" }}>Formulaires</h2>
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--ng-text-muted)" }}>Champs de saisie et selecteurs.</p>
          </div>
        </div>
        <div className="card-body" style={{ paddingTop: 0, display: "flex", flexDirection: "column", gap: 1 }}>
          <label className="field"><span>Nom de l'embarcation</span><input value={value} onChange={(e) => setValue(e.target.value)} className="input" /></label>
          <label className="field"><span>Type d'embarcation</span><div className="select-wrap"><ShipWheel size={16} /><select value={value} onChange={(e) => setValue(e.target.value)}><option value="option1">Pirogue</option><option value="option2">Vedette</option><option value="option3">Barge</option></select><ChevronRight size={15} /></div></label>
        </div>
      </div>

      <div className="card" style={{ marginTop: 1 }}>
        <div className="card-header">
          <div>
            <h2 style={{ fontSize: "18px", fontWeight: 800, color: "var(--ng-text)", margin: "0 0 4px" }}>Cartes</h2>
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--ng-text-muted)" }}>Cartes avec entete, corps et pied de page.</p>
          </div>
        </div>
        <div className="card-body" style={{ paddingTop: 0, display: "flex", gap: 1, flexWrap: "wrap" }}>
          <div style={{ width: 300 }}>
            <Card>
              <CardHeader>
                <CardTitle>Detail d'inspection</CardTitle>
                <CardDescription>Pirogue N°BK-0421 · Porto-Novo</CardDescription>
              </CardHeader>
              <CardContent>
                <p>Statut : Conforme · Score de risque : 12/100</p>
              </CardContent>
              <CardFooter>
                <button className="btn btn-secondary" style={{ height: "auto", padding: "0 0.75rem", fontSize: "13px" }}>Voir les details</button>
              </CardFooter>
            </Card>
          </div>
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

function Info({ size }: { size?: number }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width={size ?? 20} height={size ?? 20}><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>;
}
