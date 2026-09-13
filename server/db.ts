
import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import {
  buildJobs,
  buildLogs,
  buildArtifacts,
  codeReviews,
  deployments,
  deploymentLogs,
  previewRuntimes,
  aiRuns,
  pipelineRuns,
  pipelineSteps,
  projectGraphEdges,
  projectGraphNodes,
  securityScans,
  testRuns,
  projectEvents,
  projectExports,
  projectFiles,
  projectSnapshots,
  projects,
  users,
  gitRepositories, gitBranches, gitCommits, gitPullRequests,
  type InsertGitRepository, type InsertGitBranch, type InsertGitCommit, type InsertGitPullRequest,
  type InsertBuildJob,
  type InsertBuildLog,
  type InsertBuildArtifact,
  type InsertAiRun,
  type InsertCodeReview,
  type InsertDeployment,
  type InsertDeploymentLog,
  type InsertPreviewRuntime,
  type InsertProject,
  type InsertProjectEvent,
  type InsertProjectExport,
  type InsertProjectFile,
  type InsertProjectSnapshot,
  type InsertPipelineRun,
  type InsertPipelineStep,
  type InsertProjectGraphEdge,
  type InsertProjectGraphNode,
  type InsertSecurityScan,
  type InsertTestRun,
  type User,
} from "../drizzle/schema";

let pool: mysql.Pool | null = null;
function getFallbackDb() {
  if (!process.env.DATABASE_URL) return null;
  pool ??= mysql.createPool(process.env.DATABASE_URL);
  return drizzle(pool);
}
export async function getDb() { return getFallbackDb(); }

function insertId(result: unknown) {
  const header = (result as any)?.[0] ?? result;
  return Number(header?.insertId ?? 0);
}

export async function getUserByOpenId(openId: string): Promise<User | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return rows[0] ?? null;
}

export async function upsertUser(data: Partial<Omit<User, "id" | "createdAt" | "updatedAt">> & { openId: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const { openId, ...rest } = data;
  await db.insert(users).values({ openId, ...rest }).onDuplicateKeyUpdate({ set: { ...rest, updatedAt: new Date() } });
}

export async function listUserProjects(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projects).where(eq(projects.userId, userId)).orderBy(desc(projects.updatedAt));
}
export async function getUserProject(userId: number, projectId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(projects).where(and(eq(projects.id, projectId), eq(projects.userId, userId))).limit(1);
  return rows[0] ?? null;
}
export async function listProjectFiles(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projectFiles).where(eq(projectFiles.projectId, projectId)).orderBy(projectFiles.path);
}
export async function getProjectFile(projectId: number, path: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(projectFiles).where(and(eq(projectFiles.projectId, projectId), eq(projectFiles.path, path))).limit(1);
  return rows[0] ?? null;
}
export async function listProjectEvents(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projectEvents).where(eq(projectEvents.projectId, projectId)).orderBy(desc(projectEvents.createdAt)).limit(50);
}
export async function createProject(data: InsertProject) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  return insertId(await db.insert(projects).values(data));
}
export async function createProjectWithEvent(data: InsertProject, event: { type: string; message: string; metadataJson?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  return db.transaction(async (tx) => {
    let idempotencyKey = "";
    try { idempotencyKey = String((event.metadataJson ? JSON.parse(event.metadataJson) : {}).idempotencyKey ?? ""); } catch { idempotencyKey = ""; }
    if (idempotencyKey && event.metadataJson) {
      const metadataJson = event.metadataJson;
      const existing = await tx.select({ projectId: projectEvents.projectId }).from(projectEvents).innerJoin(projects, eq(projectEvents.projectId, projects.id)).where(and(eq(projectEvents.type, event.type), eq(projectEvents.metadataJson, metadataJson), eq(projects.userId, data.userId))).limit(1);
      if (existing[0]?.projectId) return existing[0].projectId;
    }
    const projectId = insertId(await tx.insert(projects).values(data));
    if (!projectId) throw new Error("Project insert returned no generated ID");
    await tx.insert(projectEvents).values({ projectId, ...event });
    return projectId;
  });
}
export async function insertProjectFiles(rows: InsertProjectFile[]) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  if (rows.length) await db.insert(projectFiles).values(rows);
}
export async function appendProjectEvent(data: InsertProjectEvent) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  await db.insert(projectEvents).values(data);
}
export async function updateProjectFile(projectId: number, path: string, content: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  const existing = await getProjectFile(projectId, path);
  if (!existing) throw new Error("File not found");
  await db.update(projectFiles).set({ content, version: existing.version + 1 }).where(eq(projectFiles.id, existing.id));
}
export async function replaceProjectFiles(projectId: number, files: Array<{ path: string; language: string; content: string; isCritical: boolean }>) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  await db.transaction(async (tx) => {
    await tx.delete(projectFiles).where(eq(projectFiles.projectId, projectId));
    if (files.length) await tx.insert(projectFiles).values(files.map((file) => ({ ...file, projectId, version: 1 })));
  });
}
export async function updateProjectStatus(projectId: number, data: Partial<Pick<typeof projects.$inferInsert, "buildStatus" | "status" | "previewUrl" | "deployStatus" | "activeGitBranchId">>) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  await db.update(projects).set(data).where(eq(projects.id, projectId));
}

