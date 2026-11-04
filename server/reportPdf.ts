import { getInspection, getReport, getVessel, listInspectionFindings, listInspectionImages } from "./db";
import { buildInspectionPdf, type PdfImageInput } from "./pdf";
import { storageRead } from "./storage";
import { readFile } from "node:fs/promises";
import path from "node:path";

let logoCache: Buffer | null | undefined;
async function loadLogo(): Promise<Buffer | null> {
  if (logoCache !== undefined) return logoCache;
  for (const candidate of ["server/assets/logo.jpg", "client/public/logo-icon.png", "public/logo-icon.png", "dist/public/logo-icon.png"]) {
    try {
      logoCache = await readFile(path.resolve(process.cwd(), candidate));
      return logoCache;
    } catch {}
  }
  logoCache = null;
  return null;
}

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

  return buildInspectionPdf({
    title: "RAPPORT D'INSPECTION",
    subtitle: `NaviGarde IA - ${report.reference} - version ${report.version}`,
    logo: (await loadLogo()) ? { data: (await loadLogo())! } : null,
    meta,
    sections: [
      { heading: "SYNTHESE", lines: [String(report.content ?? "").slice(0, 4000)] },
      { heading: "ANALYSE IA", lines: aiLines },
    ],
    tables: [{
      heading: `Anomalies (${findings.length})`,
      headers: ["#", "Categorie", "Description", "Risque", "Statut"],
      widths: [24, 92, 227, 70, 86],
      rows: findings.length
        ? findings.map((f, index) => [String(index + 1), f.anomalyType, f.description, f.riskLevel, f.humanStatus])
        : [["-", "-", "Aucune anomalie enregistree", "-", "-"]],
    }],
    images: photoInputs,
    footerNote: "L'IA propose, l'humain decide. Ce rapport doit etre relu et valide par un superviseur avant toute decision operationnelle.",
  });
}

