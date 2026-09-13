
import { boolean, int, mediumtext, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn"),
});

export const projects = mysqlTable("projects", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  idea: mediumtext("idea").notNull(),
  sourceLanguage: varchar("sourceLanguage", { length: 32 }).notNull(),
  projectType: varchar("projectType", { length: 32 }).notNull(),
  framework: varchar("framework", { length: 64 }).notNull(),
  status: varchar("status", { length: 32 }).default("draft").notNull(),
  buildStatus: varchar("buildStatus", { length: 32 }).default("not_checked").notNull(),
  planJson: text("planJson").notNull(),
  previewUrl: varchar("previewUrl", { length: 500 }),
  deployStatus: varchar("deployStatus", { length: 32 }).default("planned").notNull(),
  activeGitBranchId: int("activeGitBranchId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const projectFiles = mysqlTable("projectFiles", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  path: varchar("path", { length: 320 }).notNull(),
  language: varchar("language", { length: 32 }).notNull(),
  content: text("content").notNull(),
  isCritical: boolean("isCritical").default(false).notNull(),
  version: int("version").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const projectEvents = mysqlTable("projectEvents", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  type: varchar("type", { length: 48 }).notNull(),
  message: text("message").notNull(),
  metadataJson: text("metadataJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const projectSnapshots = mysqlTable("projectSnapshots", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  label: varchar("label", { length: 160 }).notNull(),
  reason: varchar("reason", { length: 48 }).notNull(),
  planJson: text("planJson").notNull(),
  filesJson: text("filesJson").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const buildJobs = mysqlTable("buildJobs", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  provider: varchar("provider", { length: 64 }).notNull(),
  externalJobId: varchar("externalJobId", { length: 160 }),
  status: varchar("status", { length: 32 }).default("queued").notNull(),
  logs: text("logs"),
  error: text("error"),
  previewUrl: varchar("previewUrl", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const buildLogs = mysqlTable("buildLogs", {
  id: int("id").autoincrement().primaryKey(),
  buildJobId: int("buildJobId").notNull(),
  phase: varchar("phase", { length: 48 }).notNull(),
  level: varchar("level", { length: 16 }).default("info").notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const buildArtifacts = mysqlTable("buildArtifacts", {
  id: int("id").autoincrement().primaryKey(),
  buildJobId: int("buildJobId").notNull(),
  projectId: int("projectId").notNull(),
  artifactType: varchar("artifactType", { length: 16 }).notNull(),
  status: varchar("status", { length: 24 }).default("ready").notNull(),
  storageKey: varchar("storageKey", { length: 500 }),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  sha256: varchar("sha256", { length: 64 }),
  byteSize: int("byteSize"),
  versionName: varchar("versionName", { length: 64 }),
  versionCode: int("versionCode"),
  packageName: varchar("packageName", { length: 240 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"),
});

export const previewRuntimes = mysqlTable("previewRuntimes", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  buildJobId: int("buildJobId").notNull(),
  externalRuntimeId: varchar("externalRuntimeId", { length: 160 }),
  status: varchar("status", { length: 32 }).default("starting").notNull(),
  previewUrl: varchar("previewUrl", { length: 500 }),
  healthStatus: varchar("healthStatus", { length: 24 }).default("unknown").notNull(),
  consoleLogs: text("consoleLogs"),
  networkLogs: text("networkLogs"),
  error: text("error"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const deployments = mysqlTable("deployments", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  provider: varchar("provider", { length: 64 }).notNull(),
  externalDeploymentId: varchar("externalDeploymentId", { length: 160 }),
  status: varchar("status", { length: 32 }).default("queued").notNull(),
  targetUrl: varchar("targetUrl", { length: 500 }),
  error: text("error"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const deploymentLogs = mysqlTable("deploymentLogs", {
  id: int("id").autoincrement().primaryKey(),
  deploymentId: int("deploymentId").notNull(),
  state: varchar("state", { length: 32 }).notNull(),
  message: text("message").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const projectExports = mysqlTable("projectExports", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  storageKey: varchar("storageKey", { length: 500 }).notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const codeReviews = mysqlTable("codeReviews", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  mode: varchar("mode", { length: 32 }).notNull(),
  status: varchar("status", { length: 32 }).notNull(),
  summary: text("summary").notNull(),
  resultJson: text("resultJson").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const aiAgents = mysqlTable("aiAgents", {
  id: int("id").autoincrement().primaryKey(),
  key: varchar("key", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  role: text("role").notNull(),
  allowedToolsJson: text("allowedToolsJson").notNull(),
  allowedFilesJson: text("allowedFilesJson").notNull(),
  timeoutSeconds: int("timeoutSeconds").default(120).notNull(),
  tokenBudget: int("tokenBudget").default(8000).notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const aiRuns = mysqlTable("aiRuns", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  agentKey: varchar("agentKey", { length: 64 }).notNull(),
  model: varchar("model", { length: 120 }),
  status: varchar("status", { length: 32 }).default("queued").notNull(),
  prompt: mediumtext("prompt").notNull(),
  toolsJson: text("toolsJson").notNull(),
  filesChangedJson: text("filesChangedJson"),
  tokensUsed: int("tokensUsed"),
  estimatedCostMicros: int("estimatedCostMicros"),
  durationMs: int("durationMs"),
  resultJson: text("resultJson"),
  error: text("error"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const pipelineRuns = mysqlTable("pipelineRuns", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  status: varchar("status", { length: 32 }).default("queued").notNull(),
  maxRetries: int("maxRetries").default(5).notNull(),
  currentStep: varchar("currentStep", { length: 48 }),
  error: text("error"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const pipelineSteps = mysqlTable("pipelineSteps", {
  id: int("id").autoincrement().primaryKey(),
  pipelineRunId: int("pipelineRunId").notNull(),
  stepKey: varchar("stepKey", { length: 48 }).notNull(),
  ordinal: int("ordinal").notNull(),
  status: varchar("status", { length: 32 }).default("queued").notNull(),
  attempts: int("attempts").default(0).notNull(),
  inputJson: text("inputJson"),
  outputJson: text("outputJson"),
  error: text("error"),
  startedAt: timestamp("startedAt"),
  finishedAt: timestamp("finishedAt"),
});

export const projectGraphNodes = mysqlTable("projectGraphNodes", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  nodeKey: varchar("nodeKey", { length: 240 }).notNull(),
  nodeType: varchar("nodeType", { length: 48 }).notNull(),
  label: varchar("label", { length: 240 }).notNull(),
  metadataJson: text("metadataJson"),
});

export const projectGraphEdges = mysqlTable("projectGraphEdges", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  fromNodeKey: varchar("fromNodeKey", { length: 240 }).notNull(),
  toNodeKey: varchar("toNodeKey", { length: 240 }).notNull(),
  relation: varchar("relation", { length: 64 }).notNull(),
});

export const testRuns = mysqlTable("testRuns", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  pipelineRunId: int("pipelineRunId"),
  provider: varchar("provider", { length: 64 }).notNull(),
  externalRunId: varchar("externalRunId", { length: 160 }),
  status: varchar("status", { length: 32 }).default("queued").notNull(),
  passed: int("passed").default(0).notNull(),
  failed: int("failed").default(0).notNull(),
  logs: text("logs"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const gitRepositories = mysqlTable("gitRepositories", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  provider: varchar("provider", { length: 32 }).default("github").notNull(),
  repositoryUrl: varchar("repositoryUrl", { length: 500 }).notNull(),
  owner: varchar("owner", { length: 160 }).notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  defaultBranch: varchar("defaultBranch", { length: 160 }).default("main").notNull(),
  connected: boolean("connected").default(false).notNull(),
  lastFetchedAt: timestamp("lastFetchedAt"),
  lastRemoteDefaultSha: varchar("lastRemoteDefaultSha", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const gitBranches = mysqlTable("gitBranches", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  baseSnapshotId: int("baseSnapshotId").notNull(),
  headSnapshotId: int("headSnapshotId").notNull(),
  protected: boolean("protected").default(false).notNull(),
  isDefault: boolean("isDefault").default(false).notNull(),
  upstreamBranch: varchar("upstreamBranch", { length: 160 }),
  remoteSha: varchar("remoteSha", { length: 64 }),
  lastFetchedSha: varchar("lastFetchedSha", { length: 64 }),
  syncState: varchar("syncState", { length: 24 }).default("unknown").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const gitCommits = mysqlTable("gitCommits", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  branchId: int("branchId").notNull(),
  parentCommitId: int("parentCommitId"),
  snapshotId: int("snapshotId").notNull(),
  message: varchar("message", { length: 240 }).notNull(),
  treeHash: varchar("treeHash", { length: 64 }).notNull(),
  authorUserId: int("authorUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  remoteSha: varchar("remoteSha", { length: 64 }),
  pushState: varchar("pushState", { length: 24 }).default("local").notNull(),
});

export const gitPullRequests = mysqlTable("gitPullRequests", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  sourceBranchId: int("sourceBranchId").notNull(),
  targetBranchId: int("targetBranchId").notNull(),
  title: varchar("title", { length: 240 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 32 }).default("open").notNull(),
  conflictsJson: text("conflictsJson"),
  providerNumber: int("providerNumber"),
  providerUrl: varchar("providerUrl", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const securityScans = mysqlTable("securityScans", {
  id: int("id").autoincrement().primaryKey(),
  projectId: int("projectId").notNull(),
  pipelineRunId: int("pipelineRunId"),
  status: varchar("status", { length: 32 }).default("queued").notNull(),
  critical: int("critical").default(0).notNull(),
  high: int("high").default(0).notNull(),
  findingsJson: text("findingsJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type ProjectFile = typeof projectFiles.$inferSelect;
export type ProjectEvent = typeof projectEvents.$inferSelect;
export type ProjectSnapshot = typeof projectSnapshots.$inferSelect;
export type BuildJob = typeof buildJobs.$inferSelect;
export type BuildLog = typeof buildLogs.$inferSelect;
export type BuildArtifact = typeof buildArtifacts.$inferSelect;
export type PreviewRuntime = typeof previewRuntimes.$inferSelect;
export type Deployment = typeof deployments.$inferSelect;
export type DeploymentLog = typeof deploymentLogs.$inferSelect;
export type ProjectExport = typeof projectExports.$inferSelect;
export type CodeReview = typeof codeReviews.$inferSelect;
export type AiAgent = typeof aiAgents.$inferSelect;
export type AiRun = typeof aiRuns.$inferSelect;
export type PipelineRun = typeof pipelineRuns.$inferSelect;
export type PipelineStep = typeof pipelineSteps.$inferSelect;
export type ProjectGraphNode = typeof projectGraphNodes.$inferSelect;
export type ProjectGraphEdge = typeof projectGraphEdges.$inferSelect;
export type TestRun = typeof testRuns.$inferSelect;
export type SecurityScan = typeof securityScans.$inferSelect;
export type GitRepository = typeof gitRepositories.$inferSelect;
export type GitBranch = typeof gitBranches.$inferSelect;
export type GitCommit = typeof gitCommits.$inferSelect;
export type GitPullRequest = typeof gitPullRequests.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;
export type InsertProjectFile = typeof projectFiles.$inferInsert;
export type InsertProjectEvent = typeof projectEvents.$inferInsert;
export type InsertProjectSnapshot = typeof projectSnapshots.$inferInsert;
export type InsertBuildJob = typeof buildJobs.$inferInsert;
export type InsertBuildLog = typeof buildLogs.$inferInsert;
export type InsertBuildArtifact = typeof buildArtifacts.$inferInsert;
export type InsertPreviewRuntime = typeof previewRuntimes.$inferInsert;
export type InsertDeployment = typeof deployments.$inferInsert;
export type InsertDeploymentLog = typeof deploymentLogs.$inferInsert;
export type InsertProjectExport = typeof projectExports.$inferInsert;
export type InsertCodeReview = typeof codeReviews.$inferInsert;
export type InsertAiRun = typeof aiRuns.$inferInsert;
export type InsertPipelineRun = typeof pipelineRuns.$inferInsert;
export type InsertPipelineStep = typeof pipelineSteps.$inferInsert;
export type InsertProjectGraphNode = typeof projectGraphNodes.$inferInsert;
export type InsertProjectGraphEdge = typeof projectGraphEdges.$inferInsert;
export type InsertTestRun = typeof testRuns.$inferInsert;
export type InsertSecurityScan = typeof securityScans.$inferInsert;
export type InsertGitRepository = typeof gitRepositories.$inferInsert;
export type InsertGitBranch = typeof gitBranches.$inferInsert;
export type InsertGitCommit = typeof gitCommits.$inferInsert;
export type InsertGitPullRequest = typeof gitPullRequests.$inferInsert;

