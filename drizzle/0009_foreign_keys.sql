SET SESSION sql_mode='NO_ENGINE_SUBSTITUTION';--> statement-breakpoint
ALTER TABLE `inspections` ADD CONSTRAINT `fk_inspections_vessel` FOREIGN KEY (`vesselId`) REFERENCES `vessels` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE `inspection_images` ADD CONSTRAINT `fk_inspection_images_inspection` FOREIGN KEY (`inspectionId`) REFERENCES `inspections` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE `inspection_findings` ADD CONSTRAINT `fk_inspection_findings_inspection` FOREIGN KEY (`inspectionId`) REFERENCES `inspections` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE `inspection_history` ADD CONSTRAINT `fk_inspection_history_inspection` FOREIGN KEY (`inspectionId`) REFERENCES `inspections` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE `inspection_history` ADD CONSTRAINT `fk_inspection_history_user` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE `alert_history` ADD CONSTRAINT `fk_alert_history_alert` FOREIGN KEY (`alertId`) REFERENCES `alerts` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE `alert_history` ADD CONSTRAINT `fk_alert_history_user` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE `reports` ADD CONSTRAINT `fk_reports_created_by` FOREIGN KEY (`createdBy`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE `report_versions` ADD CONSTRAINT `fk_report_versions_report` FOREIGN KEY (`reportId`) REFERENCES `reports` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE `auth_sessions` ADD CONSTRAINT `fk_auth_sessions_user` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE `password_reset_tokens` ADD CONSTRAINT `fk_password_reset_tokens_user` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `fk_notifications_user` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE `vessel_positions` ADD CONSTRAINT `fk_vessel_positions_vessel` FOREIGN KEY (`vesselId`) REFERENCES `vessels` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;--> statement-breakpoint
ALTER TABLE `alerts` ADD CONSTRAINT `fk_alerts_vessel` FOREIGN KEY (`vesselId`) REFERENCES `vessels` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
