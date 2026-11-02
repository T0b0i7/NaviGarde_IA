import { Link, useRoute } from "wouter";
import { ArrowLeft, CalendarDays, Check, FileText, MapPin, ShipWheel, UserRound } from "lucide-react";
import AppShell from "@/components/AppShell";
import { trpc } from "@/lib/trpc";

export default function InspectionDetail() {
  const [, routeParams] = useRoute("/inspections/:id");
  const inspectionId = Number(routeParams?.id ?? 0);
  const detailQuery = trpc.data.inspections.get.useQuery({ id: inspectionId }, { enabled: inspectionId > 0 });
  const inspection = detailQuery.data?.inspection;

  return (
    <AppShell>
      <div className="page-header">
        <div>
          <Link href="/inspections/new" className="back-link"><ArrowLeft size={16} /> Retour aux inspections</Link>
          <h1 className="page-title">Details de l'inspection</h1>
          <p className="page-subtitle">Consultez toutes les informations de cette inspection.</p>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div style={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
            <div style={{ width: 200 }}>
              <img src="/boat-inspection.jpg" alt="Pirogue inspectee" style={{ width: "100%", borderRadius: "8px" }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                <div className="detail-item">
                  <div style={{ width: 32, height: 32, borderRadius: "8px", background: "#e0f2fe", color: "var(--ng-blue)", display: "flex", alignItems: "center", justifyContent: "center" }}><ShipWheel size={16} /></div>
                  <div><strong>Type</strong><span>Pirogue</span></div>
                </div>
                <div className="detail-item">
                  <div style={{ width: 32, height: 32, borderRadius: "8px", background: "#e0f2fe", color: "var(--ng-blue)", display: "flex", alignItems: "center", justifyContent: "center" }}><MapPin size={16} /></div>
                  <div><strong>Lieu</strong><span>Porto-Novo</span></div>
                </div>
                <div className="detail-item">
                  <div style={{ width: 32, height: 32, borderRadius: "8px", background: "#e0f2fe", color: "var(--ng-blue)", display: "flex", alignItems: "center", justifyContent: "center" }}><CalendarDays size={16} /></div>
                  <div><strong>Date</strong><span>29/10/2025</span></div>
                </div>
                <div className="detail-item">
                  <div style={{ width: 32, height: 32, borderRadius: "8px", background: "#e0f2fe", color: "var(--ng-blue)", display: "flex", alignItems: "center", justifyContent: "center" }}><UserRound size={16} /></div>
                  <div><strong>Agent</strong><span>Koffi DOSSA</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
