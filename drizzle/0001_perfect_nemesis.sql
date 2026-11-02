CREATE TABLE `alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vesselId` int,
	`createdBy` int,
	`assignedTo` int,
	`title` varchar(180) NOT NULL,
	`description` text,
	`place` varchar(120) NOT NULL,
	`latitude` decimal(10,7),
	`longitude` decimal(10,7),
	`urgency` enum('information','elevee','urgent','detresse') NOT NULL DEFAULT 'information',
	`status` enum('nouvelle','prise_en_charge','resolue') NOT NULL DEFAULT 'nouvelle',
	`source` enum('agent','marin','ia','meteo','systeme') NOT NULL DEFAULT 'agent',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`resolvedAt` timestamp,
	CONSTRAINT `alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`action` varchar(120) NOT NULL,
	`entityType` varchar(80) NOT NULL,
	`entityId` varchar(80),
	`metadata` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inspection_images` (
	`id` int AUTO_INCREMENT NOT NULL,
	`inspectionId` int NOT NULL,
	`storageKey` varchar(512) NOT NULL,
	`imageUrl` varchar(1000) NOT NULL,
	`imageType` varchar(80) NOT NULL DEFAULT 'inspection',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inspection_images_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inspections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vesselId` int NOT NULL,
	`agentId` int,
	`place` varchar(120) NOT NULL,
	`inspectionDate` timestamp NOT NULL DEFAULT (now()),
	`passengersDetected` int NOT NULL DEFAULT 0,
	`lifejacketsVisible` int NOT NULL DEFAULT 0,
	`capacityRisk` enum('faible','moyen','eleve','critique','a_verifier') NOT NULL DEFAULT 'a_verifier',
	`hullStatus` enum('bon','a_verifier','endommage','non_visible') NOT NULL DEFAULT 'non_visible',
	`engineStatus` enum('bon','a_verifier','endommage','non_visible') NOT NULL DEFAULT 'non_visible',
	`riskScore` int NOT NULL DEFAULT 0,
	`confidence` int NOT NULL DEFAULT 0,
	`recommendation` text,
	`findings` text,
	`uncertainty` text,
	`status` enum('brouillon','en_cours','terminee','rejetee') NOT NULL DEFAULT 'en_cours',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inspections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` varchar(40) NOT NULL,
	`title` varchar(180) NOT NULL,
	`message` text NOT NULL,
	`href` varchar(255),
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`inspectionId` int,
	`reference` varchar(64) NOT NULL,
	`content` text NOT NULL,
	`status` enum('brouillon','a_valider','valide') NOT NULL DEFAULT 'brouillon',
	`createdBy` int,
	`validatedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`validatedAt` timestamp,
	CONSTRAINT `reports_id` PRIMARY KEY(`id`),
	CONSTRAINT `reports_reference_unique` UNIQUE(`reference`)
);
--> statement-breakpoint
CREATE TABLE `vessels` (
	`id` int AUTO_INCREMENT NOT NULL,
	`registrationNumber` varchar(64) NOT NULL,
	`name` varchar(160),
	`type` varchar(80) NOT NULL,
	`ownerName` varchar(160) NOT NULL,
	`ownerPhone` varchar(40),
	`capacity` int NOT NULL DEFAULT 0,
	`place` varchar(120) NOT NULL,
	`latitude` decimal(10,7),
	`longitude` decimal(10,7),
	`status` enum('conforme','sous_surveillance','immobilisee','non_enregistree') NOT NULL DEFAULT 'conforme',
	`riskScore` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `vessels_id` PRIMARY KEY(`id`),
	CONSTRAINT `vessels_registrationNumber_unique` UNIQUE(`registrationNumber`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `appRole` enum('agent','supervisor','admin') DEFAULT 'agent' NOT NULL;--> statement-breakpoint
CREATE INDEX `alerts_status_idx` ON `alerts` (`status`);--> statement-breakpoint
CREATE INDEX `alerts_created_idx` ON `alerts` (`createdAt`);--> statement-breakpoint
CREATE INDEX `inspections_vessel_idx` ON `inspections` (`vesselId`);--> statement-breakpoint
CREATE INDEX `inspections_date_idx` ON `inspections` (`inspectionDate`);--> statement-breakpoint
CREATE INDEX `notifications_user_idx` ON `notifications` (`userId`,`readAt`);--> statement-breakpoint
CREATE INDEX `vessels_place_idx` ON `vessels` (`place`);--> statement-breakpoint
CREATE INDEX `vessels_status_idx` ON `vessels` (`status`);