export async function createSnapshot(data: InsertProjectSnapshot) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  return insertId(await db.insert(projectSnapshots).values(data));
}
export async function listProjectSnapshots(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projectSnapshots).where(eq(projectSnapshots.projectId, projectId)).orderBy(desc(projectSnapshots.createdAt));
}
export async function getProjectSnapshot(projectId: number, snapshotId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(projectSnapshots).where(and(eq(projectSnapshots.projectId, projectId), eq(projectSnapshots.id, snapshotId))).limit(1);
  return rows[0] ?? null;
}

export async function createBuildJob(data: InsertBuildJob) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  return insertId(await db.insert(buildJobs).values(data));
}
export async function getBuildJob(projectId: number, jobId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(buildJobs).where(and(eq(buildJobs.projectId, projectId), eq(buildJobs.id, jobId))).limit(1);
  return rows[0] ?? null;
}
export async function listBuildJobs(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(buildJobs).where(eq(buildJobs.projectId, projectId)).orderBy(desc(buildJobs.createdAt));
}
export async function updateBuildJob(jobId: number, data: Partial<Pick<typeof buildJobs.$inferInsert, "externalJobId" | "status" | "logs" | "error" | "previewUrl">>) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  await db.update(buildJobs).set(data).where(eq(buildJobs.id, jobId));
}

export async function createDeployment(data: InsertDeployment) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  return insertId(await db.insert(deployments).values(data));
}
export async function listDeployments(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(deployments).where(eq(deployments.projectId, projectId)).orderBy(desc(deployments.createdAt));
}
export async function updateDeployment(deploymentId: number, data: Partial<Pick<typeof deployments.$inferInsert, "externalDeploymentId" | "status" | "targetUrl" | "error">>) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  await db.update(deployments).set(data).where(eq(deployments.id, deploymentId));
}

export async function createProjectExport(data: InsertProjectExport) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  return insertId(await db.insert(projectExports).values(data));
}
export async function listProjectExports(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(projectExports).where(eq(projectExports.projectId, projectId)).orderBy(desc(projectExports.createdAt));
}

export async function createCodeReview(data: InsertCodeReview) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  return insertId(await db.insert(codeReviews).values(data));
}
export async function getCodeReview(projectId: number, reviewId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(codeReviews).where(and(eq(codeReviews.projectId, projectId), eq(codeReviews.id, reviewId))).limit(1);
  return rows[0] ?? null;
}
export async function listCodeReviews(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(codeReviews).where(eq(codeReviews.projectId, projectId)).orderBy(desc(codeReviews.createdAt));
}

export async function createAiRun(data: InsertAiRun) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  return insertId(await db.insert(aiRuns).values(data));
}
export async function updateAiRun(runId: number, data: Partial<Pick<typeof aiRuns.$inferInsert, "status" | "model" | "filesChangedJson" | "tokensUsed" | "estimatedCostMicros" | "durationMs" | "resultJson" | "error">>) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  await db.update(aiRuns).set(data).where(eq(aiRuns.id, runId));
}
export async function listAiRuns(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(aiRuns).where(eq(aiRuns.projectId, projectId)).orderBy(desc(aiRuns.createdAt));
}

