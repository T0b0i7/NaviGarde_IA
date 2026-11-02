import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { createHash } from "node:crypto";
import { drizzle } from "drizzle-orm/mysql2";
import { alertHistory, alerts, appSettings, authSessions, auditEvents, InsertUser, inspectionFindings, inspectionHistory, inspectionImages, inspections, maritimeBulletins, maritimeZones, notifications, passwordResetTokens, reportVersions, reports, users, vessels, vesselPositions, weatherBulletins } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    throw new Error("Database is not available");
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
      if (user.role === "admin") {
        values.appRole = "admin";
        updateSet.appRole = "admin";
      }
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
      values.appRole = "admin";
      updateSet.appRole = "admin";
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function listVessels(limit = 100, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(vessels).orderBy(desc(vessels.updatedAt)).limit(limit).offset(offset);
}

export async function createVessel(input: typeof vessels.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.insert(vessels).values(input);
  return { id: Number(result[0].insertId) };
}

export async function updateVessel(id: number, input: Partial<typeof vessels.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(vessels).set({ ...input, updatedAt: new Date() }).where(eq(vessels.id, id));
  return { success: true };
}

export async function deleteVessel(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(vessels).where(eq(vessels.id, id));
  return { success: true };
}

export async function listAlerts(limit = 100, offset = 0) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(alerts).orderBy(desc(alerts.createdAt)).limit(limit).offset(offset);
}

export async function createAlert(input: typeof alerts.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.insert(alerts).values(input);
  return { id: Number(result[0].insertId) };
}

export async function updateAlert(id: number, input: Partial<typeof alerts.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(alerts).set(input).where(eq(alerts.id, id));
  return { success: true };
}

export async function deleteAlert(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(alerts).where(eq(alerts.id, id));
  return { success: true };
}

export async function listNotifications(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt));
}

export async function markNotificationRead(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
  return { success: true };
}

export async function markAllNotificationsRead(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(notifications).set({ readAt: new Date() }).where(eq(notifications.userId, userId));
  return { success: true };
}

export async function listMaritimeZones() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(maritimeZones).where(eq(maritimeZones.active, 1));
}

export async function createMaritimeZone(input: typeof maritimeZones.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.insert(maritimeZones).values(input);
  return { id: Number(result[0].insertId) };
}

export async function listWeatherBulletins(place?: string) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(weatherBulletins).orderBy(desc(weatherBulletins.validUntil));
  return place ? rows.filter((row) => row.place === place) : rows;
}

export async function createWeatherBulletin(input: typeof weatherBulletins.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.insert(weatherBulletins).values(input);
  return { id: Number(result[0].insertId) };
}

export async function saveVesselPosition(input: typeof vesselPositions.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.insert(vesselPositions).values(input);
  return { id: Number(result[0].insertId) };
}


export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result[0];
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function createLocalUser(input: { openId: string; email: string; name: string; passwordHash: string; appRole: "agent" | "supervisor" | "admin" | "observer" }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.insert(users).values({ ...input, loginMethod: "local", role: input.appRole === "admin" ? "admin" : "user" });
  return { id: Number(result[0].insertId) };
}

export async function updateUserRole(id: number, appRole: "agent" | "supervisor" | "admin" | "observer") {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(users).set({ appRole, role: appRole === "admin" ? "admin" : "user", updatedAt: new Date() }).where(eq(users.id, id));
  return { success: true };
}

export async function setUserActive(id: number, isActive: boolean) { const db = await getDb(); if (!db) throw new Error("Database is not available"); await db.update(users).set({ isActive: isActive ? 1 : 0, updatedAt: new Date() }).where(eq(users.id, id)); return { success: true }; }

export async function setUserPassword(id: number, passwordHash: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, id));
}

export async function createAuthSession(input: { userId: number; tokenHash: string; expiresAt: Date }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(authSessions).where(eq(authSessions.userId, input.userId));
  await db.insert(authSessions).values(input);
}

