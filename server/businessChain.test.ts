import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import { testConnection, hasDatabase, assertLeastPrivilege } from "./testDb";

/**
 * Chaîne métier qui constitue la valeur du produit :
 *
 *   inspection  ->  analyse IA sauvegardée  ->  anomalies
 *               ->  revue humaine (confirmation) ->  alerte urgente
 *               ->  rapport PDF -> validation -> version incrémentée
 *
 * Une régression ici coûte plus cher qu'une régression de configuration : ces
 * tests verrouillent le comportement attendu sur une vraie base MySQL.
 */

const suite = hasDatabase() ? describe : describe.skip;
const RUN = Date.now();
const REGISTRATION = `CHAIN-${RUN}`;

describe("raisonnement de risque (pur, sans base)", () => {
  it("classe le score de risque en quatre niveaux explicites", async () => {
    // Reproduit la règle utilisée par data.dashboard.metrics et saveAnalysis.
    const level = (score: number) => (score >= 75 ? "critique" : score >= 50 ? "eleve" : score >= 25 ? "moyen" : "faible");
    expect(level(0)).toBe("faible");
    expect(level(24)).toBe("faible");
    expect(level(25)).toBe("moyen");
    expect(level(49)).toBe("moyen");
    expect(level(50)).toBe("eleve");
    expect(level(74)).toBe("eleve");
    expect(level(75)).toBe("critique");
    expect(level(100)).toBe("critique");
  });

  it("interdit la sortie au-dessus du seuil critique", async () => {
    // Reproduit predictive.riskScore.canDepart : score < 75 et pas de surcharge.
    const canDepart = (score: number, overload: number, wind: number) => score < 75 && overload < 1 && wind < 35;
    expect(canDepart(74, 0, 10)).toBe(true);
    expect(canDepart(75, 0, 10)).toBe(false);
    expect(canDepart(40, 1, 10)).toBe(false);
    expect(canDepart(40, 0, 35)).toBe(false);
  });
});

