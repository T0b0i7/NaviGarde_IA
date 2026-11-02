CREATE TABLE `inspection_findings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`inspectionId` int NOT NULL,
	`imageIndex` int,
	`anomalyType` varchar(120) NOT NULL,
	`description` text NOT NULL,
	`riskLevel` enum('faible','moyen','eleve','critique','a_verifier') NOT NULL DEFAULT 'a_verifier',
	`confidence` int NOT NULL DEFAULT 0,
	`recommendation` text,
	`analyzedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inspection_findings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `inspections` ADD `comments` text;--> statement-breakpoint
ALTER TABLE `inspections` ADD `analyzedAt` timestamp;--> statement-breakpoint
ALTER TABLE `inspections` ADD `analysisProvider` varchar(120);--> statement-breakpoint
CREATE INDEX `inspection_findings_inspection_idx` ON `inspection_findings` (`inspectionId`);