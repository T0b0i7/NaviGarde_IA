import { describe, expect, it } from "vitest";
import { publicReport, publicReports } from "./serializers";

describe("sérialisation des rapports", () => {
  const row = {
    id: 12,
    reference: "RPT-2026-000012",
    content: "Rapport",
    status: "valide",
    pdfStorageKey: "reports/12/v3_ab12cd34.pdf",
    pdfUrl: "/api/reports/12/pdf",
    pdfSha256: "abc",
  };

  it("ne laisse jamais fuiter la clé de stockage dans un rapport", () => {
    const safe = publicReport(row)!;
    expect(safe).not.toHaveProperty("pdfStorageKey");
    expect(safe.pdfUrl).toBe("/api/reports/12/pdf");
    expect(safe.pdfSha256).toBe("abc");
  });

  it("nettoie aussi les listes", () => {
    const safe = publicReports([row, { ...row, id: 13 }]);
    expect(safe).toHaveLength(2);
    expect(safe.every((r) => !("pdfStorageKey" in r))).toBe(true);
  });

  it("ne mute pas l'objet d'origine (la clé reste disponible côté serveur)", () => {
    publicReport(row);
    expect(row.pdfStorageKey).toBe("reports/12/v3_ab12cd34.pdf");
  });

  it("tolère une valeur absente", () => {
    expect(publicReport(undefined)).toBeUndefined();
  });
});
