
ALTER TABLE `projects` ADD COLUMN `activeGitBranchId` int NULL;
ALTER TABLE `gitRepositories` ADD COLUMN `lastFetchedAt` timestamp NULL;
ALTER TABLE `gitRepositories` ADD COLUMN `lastRemoteDefaultSha` varchar(64) NULL;
ALTER TABLE `gitBranches` ADD COLUMN `upstreamBranch` varchar(160) NULL;
ALTER TABLE `gitBranches` ADD COLUMN `remoteSha` varchar(64) NULL;
ALTER TABLE `gitBranches` ADD COLUMN `lastFetchedSha` varchar(64) NULL;
ALTER TABLE `gitBranches` ADD COLUMN `syncState` varchar(24) NOT NULL DEFAULT 'unknown';
ALTER TABLE `gitCommits` ADD COLUMN `remoteSha` varchar(64) NULL;
ALTER TABLE `gitCommits` ADD COLUMN `pushState` varchar(24) NOT NULL DEFAULT 'local';
CREATE UNIQUE INDEX `gitRepositories_project_uq` ON `gitRepositories` (`projectId`);
CREATE INDEX `gitCommits_project_branch_created_idx` ON `gitCommits` (`projectId`,`branchId`,`createdAt`);
CREATE INDEX `gitPullRequests_project_status_idx` ON `gitPullRequests` (`projectId`,`status`);