suite("Chaîne métier inspection -> anomalie -> alerte -> rapport (base réelle)", () => {
  let agent: any;
  let supervisor: any;
  let agentUserId: number;
  let inspectionId: number;
  let vesselId: number;
  let alertId: number | undefined;
  let reportId: number | undefined;

  const callerFor = async (email: string) => {
    const db = await import("./db");
    const user = await db.getUserByEmail(email);
    if (!user) throw new Error(`Compte de test absent : ${email}`);
    return {
      caller: appRouter.createCaller({
        req: { headers: {}, ip: `chain-${email}`, protocol: "https" } as any,
        res: { cookie: () => {}, clearCookie: () => {} } as any,
        user: user as any,
        csrfToken: "",
      }),
      userId: user.id,
    };
  };

  beforeAll(async () => {
    if (!hasDatabase()) return;
    assertLeastPrivilege();
    const a = await callerFor("agent@navigarde.bj");
    agent = a.caller;
    agentUserId = a.userId;
    supervisor = (await callerFor("superviseur@navigarde.bj")).caller;

    const created = await agent.data.inspections.createFull({
      registrationNumber: REGISTRATION,
      vesselType: "Pirogue motorisée",
      ownerName: "Propriétaire chaîne de test",
      capacity: 12,
      place: "Débarcadère de Ganvié",
      comments: "Inspection automatique de bout en bout",
    });
    inspectionId = created.inspectionId;
    vesselId = created.vesselId;
  });

  afterAll(async () => {
    if (!hasDatabase()) return;
    const c = await testConnection();
    try {
      if (reportId) {
        await c.query("DELETE FROM report_versions WHERE reportId=?", [reportId]);
        await c.query("DELETE FROM reports WHERE id=?", [reportId]);
      }
      if (alertId) await c.query("DELETE FROM alerts WHERE id=?", [alertId]);
      await c.query("DELETE FROM inspection_findings WHERE inspectionId=?", [inspectionId]);
      await c.query("DELETE FROM inspection_images WHERE inspectionId=?", [inspectionId]);
      await c.query("DELETE FROM inspection_history WHERE inspectionId=?", [inspectionId]);
      await c.query("DELETE FROM inspections WHERE id=?", [inspectionId]);
      await c.query("DELETE FROM vessels WHERE id=?", [vesselId]);
    } catch {
      /* la base peut avoir déjà nettoyé ces lignes */
    }
    await c.end();
  });

  it("1. crée une inspection rattachée à l'agent connecté", async () => {
    const detail = await agent.data.inspections.get({ id: inspectionId });
    expect(detail.inspection.vesselId).toBe(vesselId);
    expect(detail.inspection.agentId).toBe(agentUserId);
    expect(detail.inspection.status).toBe("en_cours");
    expect(detail.vessel?.registrationNumber).toBe(REGISTRATION);
  });

  it("2. persiste l'analyse IA : score, confiance, anomalies", async () => {
    await agent.data.inspections.saveAnalysis({
      inspectionId,
      analysis: {
        passengersDetected: 18,
        lifejacketsVisible: 6,
        capacityRisk: "critique",
        riskScore: 82,
        confidence: 91,
        hull: "endommagé",
        engine: "à vérifier",
        findings: ["Surcapacité de 6 passagers", "Absence de gilets pour 12 passagers", "Coque fissurée à bâbord"],
        recommendation: "Immobilisation immédiate jusqu'à contrôle technique.",
        uncertainty: ["Visibilité réduite sur le moteur"],
      },
    });

    const detail = await agent.data.inspections.get({ id: inspectionId });
    expect(detail.inspection.riskScore).toBe(82);
    expect(detail.inspection.confidence).toBe(91);
    expect(detail.inspection.status).toBe("a_verifier");
    expect(detail.inspection.analysisProvider).toBeTruthy();
    expect(detail.findings).toHaveLength(3);
  });

  it("3. dérive le niveau de risque de chaque anomalie depuis le score", async () => {
    const detail = await agent.data.inspections.get({ id: inspectionId });
    // riskScore 82 -> tout ce qui est produit par saveAnalysis est « critique ».
    expect(detail.findings.every((f: any) => f.riskLevel === "critique")).toBe(true);
    expect(detail.findings.every((f: any) => f.humanStatus === "a_verifier")).toBe(true);
  });

  it("4. la confirmation d'une anomalie par le superviseur crée une alerte urgente", async () => {
    const detail = await agent.data.inspections.get({ id: inspectionId });
    const finding = detail.findings[0];
    const result = await supervisor.data.inspections.review({
      inspectionId,
      findingId: finding.id,
      status: "confirmee",
      note: "Surcapacité constatée sur place par le superviseur.",
    });
    expect(result.success).toBe(true);
    expect(result.alertId).toBeDefined();
    alertId = result.alertId;

    const alert = await supervisor.data.alerts.get({ id: alertId! });
    expect(alert.urgency).toBe("urgent");
    expect(alert.source).toBe("ia");
    expect(alert.vesselId).toBe(vesselId);

    const after = await agent.data.inspections.get({ id: inspectionId });
    expect(after.findings.find((f: any) => f.id === finding.id).humanStatus).toBe("confirmee");
  });

  it("5. un agent ne peut pas confirmer lui-même une anomalie", async () => {
    const detail = await agent.data.inspections.get({ id: inspectionId });
    const finding = detail.findings[1];
    await expect(
      agent.data.inspections.review({ inspectionId, findingId: finding.id, status: "confirmee" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("6. génère un rapport PDF versionné à partir de l'inspection", async () => {
    const created = await agent.data.reports.createFromInspection({ inspectionId });
    reportId = created.id;
    expect(created.reference).toMatch(/^RPT-\d{4}-\d{6}$/);
    expect(created.pdfSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(created.pdfUrl).toBe(`/api/reports/${reportId}/pdf`);
  });

  it("7. le rapport exposé par l'API ne contient pas la clé de stockage", async () => {
    const detail = await agent.data.reports.get({ id: reportId! });
    expect(detail.report).not.toHaveProperty("pdfStorageKey");
    expect(detail.report.version).toBe(1);
    expect(detail.report.status).toBe("brouillon");

    const list = await agent.data.reports.list({ limit: 500, offset: 0 });
    const mine = list.find((r: any) => r.id === reportId);
    expect(mine).toBeDefined();
    expect(mine).not.toHaveProperty("pdfStorageKey");
  });

  it("8. la modification incrémente la version et repasse en validation", async () => {
    const result = await agent.data.reports.update({
      id: reportId!,
      content: "Rapport complété après confirmation de l'anomalie critique par le superviseur.",
    });
    expect(result.version).toBe(2);

    const detail = await agent.data.reports.get({ id: reportId! });
    expect(detail.report.version).toBe(2);
    expect(detail.report.status).toBe("a_valider");
    expect(detail.versions).toHaveLength(2);
  });

  it("9. seul un superviseur valide le rapport, et la trace d'audit est écrite", async () => {
    await expect(agent.data.reports.validate({ id: reportId! })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await supervisor.data.reports.validate({ id: reportId! });

    const detail = await supervisor.data.reports.get({ id: reportId! });
    expect(detail.report.status).toBe("valide");
    expect(detail.report.validatedAt).toBeTruthy();

    const audit = await supervisor.data.audit.list({ limit: 50, action: "report.validate" });
    expect(audit.some((event: any) => event.entityId === String(reportId))).toBe(true);
  });
});
