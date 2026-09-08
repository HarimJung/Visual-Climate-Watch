CREATE TABLE `syncRuns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`runId` varchar(80) NOT NULL,
	`provider` varchar(64) NOT NULL,
	`status` varchar(24) NOT NULL,
	`startedAt` timestamp NOT NULL,
	`completedAt` timestamp NOT NULL,
	`recordsRead` int NOT NULL DEFAULT 0,
	`recordsWritten` int NOT NULL DEFAULT 0,
	`checksum` varchar(160) NOT NULL,
	`qualityJson` text NOT NULL,
	`message` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `syncRuns_id` PRIMARY KEY(`id`),
	CONSTRAINT `syncRuns_runId_unique` UNIQUE(`runId`)
);