export async function getUserBySessionToken(tokenHash: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const rows = await db.select({ user: users, session: authSessions }).from(authSessions).innerJoin(users, eq(authSessions.userId, users.id)).where(and(eq(authSessions.tokenHash, tokenHash), gt(authSessions.expiresAt, new Date()))).limit(1);
  if (!rows[0]) return undefined;
  await db.update(authSessions).set({ lastSeenAt: new Date() }).where(eq(authSessions.id, rows[0].session.id));
  return rows[0].user;
}

export async function revokeAuthSession(tokenHash: string) {
  const db = await getDb();
  if (!db) return;
  await db.delete(authSessions).where(eq(authSessions.tokenHash, tokenHash));
}

export async function createPasswordResetToken(input: { userId: number; tokenHash: string; expiresAt: Date }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(passwordResetTokens).where(and(eq(passwordResetTokens.userId, input.userId), isNull(passwordResetTokens.usedAt)));
  await db.insert(passwordResetTokens).values(input);
}

export async function consumePasswordResetToken(tokenHash: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const rows = await db.select().from(passwordResetTokens).where(and(eq(passwordResetTokens.tokenHash, tokenHash), isNull(passwordResetTokens.usedAt), gt(passwordResetTokens.expiresAt, new Date()))).limit(1);
  const token = rows[0];
  if (!token) return undefined;
  await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, token.id));
  return token;
}

export async function listUsers() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.select({ id: users.id, name: users.name, email: users.email, appRole: users.appRole, isActive: users.isActive, createdAt: users.createdAt, lastSignedIn: users.lastSignedIn }).from(users).orderBy(desc(users.createdAt));
}

export async function listMaritimeBulletins() { const db = await getDb(); if (!db) throw new Error("Database is not available"); return db.select().from(maritimeBulletins).orderBy(desc(maritimeBulletins.createdAt)); }
export async function createMaritimeBulletin(input: typeof maritimeBulletins.$inferInsert) { const db = await getDb(); if (!db) throw new Error("Database is not available"); const result = await db.insert(maritimeBulletins).values(input); return { id: Number(result[0].insertId) }; }
export async function updateMaritimeBulletin(id: number, input: Partial<typeof maritimeBulletins.$inferInsert>) { const db = await getDb(); if (!db) throw new Error("Database is not available"); await db.update(maritimeBulletins).set({ ...input, updatedAt: new Date() }).where(eq(maritimeBulletins.id, id)); return { success: true }; }
export async function listAuditEvents() { const db = await getDb(); if (!db) throw new Error("Database is not available"); return db.select().from(auditEvents).orderBy(desc(auditEvents.createdAt)).limit(500); }
export async function addAuditEvent(input: typeof auditEvents.$inferInsert) { const db = await getDb(); if (!db) throw new Error("Database is not available"); const result = await db.insert(auditEvents).values(input); return { id: Number(result[0].insertId) }; }
export async function getAppSettings() { const db = await getDb(); if (!db) throw new Error("Database is not available"); return db.select().from(appSettings); }
export async function upsertAppSetting(settingKey: string, value: string, updatedBy: number) { const db = await getDb(); if (!db) throw new Error("Database is not available"); await db.insert(appSettings).values({ settingKey, value, updatedBy }).onDuplicateKeyUpdate({ set: { value, updatedBy, updatedAt: new Date() } }); return { success: true }; }


export async function createInspection(input: typeof inspections.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.insert(inspections).values(input);
  return { id: Number(result[0].insertId) };
}

export async function listInspections(limit = 100, offset = 0) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.select().from(inspections).orderBy(desc(inspections.inspectionDate)).limit(limit).offset(offset);
}

export async function getInspection(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const rows = await db.select().from(inspections).where(eq(inspections.id, id)).limit(1);
  return rows[0];
}

export async function updateInspection(id: number, input: Partial<typeof inspections.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(inspections).set({ ...input, updatedAt: new Date() }).where(eq(inspections.id, id));
  return { success: true };
}

