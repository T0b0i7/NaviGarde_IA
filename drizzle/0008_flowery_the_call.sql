SET SESSION sql_mode='NO_ENGINE_SUBSTITUTION';--> statement-breakpoint
ALTER TABLE `alerts` MODIFY `resolvedAt` timestamp NULL DEFAULT NULL;--> statement-breakpoint
ALTER TABLE `inspections` MODIFY `analyzedAt` timestamp NULL DEFAULT NULL;--> statement-breakpoint
ALTER TABLE `inspections` MODIFY `validatedAt` timestamp NULL DEFAULT NULL;--> statement-breakpoint
ALTER TABLE `inspection_findings` MODIFY `confirmedAt` timestamp NULL DEFAULT NULL;--> statement-breakpoint
ALTER TABLE `password_reset_tokens` MODIFY `usedAt` timestamp NULL DEFAULT NULL;--> statement-breakpoint
ALTER TABLE `reports` MODIFY `validatedAt` timestamp NULL DEFAULT NULL;--> statement-breakpoint
ALTER TABLE `weather_bulletins` MODIFY `validUntil` timestamp NULL DEFAULT NULL;--> statement-breakpoint
ALTER TABLE `auth_sessions` MODIFY `expiresAt` timestamp NOT NULL DEFAULT current_timestamp();--> statement-breakpoint
ALTER TABLE `notifications` MODIFY `readAt` timestamp NULL DEFAULT NULL;--> statement-breakpoint
ALTER TABLE `maritime_bulletins` MODIFY `publishedAt` timestamp NULL DEFAULT NULL;--> statement-breakpoint
ALTER TABLE `alerts` ADD `archivedAt` timestamp NULL DEFAULT NULL;--> statement-breakpoint
ALTER TABLE `alerts` ADD `archivedBy` int NULL;--> statement-breakpoint
ALTER TABLE `inspections` ADD `archivedAt` timestamp NULL DEFAULT NULL;--> statement-breakpoint
ALTER TABLE `inspections` ADD `archivedBy` int NULL;--> statement-breakpoint
ALTER TABLE `reports` ADD `archivedAt` timestamp NULL DEFAULT NULL;--> statement-breakpoint
ALTER TABLE `reports` ADD `archivedBy` int NULL;--> statement-breakpoint
ALTER TABLE `vessels` ADD `archivedAt` timestamp NULL DEFAULT NULL;--> statement-breakpoint
ALTER TABLE `vessels` ADD `archivedBy` int NULL;--> statement-breakpoint
ALTER TABLE `maritime_bulletins` ADD `archivedAt` timestamp NULL DEFAULT NULL;--> statement-breakpoint
ALTER TABLE `maritime_bulletins` ADD `archivedBy` int NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `archivedAt` timestamp NULL DEFAULT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `archivedBy` int NULL;--> statement-breakpoint
ALTER TABLE `audit_events` ADD `entityLabel` varchar(255) NULL;--> statement-breakpoint
ALTER TABLE `audit_events` ADD `ip` varchar(64) NULL;--> statement-breakpoint
ALTER TABLE `audit_events` ADD `userAgent` varchar(255) NULL;--> statement-breakpoint
CREATE INDEX `alerts_archived_idx` ON `alerts` (`archivedAt`);--> statement-breakpoint
CREATE INDEX `inspections_archived_idx` ON `inspections` (`archivedAt`);--> statement-breakpoint
CREATE INDEX `reports_archived_idx` ON `reports` (`archivedAt`);--> statement-breakpoint
CREATE INDEX `vessels_archived_idx` ON `vessels` (`archivedAt`);--> statement-breakpoint
CREATE INDEX `maritime_bulletins_archived_idx` ON `maritime_bulletins` (`archivedAt`);--> statement-breakpoint
CREATE INDEX `audit_events_created_idx` ON `audit_events` (`createdAt`);--> statement-breakpoint
CREATE INDEX `audit_events_action_idx` ON `audit_events` (`action`);