export async function createPipelineRun(data: InsertPipelineRun) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  return insertId(await db.insert(pipelineRuns).values(data));
}
export async function createPipelineSteps(rows: InsertPipelineStep[]) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  if (rows.length) await db.insert(pipelineSteps).values(rows);
}
export async function getPipelineRun(projectId: number, runId: number) {
  const db = await getDb();
  if (!db) return null;
  const runs = await db.select().from(pipelineRuns).where(and(eq(pipelineRuns.projectId, projectId), eq(pipelineRuns.id, runId))).limit(1);
  if (!runs[0]) return null;
  const steps = await db.select().from(pipelineSteps).where(eq(pipelineSteps.pipelineRunId, runId)).orderBy(pipelineSteps.ordinal);
  return { ...runs[0], steps };
}
export async function listPipelineRuns(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(pipelineRuns).where(eq(pipelineRuns.projectId, projectId)).orderBy(desc(pipelineRuns.createdAt));
}
export async function updatePipelineRun(runId: number, data: Partial<Pick<typeof pipelineRuns.$inferInsert, "status" | "currentStep" | "error">>) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  await db.update(pipelineRuns).set(data).where(eq(pipelineRuns.id, runId));
}
export async function updatePipelineStep(stepId: number, data: Partial<Pick<typeof pipelineSteps.$inferInsert, "status" | "attempts" | "outputJson" | "error" | "startedAt" | "finishedAt">>) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  await db.update(pipelineSteps).set(data).where(eq(pipelineSteps.id, stepId));
}

export async function replaceProjectGraph(projectId: number, nodes: InsertProjectGraphNode[], edges: InsertProjectGraphEdge[]) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  await db.transaction(async (tx) => {
    await tx.delete(projectGraphEdges).where(eq(projectGraphEdges.projectId, projectId));
    await tx.delete(projectGraphNodes).where(eq(projectGraphNodes.projectId, projectId));
    if (nodes.length) await tx.insert(projectGraphNodes).values(nodes);
    if (edges.length) await tx.insert(projectGraphEdges).values(edges);
  });
}
export async function getProjectGraph(projectId: number) {
  const db = await getDb();
  if (!db) return { nodes: [], edges: [] };
  const [nodes, edges] = await Promise.all([
    db.select().from(projectGraphNodes).where(eq(projectGraphNodes.projectId, projectId)),
    db.select().from(projectGraphEdges).where(eq(projectGraphEdges.projectId, projectId)),
  ]);
  return { nodes, edges };
}

export async function createTestRun(data: InsertTestRun) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  return insertId(await db.insert(testRuns).values(data));
}
export async function updateTestRun(testRunId: number, data: Partial<Pick<typeof testRuns.$inferInsert, "status" | "passed" | "failed" | "logs" | "externalRunId">>) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  await db.update(testRuns).set(data).where(eq(testRuns.id, testRunId));
}
export async function createSecurityScan(data: InsertSecurityScan) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  return insertId(await db.insert(securityScans).values(data));
}
export async function listTestRuns(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(testRuns).where(eq(testRuns.projectId, projectId)).orderBy(desc(testRuns.createdAt));
}
export async function listSecurityScans(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(securityScans).where(eq(securityScans.projectId, projectId)).orderBy(desc(securityScans.createdAt));
}

export async function appendBuildLog(data: InsertBuildLog) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  return insertId(await db.insert(buildLogs).values(data));
}
export async function listBuildLogs(buildJobId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(buildLogs).where(eq(buildLogs.buildJobId, buildJobId)).orderBy(buildLogs.createdAt);
}
export async function createBuildArtifact(data: InsertBuildArtifact) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  return insertId(await db.insert(buildArtifacts).values(data));
}
export async function listBuildArtifacts(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(buildArtifacts).where(eq(buildArtifacts.projectId, projectId)).orderBy(desc(buildArtifacts.createdAt));
}
export async function createPreviewRuntime(data: InsertPreviewRuntime) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  return insertId(await db.insert(previewRuntimes).values(data));
}
export async function listPreviewRuntimes(projectId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(previewRuntimes).where(eq(previewRuntimes.projectId, projectId)).orderBy(desc(previewRuntimes.createdAt));
}