export async function addInspectionImage(input: typeof inspectionImages.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.insert(inspectionImages).values(input);
  return { id: Number(result[0].insertId) };
}

export async function listInspectionImages(inspectionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.select().from(inspectionImages).where(eq(inspectionImages.inspectionId, inspectionId)).orderBy(inspectionImages.createdAt);
}

export async function replaceInspectionFindings(inspectionId: number, findings: Array<typeof inspectionFindings.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.delete(inspectionFindings).where(eq(inspectionFindings.inspectionId, inspectionId));
  if (findings.length) await db.insert(inspectionFindings).values(findings);
}

export async function listInspectionFindings(inspectionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.select().from(inspectionFindings).where(eq(inspectionFindings.inspectionId, inspectionId)).orderBy(desc(inspectionFindings.analyzedAt));
}

export async function listReports(limit = 100, offset = 0) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.select().from(reports).orderBy(desc(reports.createdAt)).limit(limit).offset(offset);
}

export async function dashboardMetrics(period: "24 heures" | "7 jours" | "30 jours") {
  const [inspectionRows, alertRows, vesselRows, reportRows] = await Promise.all([listInspections(1000), listAlerts(500), listVessels(500), listReports(500)]);
  const now = new Date();
  const days = period === "24 heures" ? 1 : period === "30 jours" ? 30 : 7;
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const scoped = inspectionRows.filter((row) => new Date(row.inspectionDate).getTime() >= since.getTime());
  const dayKey = (value: Date) => value.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
  const buckets = Array.from({ length: days }, (_, index) => { const date = new Date(now.getTime() - (days - index - 1) * 24 * 60 * 60 * 1000); return { day: dayKey(date), confirmed: 0, progress: 0, rejected: 0 }; });
  for (const row of scoped) { const bucket = buckets.find((item) => item.day === dayKey(new Date(row.inspectionDate))); if (!bucket) continue; if (row.status === "terminee") bucket.confirmed += 1; else if (row.status === "rejetee") bucket.rejected += 1; else bucket.progress += 1; }
  const risks = [{ name: "Faible", value: 0, color: "#16b981" }, { name: "Moyen", value: 0, color: "#f6c321" }, { name: "Élevé", value: 0, color: "#f28a1e" }, { name: "Critique", value: 0, color: "#e63b46" }];
  for (const row of scoped) { const risk = row.riskScore >= 75 ? risks[3] : row.riskScore >= 50 ? risks[2] : row.riskScore >= 25 ? risks[1] : risks[0]; risk.value += 1; }
  const totalRisk = Math.max(1, scoped.length); risks.forEach((risk) => { risk.value = Math.round((risk.value / totalRisk) * 100); });
  return { totals: { inspections: inspectionRows.length, inspectionsToday: inspectionRows.filter((row) => new Date(row.inspectionDate).toDateString() === now.toDateString()).length, openAlerts: alertRows.filter((row) => row.status !== "resolue").length, pendingReports: reportRows.filter((row) => row.status !== "valide").length, vessels: vesselRows.length }, activity: buckets, risks, recentAlerts: alertRows.slice(0, 5), recentInspections: inspectionRows.slice(0, 8), period };
}


export async function addInspectionHistory(input: typeof inspectionHistory.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(inspectionHistory).values(input);
}

export async function listInspectionHistory(inspectionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.select().from(inspectionHistory).where(eq(inspectionHistory.inspectionId, inspectionId)).orderBy(desc(inspectionHistory.createdAt));
}

