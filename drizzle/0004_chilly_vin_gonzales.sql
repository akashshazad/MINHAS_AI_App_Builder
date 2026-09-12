
CREATE TABLE `buildArtifacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`buildJobId` int NOT NULL,
	`projectId` int NOT NULL,
	`artifactType` varchar(16) NOT NULL,
	`status` varchar(24) NOT NULL DEFAULT 'ready',
	`storageKey` varchar(500),
	`fileName` varchar(255) NOT NULL,
	`sha256` varchar(64),
	`byteSize` int,
	`versionName` varchar(64),
	`versionCode` int,
	`packageName` varchar(240),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp,
	CONSTRAINT `buildArtifacts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `buildLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`buildJobId` int NOT NULL,
	`phase` varchar(48) NOT NULL,
	`level` varchar(16) NOT NULL DEFAULT 'info',
	`message` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `buildLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `deploymentLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`deploymentId` int NOT NULL,
	`state` varchar(32) NOT NULL,
	`message` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `deploymentLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `previewRuntimes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`buildJobId` int NOT NULL,
	`externalRuntimeId` varchar(160),
	`status` varchar(32) NOT NULL DEFAULT 'starting',
	`previewUrl` varchar(500),
	`healthStatus` varchar(24) NOT NULL DEFAULT 'unknown',
	`consoleLogs` text,
	`networkLogs` text,
	`error` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `previewRuntimes_id` PRIMARY KEY(`id`)
);


