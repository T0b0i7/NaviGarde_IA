import { getInspection, getReport, getVessel, listInspectionFindings, listInspectionImages } from "./db";
import { buildInspectionPdf, type PdfImageInput } from "./pdf";
import { storageRead } from "./storage";

export async function renderReportPdf(reportId: number): Promise<Buffer> {
  const report = await getReport(reportId);
  if (!report) throw new Error("Rapport introuvable");
  const inspection = report.inspectionId ? await getInspection(report.inspectionId) : undefined;
  const vessel = inspection?.vesselId ? await getVessel(inspection.vesselId).catch(() => undefined) : undefined;
  const images = inspection ? await listInspectionImages(inspection.id).catch(() => []) : [];
  const findings = inspection ? await listInspectionFindings(inspection.id).catch(() => []) : [];

  const photoInputs: Array<PdfImageInput | null> = await Promise.all(
    images.slice(0, 8).map(async (img, index) => {
      const key = img.storageKey ?? String(img.imageUrl ?? "").replace(/^\/uploads\//, "");
      const data = key ? await storageRead(key) : null;
      return data ? { data, caption: `Photo ${index + 1} - ${img.imageType ?? "inspection"}` } : null;
    }),
  );

  const risk = inspection?.riskScore ?? 0;
  const compliance = 100 - risk;
  const meta: Array<[string, string]> = [
    ["Reference", report.reference],
    ["Version", `v${report.version}`],
    ["Statut", report.status ?? "brouillon"],
    ["Date", new Date(report.createdAt ?? Date.now()).toLocaleString("fr-FR")],
    ["Embarcation", vessel?.name ?? vessel?.registrationNumber ?? "-"],
    ["Immatriculation", vessel?.registrationNumber ?? "-"],
    ["Type", vessel?.type ?? "-"],
    ["Lieu", inspection?.place ?? "-"],
    ["Capacite declaree", vessel ? `${vessel.capacity} passagers` : "-"],
    ["Agent", inspection?.agentId ? `Agent #${inspection.agentId}` : "-"],
    ["Score de conformite", `${compliance}% (risque ${risk}/100)`],
  ];

  const aiLines = [
    `Recommandation : ${inspection?.recommendation ?? "Verification humaine recommandee."}`,
    `Coque : ${inspection?.hullStatus ?? "non visible"} - Moteur : ${inspection?.engineStatus ?? "non visible"}`,
    `Passagers detectes : ${inspection?.passengersDetected ?? 0} - Gilets visibles : ${inspection?.lifejacketsVisible ?? 0}`,
    `Confiance IA : ${inspection?.confidence ?? 0}% - Fournisseur : ${inspection?.analysisProvider ?? "mode local"}`,
  ];

  const findingLines = findings.length
    ? findings.map((f, index) => `${index + 1}. [${f.riskLevel}] ${f.anomalyType} - ${f.description}${f.recommendation ? ` (recommandation : ${f.recommendation})` : ""}`)
    : ["Aucune anomalie enregistree pour cette inspection."];

  return buildInspectionPdf({
    title: "RAPPORT D'INSPECTION",
    subtitle: `NaviGarde IA - ${report.reference} - version ${report.version}`,
    meta,
    sections: [
      { heading: "SYNTHESE", lines: [String(report.content ?? "").slice(0, 4000)] },
      { heading: "ANALYSE IA", lines: aiLines },
      { heading: `ANOMALIES (${findings.length})`, lines: findingLines },
    ],
    images: photoInputs,
    footerNote: "L'IA propose, l'humain decide. Ce rapport doit etre relu et valide par un superviseur avant toute decision operationnelle.",
  });
}

