CREATE TABLE `auditLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`runId` varchar(64) NOT NULL,
	`subagentId` varchar(16) NOT NULL,
	`action` varchar(120) NOT NULL,
	`status` varchar(24) NOT NULL,
	`qualityGatesJson` text NOT NULL,
	`inputHash` varchar(64) NOT NULL,
	`outputHash` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `learningProgress` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`pathId` varchar(80) NOT NULL,
	`completedStepsJson` text NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `learningProgress_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `savedComparisons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`countriesJson` text NOT NULL,
	`metric` varchar(32) NOT NULL DEFAULT 'absolute',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `savedComparisons_id` PRIMARY KEY(`id`)
);
