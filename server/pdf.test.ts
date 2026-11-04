import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildInspectionPdf, jpegSize } from "./pdf";

const jpegPath = [
  "public/boat-inspection.jpg",
  "dist/public/boat-inspection.jpg",
].find((p) => existsSync(p));

describe("pdf generator", () => {
  it("builds a valid text-only document", () => {
    const pdf = buildInspectionPdf({
      title: "RAPPORT D'INSPECTION",
      meta: [["Reference", "RPT-2026-000001"]],
      sections: [{ heading: "SYNTHESE", lines: ["Ligne de test avec accents : éàçù."] }],
    });
    const text = pdf.toString("latin1");
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("/Type /Catalog");
    expect(text).toContain("/Count 1");
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(text).toContain("RAPPORT D'INSPECTION");
  });

  it("paginates long content", () => {
    const lines = Array.from({ length: 120 }, (_, i) => `Ligne ${i + 1} - contenu de test pour verifier la pagination automatique du rapport.`);
    const pdf = buildInspectionPdf({ title: "PAGINATION", sections: [{ heading: "ANNEXE", lines }] });
    const text = pdf.toString("latin1");
    const count = Number(text.match(/\/Count (\d+)/)?.[1] ?? "0");
    expect(count).toBeGreaterThan(1);
  });

  it("embeds a JPEG photo", () => {
    if (!jpegPath) return;
    const data = readFileSync(jpegPath);
    const size = jpegSize(data);
    expect(size?.width).toBeGreaterThan(0);
    const pdf = buildInspectionPdf({
      title: "RAPPORT AVEC PHOTO",
      images: [{ data, caption: "Photo 1 - vue generale" }],
    });
    const text = pdf.toString("latin1");
    expect(text).toContain("/Subtype /Image");
    expect(text).toContain("/Filter /DCTDecode");
    expect(text).toContain("/ColorSpace /DeviceRGB");
    expect(text).toContain(`/Width ${size!.width}`);
  });
});
