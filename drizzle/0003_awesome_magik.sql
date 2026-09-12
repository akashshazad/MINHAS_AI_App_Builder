
CREATE TABLE `aiAgents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`key` varchar(64) NOT NULL,
	`name` varchar(120) NOT NULL,
	`role` text NOT NULL,
	`allowedToolsJson` text NOT NULL,
	`allowedFilesJson` text NOT NULL,
	`timeoutSeconds` int NOT NULL DEFAULT 120,
	`tokenBudget` int NOT NULL DEFAULT 8000,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `aiAgents_id` PRIMARY KEY(`id`),
	CONSTRAINT `aiAgents_key_unique` UNIQUE(`key`)
);
--> statement-breakpoint
CREATE TABLE `aiRuns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`agentKey` varchar(64) NOT NULL,
	`model` varchar(120),
	`status` varchar(32) NOT NULL DEFAULT 'queued',
	`prompt` text NOT NULL,
	`toolsJson` text NOT NULL,
	`filesChangedJson` text,
	`tokensUsed` int,
	`estimatedCostMicros` int,
	`durationMs` int,
	`resultJson` text,
	`error` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `aiRuns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pipelineRuns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'queued',
	`maxRetries` int NOT NULL DEFAULT 5,
	`currentStep` varchar(48),
	`error` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pipelineRuns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pipelineSteps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pipelineRunId` int NOT NULL,
	`stepKey` varchar(48) NOT NULL,
	`ordinal` int NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'queued',
	`attempts` int NOT NULL DEFAULT 0,
	`inputJson` text,
	`outputJson` text,
	`error` text,
	`startedAt` timestamp,
	`finishedAt` timestamp,
	CONSTRAINT `pipelineSteps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projectGraphEdges` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`fromNodeKey` varchar(240) NOT NULL,
	`toNodeKey` varchar(240) NOT NULL,
	`relation` varchar(64) NOT NULL,
	CONSTRAINT `projectGraphEdges_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projectGraphNodes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`nodeKey` varchar(240) NOT NULL,
	`nodeType` varchar(48) NOT NULL,
	`label` varchar(240) NOT NULL,
	`metadataJson` text,
	CONSTRAINT `projectGraphNodes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `securityScans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`pipelineRunId` int,
	`status` varchar(32) NOT NULL DEFAULT 'queued',
	`critical` int NOT NULL DEFAULT 0,
	`high` int NOT NULL DEFAULT 0,
	`findingsJson` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `securityScans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `testRuns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`pipelineRunId` int,
	`provider` varchar(64) NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'queued',
	`passed` int NOT NULL DEFAULT 0,
	`failed` int NOT NULL DEFAULT 0,
	`logs` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `testRuns_id` PRIMARY KEY(`id`)
);


