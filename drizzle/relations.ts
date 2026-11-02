import { relations } from "drizzle-orm";
import {
  alerts,
  alertHistory,
  auditEvents,
  authSessions,
  inspectionFindings,
  inspectionHistory,
  inspectionImages,
  inspections,
  maritimeBulletins,
  maritimeZones,
  notifications,
  passwordResetTokens,
  reports,
  reportVersions,
  users,
  vesselPositions,
  vessels,
  weatherBulletins,
} from "./schema";

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(authSessions),
  passwordResets: many(passwordResetTokens),
  inspections: many(inspections),
  alertsCreated: many(alerts),
  notifications: many(notifications),
  auditEvents: many(auditEvents),
}));

export const authSessionsRelations = relations(authSessions, ({ one }) => ({
  user: one(users, { fields: [authSessions.userId], references: [users.id] }),
}));

export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  user: one(users, { fields: [passwordResetTokens.userId], references: [users.id] }),
}));

export const vesselsRelations = relations(vessels, ({ many }) => ({
  inspections: many(inspections),
  alerts: many(alerts),
  positions: many(vesselPositions),
}));

export const inspectionsRelations = relations(inspections, ({ one, many }) => ({
  vessel: one(vessels, { fields: [inspections.vesselId], references: [vessels.id] }),
  agent: one(users, { fields: [inspections.agentId], references: [users.id] }),
  validator: one(users, { fields: [inspections.validatedBy], references: [users.id] }),
  images: many(inspectionImages),
  findings: many(inspectionFindings),
  history: many(inspectionHistory),
  reports: many(reports),
}));

export const inspectionImagesRelations = relations(inspectionImages, ({ one }) => ({
  inspection: one(inspections, { fields: [inspectionImages.inspectionId], references: [inspections.id] }),
}));

export const inspectionFindingsRelations = relations(inspectionFindings, ({ one }) => ({
  inspection: one(inspections, { fields: [inspectionFindings.inspectionId], references: [inspections.id] }),
  confirmer: one(users, { fields: [inspectionFindings.confirmedBy], references: [users.id] }),
}));

export const inspectionHistoryRelations = relations(inspectionHistory, ({ one }) => ({
  inspection: one(inspections, { fields: [inspectionHistory.inspectionId], references: [inspections.id] }),
  user: one(users, { fields: [inspectionHistory.userId], references: [users.id] }),
}));

export const alertsRelations = relations(alerts, ({ one, many }) => ({
  vessel: one(vessels, { fields: [alerts.vesselId], references: [vessels.id] }),
  creator: one(users, { fields: [alerts.createdBy], references: [users.id] }),
  assignee: one(users, { fields: [alerts.assignedTo], references: [users.id] }),
  history: many(alertHistory),
}));

export const alertHistoryRelations = relations(alertHistory, ({ one }) => ({
  alert: one(alerts, { fields: [alertHistory.alertId], references: [alerts.id] }),
  user: one(users, { fields: [alertHistory.userId], references: [users.id] }),
}));

export const reportsRelations = relations(reports, ({ one, many }) => ({
  inspection: one(inspections, { fields: [reports.inspectionId], references: [inspections.id] }),
  creator: one(users, { fields: [reports.createdBy], references: [users.id] }),
  validator: one(users, { fields: [reports.validatedBy], references: [users.id] }),
  versions: many(reportVersions),
}));

export const reportVersionsRelations = relations(reportVersions, ({ one }) => ({
  report: one(reports, { fields: [reportVersions.reportId], references: [reports.id] }),
  creator: one(users, { fields: [reportVersions.createdBy], references: [users.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));

export const auditEventsRelations = relations(auditEvents, ({ one }) => ({
  user: one(users, { fields: [auditEvents.userId], references: [users.id] }),
}));

export const vesselPositionsRelations = relations(vesselPositions, ({ one }) => ({
  vessel: one(vessels, { fields: [vesselPositions.vesselId], references: [vessels.id] }),
}));

export const maritimeZonesRelations = relations(maritimeZones, ({ one }) => ({
  creator: one(users, { fields: [maritimeZones.createdBy], references: [users.id] }),
}));

export const weatherBulletinsRelations = relations(weatherBulletins, ({ one }) => ({
  creator: one(users, { fields: [weatherBulletins.createdBy], references: [users.id] }),
}));

export const maritimeBulletinsRelations = relations(maritimeBulletins, ({ one }) => ({
  creator: one(users, { fields: [maritimeBulletins.createdBy], references: [users.id] }),
}));