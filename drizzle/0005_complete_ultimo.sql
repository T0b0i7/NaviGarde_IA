CREATE TABLE `alert_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`alertId` int NOT NULL,
	`userId` int,
	`action` varchar(120) NOT NULL,
	`fromStatus` varchar(40),
	`toStatus` varchar(40),
	`comment` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `alert_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inspection_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`inspectionId` int NOT NULL,
	`userId` int,
	`action` varchar(120) NOT NULL,
	`fromStatus` varchar(40),
	`toStatus` varchar(40),
	`notes` text,
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inspection_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `report_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reportId` int NOT NULL,
	`version` int NOT NULL,
	`content` text NOT NULL,
	`pdfSha256` varchar(64),
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `report_versions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `alerts` MODIFY COLUMN `status` enum('nouvelle','en_cours','affectee','resolue','cloturee','prise_en_charge') NOT NULL DEFAULT 'nouvelle';--> statement-breakpoint
ALTER TABLE `inspections` MODIFY COLUMN `status` enum('brouillon','en_cours','en_analyse','a_verifier','validee','rejetee','cloturee','terminee') NOT NULL DEFAULT 'en_cours';--> statement-breakpoint
ALTER TABLE `inspection_findings` ADD `humanStatus` enum('a_verifier','confirmee','corrigee','ignoree') DEFAULT 'a_verifier' NOT NULL;--> statement-breakpoint
ALTER TABLE `inspection_findings` ADD `humanNote` text;--> statement-breakpoint
ALTER TABLE `inspection_findings` ADD `confirmedBy` int;--> statement-breakpoint
ALTER TABLE `inspection_findings` ADD `confirmedAt` timestamp;--> statement-breakpoint
ALTER TABLE `inspections` ADD `humanReview` enum('non_revue','confirmee','corrigee','rejetee') DEFAULT 'non_revue' NOT NULL;--> statement-breakpoint
ALTER TABLE `inspections` ADD `humanNotes` text;--> statement-breakpoint
ALTER TABLE `inspections` ADD `validatedBy` int;--> statement-breakpoint
ALTER TABLE `inspections` ADD `validatedAt` timestamp;--> statement-breakpoint
ALTER TABLE `reports` ADD `version` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `reports` ADD `pdfStorageKey` varchar(512);--> statement-breakpoint
ALTER TABLE `reports` ADD `pdfUrl` varchar(1000);--> statement-breakpoint
ALTER TABLE `reports` ADD `pdfSha256` varchar(64);--> statement-breakpoint
ALTER TABLE `vessels` ADD `lengthMeters` decimal(6,2);--> statement-breakpoint
ALTER TABLE `vessels` ADD `widthMeters` decimal(6,2);--> statement-breakpoint
ALTER TABLE `vessels` ADD `draftMeters` decimal(6,2);--> statement-breakpoint
ALTER TABLE `vessels` ADD `enginePower` int;--> statement-breakpoint
ALTER TABLE `vessels` ADD `fuelType` varchar(40);--> statement-breakpoint
CREATE INDEX `alert_history_alert_idx` ON `alert_history` (`alertId`);--> statement-breakpoint
CREATE INDEX `inspection_history_inspection_idx` ON `inspection_history` (`inspectionId`);--> statement-breakpoint
CREATE INDEX `report_versions_report_idx` ON `report_versions` (`reportId`);