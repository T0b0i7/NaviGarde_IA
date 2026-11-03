import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { addAuditEvent, addInspectionImage, addReportVersion, createAlert, createInspection, createMaritimeBulletin, createNotification, createReport, createVessel, dashboardMetrics, deleteAlert, deleteVessel, getAlert, getAppSettings, getInspection, getReport, getVessel, getVesselByRegistration, listAlertHistory, listAlerts, listAuditEvents, listInspectionFindings, listInspectionHistory, listInspectionImages, listInspections, listMaritimeBulletins, listNotifications, listReportVersions, listReports, listVessels, makeInspectionPdf, markAllNotificationsRead, markNotificationRead, replaceInspectionFindings, sha256, transitionInspection, updateAlertWithHistory, updateInspection, updateInspectionFinding, updateMaritimeBulletin, updateReport, updateVessel, upsertAppSetting } from "./db";
import { storagePut } from "./storage";
import { protectedProcedure, publicProcedure, router, supervisorProcedure, adminAppProcedure as adminProcedure, operationalProcedure } from "./_core/trpc";


const vesselInput = z.object({
  registrationNumber: z.string().min(2).max(64), name: z.string().max(160).optional(), type: z.string().min(2).max(80), ownerName: z.string().min(2).max(160), ownerPhone: z.string().max(40).optional(), capacity: z.number().int().nonnegative(), lengthMeters: z.string().optional(), widthMeters: z.string().optional(), draftMeters: z.string().optional(), enginePower: z.number().int().nonnegative().optional(), fuelType: z.string().max(40).optional(), place: z.string().min(2).max(120), latitude: z.string().optional(), longitude: z.string().optional(), status: z.enum(["conforme", "sous_surveillance", "immobilisee", "non_enregistree"]).default("conforme"), riskScore: z.number().int().min(0).max(100).default(0),
});

const alertInput = z.object({
  vesselId: z.number().int().positive().optional(), title: z.string().min(2).max(180), description: z.string().max(10000).optional(), place: z.string().min(2).max(120), latitude: z.string().optional(), longitude: z.string().optional(), urgency: z.enum(["information", "elevee", "urgent", "detresse"]).default("information"), source: z.enum(["agent", "marin", "ia", "meteo", "systeme"]).default("agent"),
});

const analysisInput = z.object({
  passengersDetected: z.number().int().nonnegative(), lifejacketsVisible: z.number().int().nonnegative(), capacityRisk: z.enum(["faible", "moyen", "élevé", "critique", "à vérifier"]), riskScore: z.number().int().min(0).max(100), confidence: z.number().int().min(0).max(100), hull: z.enum(["bon", "à vérifier", "endommagé", "non visible"]), engine: z.enum(["bon", "à vérifier", "endommagé", "non visible"]), findings: z.array(z.string()).max(20), recommendation: z.string().max(5000), uncertainty: z.array(z.string()).max(20),
});