export async function getPreviewRuntime(projectId: number, runtimeId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(previewRuntimes).where(and(eq(previewRuntimes.projectId, projectId), eq(previewRuntimes.id, runtimeId))).limit(1);
  return rows[0] ?? null;
}
export async function updatePreviewRuntime(runtimeId: number, data: Partial<Pick<typeof previewRuntimes.$inferInsert, "status" | "previewUrl" | "healthStatus" | "consoleLogs" | "networkLogs" | "error" | "externalRuntimeId">>) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  await db.update(previewRuntimes).set(data).where(eq(previewRuntimes.id, runtimeId));
}
export async function appendDeploymentLog(data: InsertDeploymentLog) {
  const db = await getDb();
  if (!db) throw new Error("Database is not configured");
  return insertId(await db.insert(deploymentLogs).values(data));
}
export async function listDeploymentLogs(deploymentId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(deploymentLogs).where(eq(deploymentLogs.deploymentId, deploymentId)).orderBy(deploymentLogs.createdAt);
}

export async function createGitRepository(data: InsertGitRepository) { const db = await getDb(); if (!db) throw new Error("Database is not configured"); return insertId(await db.insert(gitRepositories).values(data)); }
export async function getGitRepository(projectId: number) { const db = await getDb(); if (!db) return null; const rows = await db.select().from(gitRepositories).where(eq(gitRepositories.projectId, projectId)).limit(1); return rows[0] ?? null; }
export async function updateGitRepository(id: number, data: Partial<InsertGitRepository>) { const db = await getDb(); if (!db) throw new Error("Database is not configured"); await db.update(gitRepositories).set(data).where(eq(gitRepositories.id, id)); }
export async function createGitBranch(data: InsertGitBranch) { const db = await getDb(); if (!db) throw new Error("Database is not configured"); return insertId(await db.insert(gitBranches).values(data)); }
export async function listGitBranches(projectId: number) { const db = await getDb(); if (!db) return []; return db.select().from(gitBranches).where(eq(gitBranches.projectId, projectId)).orderBy(gitBranches.name); }
export async function getGitBranch(projectId: number, branchId: number) { const db = await getDb(); if (!db) return null; const rows = await db.select().from(gitBranches).where(and(eq(gitBranches.projectId, projectId), eq(gitBranches.id, branchId))).limit(1); return rows[0] ?? null; }
export async function updateGitBranch(id: number, data: Partial<InsertGitBranch>) { const db = await getDb(); if (!db) throw new Error("Database is not configured"); await db.update(gitBranches).set(data).where(eq(gitBranches.id, id)); }
export async function createGitCommit(data: InsertGitCommit) { const db = await getDb(); if (!db) throw new Error("Database is not configured"); return insertId(await db.insert(gitCommits).values(data)); }
export async function listGitCommits(projectId: number, branchId?: number) { const db = await getDb(); if (!db) return []; return db.select().from(gitCommits).where(branchId ? and(eq(gitCommits.projectId, projectId), eq(gitCommits.branchId, branchId)) : eq(gitCommits.projectId, projectId)).orderBy(desc(gitCommits.createdAt)); }
export async function getGitCommit(projectId: number, commitId: number) { const db = await getDb(); if (!db) return null; const rows = await db.select().from(gitCommits).where(and(eq(gitCommits.projectId, projectId), eq(gitCommits.id, commitId))).limit(1); return rows[0] ?? null; }
export async function createGitPullRequest(data: InsertGitPullRequest) { const db = await getDb(); if (!db) throw new Error("Database is not configured"); return insertId(await db.insert(gitPullRequests).values(data)); }
export async function listGitPullRequests(projectId: number) { const db = await getDb(); if (!db) return []; return db.select().from(gitPullRequests).where(eq(gitPullRequests.projectId, projectId)).orderBy(desc(gitPullRequests.createdAt)); }
export async function getGitPullRequest(projectId: number, id: number) { const db = await getDb(); if (!db) return null; const rows = await db.select().from(gitPullRequests).where(and(eq(gitPullRequests.projectId, projectId), eq(gitPullRequests.id, id))).limit(1); return rows[0] ?? null; }
export async function updateGitPullRequest(id: number, data: Partial<InsertGitPullRequest>) { const db = await getDb(); if (!db) throw new Error("Database is not configured"); await db.update(gitPullRequests).set(data).where(eq(gitPullRequests.id, id)); }