export async function updateInspectionFinding(id: number, inspectionId: number, input: { humanStatus: "a_verifier" | "confirmee" | "corrigee" | "ignoree"; humanNote?: string; confirmedBy?: number | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(inspectionFindings).set({ ...input, confirmedAt: input.humanStatus === "a_verifier" ? null : new Date() }).where(and(eq(inspectionFindings.id, id), eq(inspectionFindings.inspectionId, inspectionId)));
}

export async function transitionInspection(id: number, input: { status: "brouillon" | "en_cours" | "en_analyse" | "a_verifier" | "validee" | "rejetee" | "cloturee" | "terminee"; userId: number; humanReview?: "non_revue" | "confirmee" | "corrigee" | "rejetee"; humanNotes?: string; metadata?: unknown }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const current = await getInspection(id);
  if (!current) throw new Error("Inspection introuvable");
  await db.update(inspections).set({ status: input.status, humanReview: input.humanReview ?? current.humanReview, humanNotes: input.humanNotes ?? current.humanNotes, validatedBy: ["validee", "cloturee"].includes(input.status) ? input.userId : current.validatedBy, validatedAt: ["validee", "cloturee"].includes(input.status) ? new Date() : current.validatedAt }).where(eq(inspections.id, id));
  await addInspectionHistory({ inspectionId: id, userId: input.userId, action: "transition_statut", fromStatus: current.status, toStatus: input.status, notes: input.humanNotes, metadata: input.metadata ? JSON.stringify(input.metadata) : null });
  return { success: true, status: input.status };
}

export async function addAlertHistory(input: typeof alertHistory.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(alertHistory).values(input);
}

export async function listAlertHistory(alertId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.select().from(alertHistory).where(eq(alertHistory.alertId, alertId)).orderBy(desc(alertHistory.createdAt));
}

export async function updateAlertWithHistory(id: number, userId: number, patch: Partial<typeof alerts.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const rows = await db.select().from(alerts).where(eq(alerts.id, id)).limit(1);
  const current = rows[0];
  if (!current) throw new Error("Alerte introuvable");
  await db.update(alerts).set({ ...patch, resolvedAt: ["resolue", "cloturee"].includes(patch.status ?? "") ? new Date() : current.resolvedAt }).where(eq(alerts.id, id));
  await addAlertHistory({ alertId: id, userId, action: patch.assignedTo !== undefined ? "affectation" : "mise_a_jour", fromStatus: current.status, toStatus: patch.status ?? current.status, comment: patch.description ?? null });
  return { success: true };
}

function escapePdfText(value: string) { return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/[^\x20-\x7EÀ-ÿ]/g, " "); }
export function makeInspectionPdf(title: string, lines: string[]) {
  const body = ["BT", "/F1 18 Tf", "50 780 Td", `(${escapePdfText(title)}) Tj`, "/F1 10 Tf", ...lines.flatMap((line) => [`0 -22 Td`, `(${escapePdfText(line)}) Tj`]), "ET"].join("\n");
  const objects = [`1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj`, `2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj`, `3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj`, `4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj`, `5 0 obj << /Length ${Buffer.byteLength(body)} >> stream\n${body}\nendstream endobj`];
  let pdf = "%PDF-1.4\n"; const offsets = [0]; for (const object of objects) { offsets.push(Buffer.byteLength(pdf)); pdf += `${object}\n`; } const xref = Buffer.byteLength(pdf); pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`; for (let index = 1; index < offsets.length; index++) pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`; pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`; return Buffer.from(pdf, "latin1");
}

export function sha256(buffer: Buffer) { return createHash("sha256").update(buffer).digest("hex"); }


export async function createReport(input: typeof reports.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const result = await db.insert(reports).values(input);
  return { id: Number(result[0].insertId) };
}

export async function getReport(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const rows = await db.select().from(reports).where(eq(reports.id, id)).limit(1);
  return rows[0];
}

export async function updateReport(id: number, input: Partial<typeof reports.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(reports).set(input).where(eq(reports.id, id));
  return { success: true };
}

export async function addReportVersion(input: typeof reportVersions.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(reportVersions).values(input);
}

export async function listReportVersions(reportId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.select().from(reportVersions).where(eq(reportVersions.reportId, reportId)).orderBy(desc(reportVersions.version));
}


export async function createNotification(input: typeof notifications.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(notifications).values(input);
}
