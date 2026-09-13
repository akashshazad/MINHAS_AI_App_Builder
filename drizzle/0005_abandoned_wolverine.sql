CREATE TABLE `gitBranches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`name` varchar(160) NOT NULL,
	`baseSnapshotId` int NOT NULL,
	`headSnapshotId` int NOT NULL,
	`protected` boolean NOT NULL DEFAULT false,
	`isDefault` boolean NOT NULL DEFAULT false,
	`upstreamBranch` varchar(160),
	`remoteSha` varchar(64),
	`lastFetchedSha` varchar(64),
	`syncState` varchar(24) NOT NULL DEFAULT 'unknown',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `gitBranches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `gitCommits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`branchId` int NOT NULL,
	`parentCommitId` int,
	`snapshotId` int NOT NULL,
	`message` varchar(240) NOT NULL,
	`treeHash` varchar(64) NOT NULL,
	`authorUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`remoteSha` varchar(64),
	`pushState` varchar(24) NOT NULL DEFAULT 'local',
	CONSTRAINT `gitCommits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `gitPullRequests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`sourceBranchId` int NOT NULL,
	`targetBranchId` int NOT NULL,
	`title` varchar(240) NOT NULL,
	`description` text,
	`status` varchar(32) NOT NULL DEFAULT 'open',
	`conflictsJson` text,
	`providerNumber` int,
	`providerUrl` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `gitPullRequests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `gitRepositories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`provider` varchar(32) NOT NULL DEFAULT 'github',
	`repositoryUrl` varchar(500) NOT NULL,
	`owner` varchar(160) NOT NULL,
	`name` varchar(160) NOT NULL,
	`defaultBranch` varchar(160) NOT NULL DEFAULT 'main',
	`connected` boolean NOT NULL DEFAULT false,
	`lastFetchedAt` timestamp,
	`lastRemoteDefaultSha` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `gitRepositories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `aiRuns` MODIFY COLUMN `prompt` mediumtext NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` MODIFY COLUMN `idea` mediumtext NOT NULL;--> statement-breakpoint
ALTER TABLE `projects` ADD `activeGitBranchId` int;--> statement-breakpoint
ALTER TABLE `testRuns` ADD `externalRunId` varchar(160);