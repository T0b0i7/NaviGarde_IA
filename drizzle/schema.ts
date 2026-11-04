import { customType, int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, index } from "drizzle-orm/mysql-core";

/**
 * Binaire volumineux stocké en base (`LONGBLOB`).
 *
 * Choisi volontairement à la place de `longblob` type natif de Drizzle : le
 * driver mysql2 renvoie un `Buffer` pour les colonnes binaires, alors qu'un
 * `text` renverrait une chaîne altérée par l'encodage. Le `mapToDriverValue`
 * garantit que l'écriture ne transforme jamais les octets.
 */
const longBlob = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "longblob";
  },
  toDriver(value: Buffer) {
    return value;
  },
});


export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  appRole: mysqlEnum("appRole", ["agent", "supervisor", "admin", "observer"]).default("agent").notNull(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  isActive: int("isActive").default(1).notNull(),
  archivedAt: timestamp("archivedAt"),
  archivedBy: int("archivedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const authSessions = mysqlTable("auth_sessions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  tokenHash: varchar("tokenHash", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  lastSeenAt: timestamp("lastSeenAt").defaultNow().notNull(),
}, (table) => ({ userIndex: index("auth_sessions_user_idx").on(table.userId), expiryIndex: index("auth_sessions_expiry_idx").on(table.expiresAt) }));

export const passwordResetTokens = mysqlTable("password_reset_tokens", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  tokenHash: varchar("tokenHash", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  usedAt: timestamp("usedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ userIndex: index("password_reset_user_idx").on(table.userId), expiryIndex: index("password_reset_expiry_idx").on(table.expiresAt) }));

export const vessels = mysqlTable("vessels", {
  id: int("id").autoincrement().primaryKey(),
  registrationNumber: varchar("registrationNumber", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 160 }),
  type: varchar("type", { length: 80 }).notNull(),
  ownerName: varchar("ownerName", { length: 160 }).notNull(),
  ownerPhone: varchar("ownerPhone", { length: 40 }),
  capacity: int("capacity").notNull().default(0),
  lengthMeters: decimal("lengthMeters", { precision: 6, scale: 2 }),
  widthMeters: decimal("widthMeters", { precision: 6, scale: 2 }),
  draftMeters: decimal("draftMeters", { precision: 6, scale: 2 }),
  enginePower: int("enginePower"),
  fuelType: varchar("fuelType", { length: 40 }),
  place: varchar("place", { length: 120 }).notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  status: mysqlEnum("status", ["conforme", "sous_surveillance", "immobilisee", "non_enregistree"]).default("conforme").notNull(),
  riskScore: int("riskScore").default(0).notNull(),
  archivedAt: timestamp("archivedAt"),
  archivedBy: int("archivedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ placeIndex: index("vessels_place_idx").on(table.place), statusIndex: index("vessels_status_idx").on(table.status), archivedIndex: index("vessels_archived_idx").on(table.archivedAt) }));

export const inspections = mysqlTable("inspections", {
  id: int("id").autoincrement().primaryKey(),
  vesselId: int("vesselId").notNull(),
  agentId: int("agentId"),
  place: varchar("place", { length: 120 }).notNull(),
  inspectionDate: timestamp("inspectionDate").defaultNow().notNull(),
  comments: text("comments"),
  passengersDetected: int("passengersDetected").default(0).notNull(),
  lifejacketsVisible: int("lifejacketsVisible").default(0).notNull(),
  capacityRisk: mysqlEnum("capacityRisk", ["faible", "moyen", "eleve", "critique", "a_verifier"]).default("a_verifier").notNull(),
  hullStatus: mysqlEnum("hullStatus", ["bon", "a_verifier", "endommage", "non_visible"]).default("non_visible").notNull(),
  engineStatus: mysqlEnum("engineStatus", ["bon", "a_verifier", "endommage", "non_visible"]).default("non_visible").notNull(),
  riskScore: int("riskScore").default(0).notNull(),
  confidence: int("confidence").default(0).notNull(),
  recommendation: text("recommendation"),
  findings: text("findings"),
  uncertainty: text("uncertainty"),
  analyzedAt: timestamp("analyzedAt"),
  analysisProvider: varchar("analysisProvider", { length: 120 }),
  status: mysqlEnum("status", ["brouillon", "en_cours", "en_analyse", "a_verifier", "validee", "rejetee", "cloturee", "terminee"]).default("en_cours").notNull(),
  humanReview: mysqlEnum("humanReview", ["non_revue", "confirmee", "corrigee", "rejetee"]).default("non_revue").notNull(),
  humanNotes: text("humanNotes"),
  validatedBy: int("validatedBy"),
  validatedAt: timestamp("validatedAt"),
  archivedAt: timestamp("archivedAt"),
  archivedBy: int("archivedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ vesselIndex: index("inspections_vessel_idx").on(table.vesselId), dateIndex: index("inspections_date_idx").on(table.inspectionDate), archivedIndex: index("inspections_archived_idx").on(table.archivedAt) }));

export const inspectionImages = mysqlTable("inspection_images", {
  id: int("id").autoincrement().primaryKey(),
  inspectionId: int("inspectionId").notNull(),
  storageKey: varchar("storageKey", { length: 512 }).notNull(),
  imageUrl: varchar("imageUrl", { length: 1000 }).notNull(),
  imageType: varchar("imageType", { length: 80 }).default("inspection").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const inspectionFindings = mysqlTable("inspection_findings", {
  id: int("id").autoincrement().primaryKey(),
  inspectionId: int("inspectionId").notNull(),
  imageIndex: int("imageIndex"),
  anomalyType: varchar("anomalyType", { length: 120 }).notNull(),
  description: text("description").notNull(),
  riskLevel: mysqlEnum("riskLevel", ["faible", "moyen", "eleve", "critique", "a_verifier"]).default("a_verifier").notNull(),
  confidence: int("confidence").default(0).notNull(),
  recommendation: text("recommendation"),
  humanStatus: mysqlEnum("humanStatus", ["a_verifier", "confirmee", "corrigee", "ignoree"]).default("a_verifier").notNull(),
  humanNote: text("humanNote"),
  confirmedBy: int("confirmedBy"),
  confirmedAt: timestamp("confirmedAt"),
  analyzedAt: timestamp("analyzedAt").defaultNow().notNull(),
}, (table) => ({ inspectionIndex: index("inspection_findings_inspection_idx").on(table.inspectionId) }));

export const alerts = mysqlTable("alerts", {
  id: int("id").autoincrement().primaryKey(),
  vesselId: int("vesselId"),
  createdBy: int("createdBy"),
  assignedTo: int("assignedTo"),
  title: varchar("title", { length: 180 }).notNull(),
  description: text("description"),
  place: varchar("place", { length: 120 }).notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  urgency: mysqlEnum("urgency", ["information", "elevee", "urgent", "detresse"]).default("information").notNull(),
  status: mysqlEnum("status", ["nouvelle", "en_cours", "affectee", "resolue", "cloturee", "prise_en_charge"]).default("nouvelle").notNull(),
  source: mysqlEnum("source", ["agent", "marin", "ia", "meteo", "systeme"]).default("agent").notNull(),
  archivedAt: timestamp("archivedAt"),
  archivedBy: int("archivedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  resolvedAt: timestamp("resolvedAt"),
}, (table) => ({ statusIndex: index("alerts_status_idx").on(table.status), createdIndex: index("alerts_created_idx").on(table.createdAt), archivedIndex: index("alerts_archived_idx").on(table.archivedAt) }));

export const inspectionHistory = mysqlTable("inspection_history", {
  id: int("id").autoincrement().primaryKey(),
  inspectionId: int("inspectionId").notNull(),
  userId: int("userId"),
  action: varchar("action", { length: 120 }).notNull(),
  fromStatus: varchar("fromStatus", { length: 40 }),
  toStatus: varchar("toStatus", { length: 40 }),
  notes: text("notes"),
  metadata: text("metadata"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ inspectionIndex: index("inspection_history_inspection_idx").on(table.inspectionId) }));

export const alertHistory = mysqlTable("alert_history", {
  id: int("id").autoincrement().primaryKey(),
  alertId: int("alertId").notNull(),
  userId: int("userId"),
  action: varchar("action", { length: 120 }).notNull(),
  fromStatus: varchar("fromStatus", { length: 40 }),
  toStatus: varchar("toStatus", { length: 40 }),
  comment: text("comment"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ alertIndex: index("alert_history_alert_idx").on(table.alertId) }));

export const reports = mysqlTable("reports", {
  id: int("id").autoincrement().primaryKey(),
  inspectionId: int("inspectionId"),
  reference: varchar("reference", { length: 64 }).notNull().unique(),
  content: text("content").notNull(),
  status: mysqlEnum("status", ["brouillon", "a_valider", "valide"]).default("brouillon").notNull(),
  createdBy: int("createdBy"),
  validatedBy: int("validatedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  validatedAt: timestamp("validatedAt"),
  version: int("version").default(1).notNull(),
  pdfStorageKey: varchar("pdfStorageKey", { length: 512 }),
  pdfUrl: varchar("pdfUrl", { length: 1000 }),
  pdfSha256: varchar("pdfSha256", { length: 64 }),
  archivedAt: timestamp("archivedAt"),
  archivedBy: int("archivedBy"),
}, (table) => ({ archivedIndex: index("reports_archived_idx").on(table.archivedAt) }));

export const reportVersions = mysqlTable("report_versions", {
  id: int("id").autoincrement().primaryKey(),
  reportId: int("reportId").notNull(),
  version: int("version").notNull(),
  content: text("content").notNull(),
  pdfSha256: varchar("pdfSha256", { length: 64 }),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ reportIndex: index("report_versions_report_idx").on(table.reportId) }));

export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  type: varchar("type", { length: 40 }).notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  message: text("message").notNull(),
  href: varchar("href", { length: 255 }),
  readAt: timestamp("readAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ userIndex: index("notifications_user_idx").on(table.userId, table.readAt) }));

export const auditEvents = mysqlTable("audit_events", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  action: varchar("action", { length: 120 }).notNull(),
  entityType: varchar("entityType", { length: 80 }).notNull(),
  entityId: varchar("entityId", { length: 80 }),
  entityLabel: varchar("entityLabel", { length: 255 }),
  metadata: text("metadata"),
  ip: varchar("ip", { length: 64 }),
  userAgent: varchar("userAgent", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ createdIndex: index("audit_events_created_idx").on(table.createdAt), actionIndex: index("audit_events_action_idx").on(table.action) }));

export const maritimeZones = mysqlTable("maritime_zones", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 160 }).notNull(),
  description: text("description"),
  zoneType: mysqlEnum("zoneType", ["exclusion", "forte_houle", "peche_interdite", "frontiere"]).notNull(),
  polygon: text("polygon").notNull(),
  active: int("active").default(1).notNull(),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const weatherBulletins = mysqlTable("weather_bulletins", {
  id: int("id").autoincrement().primaryKey(),
  place: varchar("place", { length: 120 }).notNull(),
  windSpeed: int("windSpeed").default(0).notNull(),
  waveHeight: decimal("waveHeight", { precision: 4, scale: 1 }).default("0").notNull(),
  severity: mysqlEnum("severity", ["normal", "vigilance", "danger"]).default("normal").notNull(),
  message: text("message").notNull(),
  validFrom: timestamp("validFrom").defaultNow().notNull(),
  validUntil: timestamp("validUntil").notNull(),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const maritimeBulletins = mysqlTable("maritime_bulletins", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 180 }).notNull(),
  category: varchar("category", { length: 80 }).notNull(),
  maritimeZone: varchar("maritimeZone", { length: 160 }).notNull(),
  importance: mysqlEnum("importance", ["information", "important", "urgent", "critique"]).default("information").notNull(),
  content: text("content").notNull(),
  attachments: text("attachments"),
  status: mysqlEnum("status", ["brouillon", "publie", "archive"]).default("brouillon").notNull(),
  createdBy: int("createdBy"),
  publishedAt: timestamp("publishedAt"),
  archivedAt: timestamp("archivedAt"),
  archivedBy: int("archivedBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ statusIndex: index("maritime_bulletins_status_idx").on(table.status), zoneIndex: index("maritime_bulletins_zone_idx").on(table.maritimeZone), createdIndex: index("maritime_bulletins_created_idx").on(table.createdAt), archivedIndex: index("maritime_bulletins_archived_idx").on(table.archivedAt) }));

export const appSettings = mysqlTable("app_settings", {
  id: int("id").autoincrement().primaryKey(),
  settingKey: varchar("settingKey", { length: 120 }).notNull().unique(),
  value: text("value").notNull(),
  updatedBy: int("updatedBy"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ keyIndex: index("app_settings_key_idx").on(table.settingKey) }));

export const vesselPositions = mysqlTable("vessel_positions", {
  id: int("id").autoincrement().primaryKey(),
  vesselId: int("vesselId").notNull(),
  latitude: decimal("latitude", { precision: 10, scale: 7 }).notNull(),
  longitude: decimal("longitude", { precision: 10, scale: 7 }).notNull(),
  speed: int("speed").default(0).notNull(),
  heading: int("heading").default(0).notNull(),
  source: varchar("source", { length: 40 }).default("mobile").notNull(),
  capturedAt: timestamp("capturedAt").defaultNow().notNull(),
}, (table) => ({ vesselIndex: index("vessel_positions_vessel_idx").on(table.vesselId), capturedIndex: index("vessel_positions_captured_idx").on(table.capturedAt) }));

// -----------------------------------------------------------------------------
// Stockage des fichiers (photos d'inspection, PDF de rapports)
// -----------------------------------------------------------------------------
// Les fichiers sont écrits dans MySQL et non sur le disque du conteneur : un
// conteneur recréé repart d'une image vide, ce qui perdait toutes les photos
// et tous les PDF en production. La base est la seule ressource durable
// garantie par l'exploitation retenue.
//
// Avantages : sauvegarde et restauration suivent celles de la base, aucune
// dépendance externe (S3, volume, NFS), mêmes droits que les données métier.
// Contrainte : les binaires volumineux ne doivent pas dépasser `max_allowed_
// packet` de MySQL ; l'application limite les images à 10 Mo avant écriture.
export const storageObjects = mysqlTable("storage_objects", {
  id: int("id").autoincrement().primaryKey(),
  storageKey: varchar("storageKey", { length: 512 }).notNull().unique(),
  contentType: varchar("contentType", { length: 120 }).notNull(),
  sizeBytes: int("sizeBytes").notNull(),
  sha256: varchar("sha256", { length: 64 }).notNull(),
  data: longBlob("data").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ keyIndex: index("storage_objects_key_idx").on(table.storageKey), createdIndex: index("storage_objects_created_idx").on(table.createdAt) }));

export type StorageObject = typeof storageObjects.$inferSelect;

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Vessel = typeof vessels.$inferSelect;
export type Alert = typeof alerts.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
