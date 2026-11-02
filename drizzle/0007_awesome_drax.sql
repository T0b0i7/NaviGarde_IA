CREATE INDEX `app_settings_key_idx` ON `app_settings` (`settingKey`);--> statement-breakpoint
CREATE INDEX `maritime_bulletins_status_idx` ON `maritime_bulletins` (`status`);--> statement-breakpoint
CREATE INDEX `maritime_bulletins_zone_idx` ON `maritime_bulletins` (`maritimeZone`);--> statement-breakpoint
CREATE INDEX `maritime_bulletins_created_idx` ON `maritime_bulletins` (`createdAt`);