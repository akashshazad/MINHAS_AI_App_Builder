
CREATE TABLE `buildJobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`provider` varchar(64) NOT NULL,
	`externalJobId` varchar(160),
	`status` varchar(32) NOT NULL DEFAULT 'queued',
	`logs` text,
	`error` text,
	`previewUrl` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `buildJobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `codeReviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`mode` varchar(32) NOT NULL,
	`status` varchar(32) NOT NULL,
	`summary` text NOT NULL,
	`resultJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `codeReviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `deployments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`provider` varchar(64) NOT NULL,
	`externalDeploymentId` varchar(160),
	`status` varchar(32) NOT NULL DEFAULT 'queued',
	`targetUrl` varchar(500),
	`error` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `deployments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projectExports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`storageKey` varchar(500) NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `projectExports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projectSnapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`label` varchar(160) NOT NULL,
	`reason` varchar(48) NOT NULL,
	`planJson` text NOT NULL,
	`filesJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `projectSnapshots_id` PRIMARY KEY(`id`)
);