export const dataRouter = router({
  dashboard: router({
    metrics: protectedProcedure.input(z.object({ period: z.enum(["24 heures", "7 jours", "30 jours"]).default("7 jours") })).query(({ input }) => dashboardMetrics(input.period)),
  }),
  inspections: router({
    list: protectedProcedure.input(z.object({ limit: z.number().int().min(1).max(500).default(100), offset: z.number().int().min(0).default(0), vesselId: z.number().int().positive().optional() }).optional()).query(({ input }) => listInspections(input?.limit ?? 100, input?.offset ?? 0, input?.vesselId)),
    get: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ input }) => {
      const [inspection, images, findings, history] = await Promise.all([getInspection(input.id), listInspectionImages(input.id), listInspectionFindings(input.id), listInspectionHistory(input.id)]);
      if (!inspection) throw new TRPCError({ code: "NOT_FOUND", message: "Inspection introuvable." });
      const vessel = inspection.vesselId ? await getVessel(inspection.vesselId).catch(() => undefined) : undefined;
      return { inspection, images, findings, history, vessel };
    }),
    create: operationalProcedure.input(z.object({ vesselId: z.number().int().positive(), place: z.string().min(2).max(120), inspectionDate: z.coerce.date(), comments: z.string().max(10000).optional(), passengersDetected: z.number().int().nonnegative().default(0), lifejacketsVisible: z.number().int().nonnegative().default(0) })).mutation(async ({ input, ctx }) => {
      const created = await createInspection({ ...input, agentId: ctx.user.id, status: "en_cours" });
      await addAuditEvent({ userId: ctx.user.id, action: "inspection.create", entityType: "inspection", entityId: String(created.id), metadata: JSON.stringify({ vesselId: input.vesselId, place: input.place }) });
      return created;
    }),
    createFull: operationalProcedure.input(z.object({
      registrationNumber: z.string().min(2).max(64), vesselName: z.string().max(160).optional(),
      vesselType: z.string().min(2).max(80), ownerName: z.string().min(2).max(160),
      capacity: z.number().int().nonnegative().default(0), place: z.string().min(2).max(120),
      comments: z.string().max(10000).optional(),
    })).mutation(async ({ input, ctx }) => {
      let vessel = await getVesselByRegistration(input.registrationNumber.trim()).catch(() => undefined);
      if (!vessel) {
        const created = await createVessel({ registrationNumber: input.registrationNumber.trim(), name: input.vesselName || input.registrationNumber.trim(), type: input.vesselType, ownerName: input.ownerName, capacity: input.capacity, place: input.place, status: "conforme", riskScore: 0 });
        vessel = await getVessel(created.id);
      }
      if (!vessel) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Embarcation introuvable après création." });
      const inspection = await createInspection({ vesselId: vessel.id, place: input.place, inspectionDate: new Date(), comments: input.comments, agentId: ctx.user.id, status: "en_cours" });
      await addAuditEvent({ userId: ctx.user.id, action: "inspection.create", entityType: "inspection", entityId: String(inspection.id), metadata: JSON.stringify({ vesselId: vessel.id, place: input.place }) });
      return { inspectionId: inspection.id, vesselId: vessel.id, isNewVessel: false };
    }),
    update: protectedProcedure.input(z.object({ id: z.number().int().positive(), patch: z.object({ place: z.string().min(2).max(120).optional(), inspectionDate: z.coerce.date().optional(), comments: z.string().max(10000).optional(), status: z.enum(["brouillon", "en_cours", "en_analyse", "a_verifier", "validee", "rejetee", "cloturee", "terminee"]).optional() }) })).mutation(async ({ input, ctx }) => { const inspection = await getInspection(input.id); if (!inspection || (inspection.agentId !== ctx.user.id && !["admin", "supervisor"].includes(ctx.user.appRole))) throw new TRPCError({ code: "FORBIDDEN", message: "Cette inspection ne vous appartient pas." }); if (input.patch.status) return transitionInspection(input.id, { status: input.patch.status, userId: ctx.user.id, metadata: input.patch }); return updateInspection(input.id, input.patch); }),
    review: supervisorProcedure.input(z.object({ inspectionId: z.number().int().positive(), findingId: z.number().int().positive(), status: z.enum(["confirmee", "corrigee", "ignoree", "a_verifier"]), note: z.string().max(4000).optional() })).mutation(async ({ input, ctx }) => { await updateInspectionFinding(input.findingId, input.inspectionId, { humanStatus: input.status, humanNote: input.note, confirmedBy: ctx.user.id }); if (input.status === "confirmee") { const inspection = await getInspection(input.inspectionId); const alert = await createAlert({ createdBy: ctx.user.id, vesselId: inspection?.vesselId, title: "Anomalie confirmée après inspection", description: input.note ?? "Une anomalie détectée par l’IA a été confirmée par un superviseur.", place: inspection?.place ?? "Non renseigné", urgency: "urgent", source: "ia" }); await createNotification({ userId: ctx.user.id, type: "inspection_review", title: "Alerte créée automatiquement", message: "Une anomalie confirmée a généré une alerte urgente.", href: `/alertes` }); return { success: true, alertId: alert.id }; } return { success: true }; }),
    transition: supervisorProcedure.input(z.object({ inspectionId: z.number().int().positive(), status: z.enum(["a_verifier", "validee", "rejetee", "cloturee"]), humanReview: z.enum(["non_revue", "confirmee", "corrigee", "rejetee"]).optional(), notes: z.string().max(5000).optional() })).mutation(({ input, ctx }) => transitionInspection(input.inspectionId, { status: input.status, userId: ctx.user.id, humanReview: input.humanReview, humanNotes: input.notes })),
    uploadImage: protectedProcedure.input(z.object({ inspectionId: z.number().int().positive(), dataUrl: z.string().max(15_000_000), imageType: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/).default("inspection") })).mutation(async ({ input, ctx }) => { const inspection = await getInspection(input.inspectionId); if (!inspection || (inspection.agentId !== ctx.user.id && !["admin", "supervisor"].includes(ctx.user.appRole))) throw new TRPCError({ code: "FORBIDDEN", message: "Accès à cette inspection refusé." }); const match = input.dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/); if (!match) throw new TRPCError({ code: "BAD_REQUEST", message: "Format image non supporté. Utilisez JPEG, PNG ou WebP." }); const bytes = Buffer.from(match[2], "base64"); if (!bytes.length || bytes.length > 10 * 1024 * 1024) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Image vide ou supérieure à 10 Mo." }); const stored = await storagePut(`inspections/${input.inspectionId}/${Date.now()}.${match[1].split("/")[1]}`, bytes, match[1]); return addInspectionImage({ inspectionId: input.inspectionId, storageKey: stored.key, imageUrl: stored.url, imageType: input.imageType }); }),
    saveAnalysis: protectedProcedure.input(z.object({ inspectionId: z.number().int().positive(), analysis: analysisInput })).mutation(async ({ input, ctx }) => { const inspection = await getInspection(input.inspectionId); if (!inspection || (inspection.agentId !== ctx.user.id && !["admin", "supervisor"].includes(ctx.user.appRole))) throw new TRPCError({ code: "FORBIDDEN", message: "Accès à cette inspection refusé." }); const a = input.analysis; await updateInspection(input.inspectionId, { passengersDetected: a.passengersDetected, lifejacketsVisible: a.lifejacketsVisible, capacityRisk: a.capacityRisk === "élevé" ? "eleve" : a.capacityRisk === "à vérifier" ? "a_verifier" : a.capacityRisk, hullStatus: a.hull === "à vérifier" ? "a_verifier" : a.hull === "endommagé" ? "endommage" : a.hull === "non visible" ? "non_visible" : "bon", engineStatus: a.engine === "à vérifier" ? "a_verifier" : a.engine === "endommagé" ? "endommage" : a.engine === "non visible" ? "non_visible" : "bon", riskScore: a.riskScore, confidence: a.confidence, recommendation: a.recommendation, findings: JSON.stringify(a.findings), uncertainty: JSON.stringify(a.uncertainty), analyzedAt: new Date(), analysisProvider: "Baseten/Muse Spark Open", status: "a_verifier" }); await replaceInspectionFindings(input.inspectionId, a.findings.map((description) => ({ inspectionId: input.inspectionId, anomalyType: "anomalie_visible", description, riskLevel: a.riskScore >= 75 ? "critique" : a.riskScore >= 50 ? "eleve" : a.riskScore >= 25 ? "moyen" : "faible", confidence: a.confidence, recommendation: a.recommendation }))); return { success: true, requiresHumanReview: true }; }),
  }),
  vessels: router({
    list: protectedProcedure.input(z.object({ limit: z.number().int().min(1).max(500).default(100), offset: z.number().int().min(0).default(0) }).optional()).query(({ input }) => listVessels(input?.limit ?? 100, input?.offset ?? 0)),
    get: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ input }) => {
      const vessel = await getVessel(input.id);
      if (!vessel) throw new TRPCError({ code: "NOT_FOUND", message: "Embarcation introuvable." });
      const [inspections, alerts] = await Promise.all([listInspections(50, 0, input.id), listAlerts(50, 0, input.id)]);
      return { vessel, inspections, alerts };
    }),
    create: operationalProcedure.input(vesselInput).mutation(async ({ input, ctx }) => {
      const existing = await getVesselByRegistration(input.registrationNumber).catch(() => undefined);
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "Cette immatriculation existe déjà." });
      const created = await createVessel({ ...input, latitude: input.latitude, longitude: input.longitude });
      await addAuditEvent({ userId: ctx.user.id, action: "vessel.create", entityType: "vessel", entityId: String(created.id), metadata: JSON.stringify({ registrationNumber: input.registrationNumber }) });
      return created;
    }),
    update: supervisorProcedure.input(z.object({ id: z.number().int().positive(), patch: vesselInput.partial() })).mutation(async ({ input, ctx }) => {
      const result = await updateVessel(input.id, input.patch);
      await addAuditEvent({ userId: ctx.user.id, action: "vessel.update", entityType: "vessel", entityId: String(input.id), metadata: JSON.stringify(input.patch) });
      return result;
    }),
    remove: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input, ctx }) => {
      const linked = await listInspections(1, 0, input.id);
      if (linked.length > 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Impossible : des inspections sont liées à cette embarcation." });
      const result = await deleteVessel(input.id);
      await addAuditEvent({ userId: ctx.user.id, action: "vessel.delete", entityType: "vessel", entityId: String(input.id) });
      return result;
    }),
  }),
  alerts: router({
    list: protectedProcedure.input(z.object({ limit: z.number().int().min(1).max(500).default(100), offset: z.number().int().min(0).default(0), vesselId: z.number().int().positive().optional() }).optional()).query(({ input }) => listAlerts(input?.limit ?? 100, input?.offset ?? 0, input?.vesselId)),
    get: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ input }) => {
      const alert = await getAlert(input.id);
      if (!alert) throw new TRPCError({ code: "NOT_FOUND", message: "Alerte introuvable." });
      return alert;
    }),
    history: supervisorProcedure.input(z.object({ id: z.number().int().positive() })).query(({ input }) => listAlertHistory(input.id)),
    create: operationalProcedure.input(alertInput).mutation(async ({ input, ctx }) => {
      const created = await createAlert({ ...input, createdBy: ctx.user.id });
      await addAuditEvent({ userId: ctx.user.id, action: "alert.create", entityType: "alert", entityId: String(created.id), metadata: JSON.stringify({ title: input.title }) });
      return created;
    }),
    createPublic: publicProcedure.input(z.object({
      title: z.string().min(3).max(180), description: z.string().max(10000).optional(), place: z.string().min(2).max(120),
      latitude: z.string().optional(), longitude: z.string().optional(),
      urgency: z.enum(["information", "elevee", "urgent", "detresse"]).default("urgent"),
      contactPhone: z.string().max(40).optional(),
    })).mutation(async ({ input }) => {
      const created = await createAlert({ title: input.title, description: `${input.description ?? ""}${input.contactPhone ? ` (Contact: ${input.contactPhone})` : ""}`, place: input.place, latitude: input.latitude, longitude: input.longitude, urgency: input.urgency, source: "marin" });
      await addAuditEvent({ action: "alert.marin_create", entityType: "alert", entityId: String(created.id), metadata: JSON.stringify({ place: input.place }) });
      return created;
    }),
    update: supervisorProcedure.input(z.object({ id: z.number().int().positive(), patch: alertInput.partial().extend({ assignedTo: z.number().int().positive().nullable().optional(), description: z.string().max(10000).optional(), status: z.enum(["nouvelle", "en_cours", "affectee", "resolue", "cloturee", "prise_en_charge"]).optional() }) })).mutation(({ input, ctx }) => updateAlertWithHistory(input.id, ctx.user.id, input.patch)),
    remove: supervisorProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ input }) => deleteAlert(input.id)),
  }),
  reports: router({
    list: protectedProcedure.input(z.object({ limit: z.number().int().min(1).max(500).default(100), offset: z.number().int().min(0).default(0) }).optional()).query(({ input }) => listReports(input?.limit ?? 100, input?.offset ?? 0)),
    get: protectedProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ input }) => {
      const report = await getReport(input.id);
      if (!report) throw new TRPCError({ code: "NOT_FOUND", message: "Rapport introuvable." });
      const versions = await listReportVersions(input.id);
      const inspection = report.inspectionId ? await getInspection(report.inspectionId).catch(() => undefined) : undefined;
      const vessel = inspection?.vesselId ? await getVessel(inspection.vesselId).catch(() => undefined) : undefined;
      const images = report.inspectionId ? await listInspectionImages(report.inspectionId).catch(() => []) : [];
      const findings = report.inspectionId ? await listInspectionFindings(report.inspectionId).catch(() => []) : [];
      const history = report.inspectionId ? await listInspectionHistory(report.inspectionId).catch(() => []) : [];
      return { report, versions, inspection, vessel, images, findings, history };
    }),
    createFromInspection: operationalProcedure.input(z.object({ inspectionId: z.number().int().positive(), title: z.string().max(180).default("Rapport d’inspection NaviGarde IA") })).mutation(async ({ input, ctx }) => { const inspection = await getInspection(input.inspectionId); if (!inspection) throw new TRPCError({ code: "NOT_FOUND", message: "Inspection introuvable." }); const reference = `RPT-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`; const content = `${input.title}\nInspection #${inspection.id}\nLieu : ${inspection.place}\nScore de risque : ${inspection.riskScore}/100\nRecommandation : ${inspection.recommendation ?? "Vérification humaine recommandée."}\nStatut : ${inspection.status}`; const created = await createReport({ inspectionId: input.inspectionId, reference, content, status: "brouillon", createdBy: ctx.user.id }); const pdf = makeInspectionPdf(input.title, content.split("\n")); const hash = sha256(pdf); const stored = await storagePut(`reports/${created.id}/v1.pdf`, pdf, "application/pdf"); await updateReport(created.id, { pdfStorageKey: stored.key, pdfUrl: stored.url, pdfSha256: hash }); await addReportVersion({ reportId: created.id, version: 1, content, pdfSha256: hash, createdBy: ctx.user.id }); return { ...created, reference, pdfUrl: stored.url, pdfSha256: hash }; }),
    update: operationalProcedure.input(z.object({ id: z.number().int().positive(), content: z.string().min(10).max(50000) })).mutation(async ({ input, ctx }) => { const report = await getReport(input.id); if (!report) throw new TRPCError({ code: "NOT_FOUND", message: "Rapport introuvable." }); const version = report.version + 1; const pdf = makeInspectionPdf(report.reference, input.content.split("\n")); const hash = sha256(pdf); const stored = await storagePut(`reports/${input.id}/v${version}.pdf`, pdf, "application/pdf"); await updateReport(input.id, { content: input.content, version, pdfStorageKey: stored.key, pdfUrl: stored.url, pdfSha256: hash, status: "a_valider" }); await addReportVersion({ reportId: input.id, version, content: input.content, pdfSha256: hash, createdBy: ctx.user.id }); return { success: true, version, pdfUrl: stored.url, pdfSha256: hash }; }),
    validate: supervisorProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input, ctx }) => { await updateReport(input.id, { status: "valide", validatedBy: ctx.user.id, validatedAt: new Date() }); return { success: true }; }),
  }),
  notifications: router({
    list: protectedProcedure.query(({ ctx }) => listNotifications(ctx.user.id)),
    markRead: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ input, ctx }) => markNotificationRead(input.id, ctx.user.id)),
    markAllRead: protectedProcedure.mutation(({ ctx }) => markAllNotificationsRead(ctx.user.id)),
  }),
  bulletins: router({
    list: protectedProcedure.query(() => listMaritimeBulletins()),
    create: operationalProcedure.input(z.object({ title: z.string().min(3).max(180), category: z.string().min(2).max(80), maritimeZone: z.string().min(2).max(160), importance: z.enum(["information", "important", "urgent", "critique"]).default("information"), content: z.string().min(10).max(30000), attachments: z.array(z.string().url()).max(10).default([]) })).mutation(async ({ input, ctx }) => { const created = await createMaritimeBulletin({ ...input, attachments: JSON.stringify(input.attachments), createdBy: ctx.user.id }); await addAuditEvent({ userId: ctx.user.id, action: "bulletin.create", entityType: "maritime_bulletin", entityId: String(created.id), metadata: JSON.stringify(input) }); return created; }),
    update: operationalProcedure.input(z.object({ id: z.number().int().positive(), patch: z.object({ title: z.string().min(3).max(180).optional(), category: z.string().max(80).optional(), maritimeZone: z.string().max(160).optional(), importance: z.enum(["information", "important", "urgent", "critique"]).optional(), content: z.string().min(10).max(30000).optional(), attachments: z.array(z.string().url()).max(10).optional(), status: z.enum(["brouillon", "publie", "archive"]).optional() }) })).mutation(async ({ input, ctx }) => { const patch = { ...input.patch, attachments: input.patch.attachments ? JSON.stringify(input.patch.attachments) : undefined, publishedAt: input.patch.status === "publie" ? new Date() : undefined }; const result = await updateMaritimeBulletin(input.id, patch); await addAuditEvent({ userId: ctx.user.id, action: input.patch.status === "publie" ? "bulletin.publish" : "bulletin.update", entityType: "maritime_bulletin", entityId: String(input.id), metadata: JSON.stringify(input.patch) }); if (input.patch.status === "publie") { await createNotification({ userId: ctx.user.id, type: "bulletin_published", title: "Bulletin publié", message: `Le bulletin #${input.id} est maintenant visible par les équipes.`, href: "/bulletins" }); } return result; }),
  }),
  audit: router({ list: supervisorProcedure.query(() => listAuditEvents()) }),
  settings: router({ get: protectedProcedure.query(() => getAppSettings()), save: adminProcedure.input(z.object({ settings: z.record(z.string(), z.string()) })).mutation(async ({ input, ctx }) => { for (const [key, value] of Object.entries(input.settings)) await upsertAppSetting(key, value, ctx.user.id); await addAuditEvent({ userId: ctx.user.id, action: "settings.update", entityType: "app_settings", metadata: JSON.stringify(input.settings) }); return { success: true }; }) }),
});
