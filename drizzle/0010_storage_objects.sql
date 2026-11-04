SET SESSION sql_mode='NO_ENGINE_SUBSTITUTION';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `storage_objects` (`id` int AUTO_INCREMENT NOT NULL, `storageKey` varchar(512) NOT NULL, `contentType` varchar(120) NOT NULL, `sizeBytes` int NOT NULL, `sha256` varchar(64) NOT NULL, `data` longblob NOT NULL, `createdAt` timestamp NOT NULL DEFAULT (now()), CONSTRAINT `storage_objects_id` PRIMARY KEY(`id`), CONSTRAINT `storage_objects_storageKey_unique` UNIQUE(`storageKey`));--> statement-breakpoint
CREATE INDEX `storage_objects_key_idx` ON `storage_objects` (`storageKey`);--> statement-breakpoint
CREATE INDEX `storage_objects_created_idx` ON `storage_objects` (`createdAt`);
