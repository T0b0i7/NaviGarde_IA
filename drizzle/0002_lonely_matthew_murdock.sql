CREATE TABLE `maritime_zones` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`description` text,
	`zoneType` enum('exclusion','forte_houle','peche_interdite','frontiere') NOT NULL,
	`polygon` text NOT NULL,
	`active` int NOT NULL DEFAULT 1,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `maritime_zones_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `vessel_positions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`vesselId` int NOT NULL,
	`latitude` decimal(10,7) NOT NULL,
	`longitude` decimal(10,7) NOT NULL,
	`speed` int NOT NULL DEFAULT 0,
	`heading` int NOT NULL DEFAULT 0,
	`source` varchar(40) NOT NULL DEFAULT 'mobile',
	`capturedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `vessel_positions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `weather_bulletins` (
	`id` int AUTO_INCREMENT NOT NULL,
	`place` varchar(120) NOT NULL,
	`windSpeed` int NOT NULL DEFAULT 0,
	`waveHeight` decimal(4,1) NOT NULL DEFAULT '0',
	`severity` enum('normal','vigilance','danger') NOT NULL DEFAULT 'normal',
	`message` text NOT NULL,
	`validFrom` timestamp NOT NULL DEFAULT (now()),
	`validUntil` timestamp NOT NULL,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `weather_bulletins_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `vessel_positions_vessel_idx` ON `vessel_positions` (`vesselId`);--> statement-breakpoint
CREATE INDEX `vessel_positions_captured_idx` ON `vessel_positions` (`capturedAt`);