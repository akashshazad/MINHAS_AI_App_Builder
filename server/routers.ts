
import { COOKIE_NAME } from "../shared/const.js";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import * as db from "./db";
import { detectSourceLanguage, generatePlan, generateStarterFiles } from "./ai";
import { reviewProjectFiles } from "./code-review";
import { executeCodingTask } from "./agent";
import { runSoftwareFactory } from "./software-factory";
import { MOBILE_TEMPLATES } from "./templates";
import { createProjectZip } from "./zip-export";
import { buildProviderStatus, deployProviderStatus, healthCheckUrl, pollDeployment, pollIsolatedBuild, pollPreview, previewProviderStatus, queueDeployment, queueIsolatedBuild, startPreview } from "./providers";
import type { BuildEngineSelection } from "./build-engine";
import { platformServiceStatus } from "./platform-config";
import { auditProject } from "./feature-audit";
import { summarizeVersion, contentHash } from "./version-control";
import { githubProvider, githubRepositoryFromUrl } from "./git/provider";
import { threeWayMerge } from "./git/merge";
import { advanceAutonomousRun, indexProjectGraph, startAutonomousRun } from "./orchestrator";
import { evaluateProductionGate } from "./production-gate";
import type { ProjectPlan, ProjectType } from "../shared/types";
import { storagePut, storageGetSignedUrl } from "./storage";
import { transcribeAudio } from "./_core/voiceTranscription";

const projectTypeSchema = z.literal("mobile_app");
const planFromProject = (value: string): ProjectPlan => { try { return JSON.parse(value) as ProjectPlan; } catch { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Project plan data is corrupted." }); } };

async function ownedProject(userId: number, projectId: number) {
  const project = await db.getUserProject(userId, projectId);
  if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
  return project;
}

async function snapshotProject(projectId: number, label: string, reason: string, planJson: string, files: Awaited<ReturnType<typeof db.listProjectFiles>>) {
  return db.createSnapshot({ projectId, label, reason, planJson, filesJson: JSON.stringify(files.map((file) => ({ path: file.path, language: file.language, content: file.content, isCritical: file.isCritical, version: file.version }))) });
}

export const appRouter = router({
  templates: router({ list: publicProcedure.query(() => MOBILE_TEMPLATES) }),
  media: router({
    upload: protectedProcedure.input(z.object({
      fileName: z.string().trim().min(1).max(240).regex(/^[A-Za-z0-9._ -]+$/),
      mimeType: z.string().trim().min(1).max(120),
      base64: z.string().min(1).max(16_000_000),
    })).mutation(async ({ ctx, input }) => {
      const allowed = new Set(["image/png", "image/jpeg", "image/webp", "application/pdf", "text/plain", "text/markdown", "application/json", "text/javascript", "application/javascript", "text/typescript", "text/css", "application/sql", "text/xml", "application/xml", "text/yaml", "application/zip", "audio/m4a", "audio/mp4", "audio/mpeg", "audio/wav", "audio/webm"]);
      if (!allowed.has(input.mimeType)) throw new TRPCError({ code: "BAD_REQUEST", message: "Unsupported attachment type." });
      const bytes = Buffer.from(input.base64, "base64");
      if (!bytes.length || bytes.length > 12 * 1024 * 1024) throw new TRPCError({ code: "BAD_REQUEST", message: "Attachment exceeds the 12 MB safe upload limit." });
      const uploaded = await storagePut(`users/${ctx.user.id}/attachments/${input.fileName}`, bytes, input.mimeType);
      const signedUrl = await storageGetSignedUrl(uploaded.key);
      return { key: uploaded.key, url: signedUrl, fileName: input.fileName, mimeType: input.mimeType, byteSize: bytes.length };
    }),
    transcribe: protectedProcedure.input(z.object({ audioBase64: z.string().min(1).max(16_000_000), mimeType: z.string().min(1).max(80), language: z.string().max(16).optional() })).mutation(async ({ input }) => {
      const bytes = Buffer.from(input.audioBase64, "base64");
      if (!bytes.length || bytes.length > 12 * 1024 * 1024) throw new TRPCError({ code: "BAD_REQUEST", message: "Recording exceeds the safe upload limit." });
      const uploaded = await storagePut(`voice/${Date.now()}.audio`, bytes, input.mimeType);
      const signedUrl = await storageGetSignedUrl(uploaded.key);
      const result = await transcribeAudio({ audioUrl: signedUrl, language: input.language });
      if ("error" in result) throw new TRPCError({ code: "PRECONDITION_FAILED", message: result.error });
      return { text: result.text, language: result.language, duration: result.duration };
    }),
  }),
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  projects: router({
    list: protectedProcedure.query(({ ctx }) => db.listUserProjects(ctx.user.id)),
    createPlan: protectedProcedure
      .input(z.object({ idea: z.string().min(8).max(1_000_000, "Prompt exceeds the 1 MB safe storage limit. Your full prompt was not submitted."), type: projectTypeSchema.default("mobile_app"), idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{16,100}$/), attachments: z.array(z.object({ name: z.string().min(1).max(240), mimeType: z.string().min(1).max(120), url: z.string().url(), textContent: z.string().max(1_000_000).optional() })).max(20).default([]) }))
      .mutation(async ({ ctx, input }) => {
        const sourceLanguage = detectSourceLanguage(input.idea);
        const plan = await generatePlan(input.idea, input.type as ProjectType, input.attachments);
        const generatedFiles = await generateStarterFiles(plan);
        if (!generatedFiles.length) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The coding agent returned no editable workspace files." });
        let projectId: number;
        try {
          const bootstrap = await db.createProjectBootstrap({ userId: ctx.user.id, name: plan.projectName, idea: input.idea, sourceLanguage, projectType: input.type, framework: plan.framework, status: "workspace_ready", buildStatus: "not_checked", planJson: JSON.stringify(plan), deployStatus: "planned" }, generatedFiles, { type: "plan_validated", message: "AI created and validated the structured plan, then initialized the editable workspace.", metadataJson: JSON.stringify({ sourceLanguage, idempotencyKey: input.idempotencyKey, generatedFileCount: generatedFiles.length }) });
          projectId = bootstrap.projectId;
        } catch (error) {
          const requestId = String(ctx.res.locals.requestId ?? "unknown");
          console.error("[projects.createPlan] transaction failed", { requestId, error: error instanceof Error ? error.message : "unknown" });
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Project creation failed. Your prompt has been preserved. Retry when ready. Request ID: ${requestId}` });
        }
        return { projectId, project: { id: projectId, name: plan.projectName, sourceLanguage }, plan, workspaceInitialized: true as const };
      }),
    get: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const project = await ownedProject(ctx.user.id, input.projectId);
        const [files, events, snapshots, buildJobs, exports, reviews, deployments, aiRuns, pipelineRuns, graph] = await Promise.all([
          db.listProjectFiles(project.id), db.listProjectEvents(project.id), db.listProjectSnapshots(project.id), db.listBuildJobs(project.id), db.listProjectExports(project.id), db.listCodeReviews(project.id), db.listDeployments(project.id), db.listAiRuns(project.id), db.listPipelineRuns(project.id), db.getProjectGraph(project.id),
        ]);
        return { project, plan: planFromProject(project.planJson), files, events, snapshots, buildJobs, exports, reviews, deployments, aiRuns, pipelineRuns, graph };
      }),
    generateFiles: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const project = await ownedProject(ctx.user.id, input.projectId);
        const existingFiles = await db.listProjectFiles(project.id);
        if (existingFiles.length) throw new TRPCError({ code: "CONFLICT", message: "Workspace already generated. Use regenerateFiles to create a new workspace version safely." });
        const files = await generateStarterFiles(planFromProject(project.planJson));
        if (!files.length) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The coding agent returned no files" });
        await db.insertProjectFiles(files.map((file) => ({ ...file, projectId: project.id })));
        await db.updateProjectStatus(project.id, { status: "workspace_ready", buildStatus: "not_checked" });
        await db.appendProjectEvent({ projectId: project.id, type: "files_generated", message: `Generated ${files.length} starter files from the approved plan.` });
        await snapshotProject(project.id, "Initial generated workspace", "generation", project.planJson, files as any);
        return { files };
      }),
    regenerateFiles: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive(), confirm: z.literal(true) }))
      .mutation(async ({ ctx, input }) => {
        const project = await ownedProject(ctx.user.id, input.projectId);
        const current = await db.listProjectFiles(project.id);
        if (!current.length) throw new TRPCError({ code: "BAD_REQUEST", message: "No existing workspace to regenerate." });
        await snapshotProject(project.id, "Before workspace regeneration", "before_regeneration", project.planJson, current);
        const generated = await generateStarterFiles(planFromProject(project.planJson));
        if (!generated.length) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "The coding agent returned no files for regeneration." });
        await db.replaceProjectFiles(project.id, generated);
        await db.updateProjectStatus(project.id, { status: "workspace_ready", buildStatus: "not_checked", previewUrl: null, deployStatus: "planned" });
        await db.appendProjectEvent({ projectId: project.id, type: "files_regenerated", message: `Regenerated ${generated.length} workspace files. Previous workspace is preserved in a restore point.` });
        return { files: generated, snapshotCreated: true };
      }),
    updateFile: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive(), path: z.string().min(1).max(320), content: z.string().max(200000) }))
      .mutation(async ({ ctx, input }) => {
        const project = await ownedProject(ctx.user.id, input.projectId);
        const files = await db.listProjectFiles(project.id);
        await snapshotProject(project.id, `Before editing ${input.path}`, "before_edit", project.planJson, files);
        await db.updateProjectFile(project.id, input.path, input.content);
        await db.appendProjectEvent({ projectId: project.id, type: "file_updated", message: `Updated ${input.path}. A restore point was created before the edit.` });
        return { success: true } as const;
      }),
    createSnapshot: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive(), label: z.string().min(1).max(160) }))
      .mutation(async ({ ctx, input }) => {
        const project = await ownedProject(ctx.user.id, input.projectId);
        const files = await db.listProjectFiles(project.id);
        const snapshotId = await snapshotProject(project.id, input.label, "manual", project.planJson, files);
        await db.appendProjectEvent({ projectId: project.id, type: "snapshot_created", message: `Created snapshot: ${input.label}.` });
        return { snapshotId };
      }),
    restoreSnapshot: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive(), snapshotId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const project = await ownedProject(ctx.user.id, input.projectId);
        const snapshot = await db.getProjectSnapshot(project.id, input.snapshotId);
        if (!snapshot) throw new TRPCError({ code: "NOT_FOUND", message: "Snapshot not found" });
        const current = await db.listProjectFiles(project.id);
        await snapshotProject(project.id, "Before snapshot restore", "before_restore", project.planJson, current);
        const restored = JSON.parse(snapshot.filesJson) as Array<{ path: string; language: string; content: string; isCritical: boolean }>;
        await db.replaceProjectFiles(project.id, restored);
        await db.appendProjectEvent({ projectId: project.id, type: "snapshot_restored", message: `Restored snapshot: ${snapshot.label}.` });
        return { success: true } as const;
      }),
    build: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive(), engine: z.enum(["auto", "native", "expo"]).default("auto") }))
      .mutation(async ({ ctx, input }) => {
        const project = await ownedProject(ctx.user.id, input.projectId);
        const files = await db.listProjectFiles(project.id);
        if (!files.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Generate workspace files before building." });
        const existingJobs = await db.listBuildJobs(project.id);
        const activeJob = existingJobs.find((job) => ["queued", "starting", "running"].includes(job.status));
        if (activeJob) return { jobId: activeJob.id, status: activeJob.status, configured: true as const, externalJobId: activeJob.externalJobId ?? undefined, logs: activeJob.logs ?? undefined };
        const jobId = await db.createBuildJob({ projectId: project.id, provider: `isolated-build-service:${input.engine}`, status: "queued", logs: "Build requested. Generated code is sent only to the configured isolated build service." });
        await db.appendBuildLog({ buildJobId: jobId, phase: "QUEUED", level: "info", message: "Build request accepted; generated code will not execute in the API process." });
        let result;
        try { result = await queueIsolatedBuild({ projectId: project.id, projectName: project.name, framework: project.framework, files, engine: input.engine as BuildEngineSelection }); }
        catch (error) {
          const message = error instanceof Error ? error.message : "Build provider request failed";
          await db.updateBuildJob(jobId, { status: "failed", error: message, logs: message });
          await db.appendBuildLog({ buildJobId: jobId, phase: "FAILED", level: "error", message });
          await db.updateProjectStatus(project.id, { buildStatus: "failed" });
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Build service request failed. Review the build logs and retry." });
        }
        await db.updateBuildJob(jobId, { status: result.status, externalJobId: "externalJobId" in result ? result.externalJobId : undefined, logs: "logs" in result ? result.logs : undefined, error: "error" in result ? result.error : undefined, previewUrl: "previewUrl" in result ? result.previewUrl : undefined });
        await db.appendBuildLog({ buildJobId: jobId, phase: result.status.toUpperCase(), level: result.status === "not_configured" || result.status === "failed" ? "error" : "info", message: "error" in result && result.error ? result.error : `Provider accepted build with status ${result.status}.` });
        await db.updateProjectStatus(project.id, { buildStatus: result.status, previewUrl: null });
        await db.appendProjectEvent({ projectId: project.id, type: "build_requested", message: result.configured ? "Build queued on the isolated build service." : "Build blocked: isolated build service is not configured." });
        return { jobId, ...result };
      }),
    buildStatus: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive(), jobId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const project = await ownedProject(ctx.user.id, input.projectId);
        const job = await db.getBuildJob(project.id, input.jobId);
        if (!job) throw new TRPCError({ code: "NOT_FOUND", message: "Build job not found" });
        if (!job.externalJobId || ["passed", "failed", "cancelled", "not_configured"].includes(job.status)) return job;
        const result = await pollIsolatedBuild(job.externalJobId);
        await db.updateBuildJob(job.id, { status: result.status, logs: result.logs, error: result.error, previewUrl: result.previewUrl });
        await db.updateProjectStatus(project.id, { buildStatus: result.status, previewUrl: null });
        if (result.artifact && result.status === "passed") {
          const existing = await db.listBuildArtifacts(project.id);
          if (!existing.some((artifact) => artifact.buildJobId === job.id)) await db.createBuildArtifact({ buildJobId: job.id, projectId: project.id, artifactType: result.artifact.type, status: "ready", storageKey: result.artifact.storageKey, fileName: result.artifact.fileName, sha256: result.artifact.sha256, byteSize: result.artifact.byteSize, versionName: result.artifact.versionName, versionCode: result.artifact.versionCode, packageName: result.artifact.packageName });
        }
        return { ...job, ...result };
      }),
    artifacts: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const project = await ownedProject(ctx.user.id, input.projectId);
        return db.listBuildArtifacts(project.id);
      }),
    startPreview: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive(), jobId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const project = await ownedProject(ctx.user.id, input.projectId);
        const job = await db.getBuildJob(project.id, input.jobId);
        if (!job || job.status !== "passed" || !job.externalJobId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Preview requires a confirmed passed build." });
        const runtimeId = await db.createPreviewRuntime({ projectId: project.id, buildJobId: job.id, status: "starting", healthStatus: "unknown" });
        const result = await startPreview({ projectId: project.id, buildExternalJobId: job.externalJobId, previewUrl: job.previewUrl ?? undefined });
        await db.updatePreviewRuntime(runtimeId, { status: result.status, externalRuntimeId: "externalRuntimeId" in result ? result.externalRuntimeId : undefined, previewUrl: "previewUrl" in result ? result.previewUrl : undefined, healthStatus: "healthStatus" in result ? result.healthStatus : "unknown", error: "error" in result ? result.error : undefined });
        await db.updateProjectStatus(project.id, { previewUrl: result.status === "live" && "previewUrl" in result && result.previewUrl && "healthStatus" in result && result.healthStatus === "healthy" ? result.previewUrl : null });
        await db.appendProjectEvent({ projectId: project.id, type: "preview_started", message: result.configured ? `Preview runtime status: ${result.status}.` : "Preview blocked: preview service is not configured." });
        return { runtimeId, ...result };
      }),
    previewStatus: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive(), runtimeId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const project = await ownedProject(ctx.user.id, input.projectId);
        const runtime = await db.getPreviewRuntime(project.id, input.runtimeId);
        if (!runtime) throw new TRPCError({ code: "NOT_FOUND", message: "Preview runtime not found" });
        if (!runtime.externalRuntimeId || ["live", "failed", "cancelled", "not_configured", "stopped"].includes(runtime.status)) return runtime;
        const result = await pollPreview(runtime.externalRuntimeId);
        await db.updatePreviewRuntime(runtime.id, { status: result.status, previewUrl: result.previewUrl, healthStatus: result.healthStatus, consoleLogs: result.consoleLogs, networkLogs: result.networkLogs, error: result.error });
        return { ...runtime, ...result };
      }),
    exportZip: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const project = await ownedProject(ctx.user.id, input.projectId);
        const files = await db.listProjectFiles(project.id);
        try {
          const exported = await createProjectZip(project.id, project.name, files);
          const exportId = await db.createProjectExport({ projectId: project.id, storageKey: exported.key, fileName: exported.fileName });
          await db.appendProjectEvent({ projectId: project.id, type: "export_created", message: `Created secure ZIP export ${exported.fileName}.` });
          return { exportId, ...exported };
        } catch (error) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: error instanceof Error ? error.message : "ZIP export is not configured" });
        }
      }),
    softwareFactory: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive(), instruction: z.string().min(4).max(1_000_000, "Instruction exceeds the 1 MB safe storage limit.") }))
      .mutation(async ({ ctx, input }) => {
        const project = await ownedProject(ctx.user.id, input.projectId);
        const files = await db.listProjectFiles(project.id);
        if (!files.length) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Generate the editable workspace before running the Software Factory." });
        const started = Date.now();
        const reports = await runSoftwareFactory({ instruction: input.instruction, plan: planFromProject(project.planJson), files: files.map((f) => ({ path: f.path, content: f.content })) });
        const runIds: number[] = [];
        for (const report of reports) {
          const runId = await db.createAiRun({ projectId: project.id, agentKey: `factory-${report.role}`, model: "gpt-5-mini", status: "completed", prompt: input.instruction, toolsJson: JSON.stringify(["workspace.read", "factory.audit"]), durationMs: Math.max(0, Date.now() - started), resultJson: JSON.stringify(report) });
          runIds.push(runId);
        }
        await db.appendProjectEvent({ projectId: project.id, type: "software_factory_audit", message: `Software Factory completed ${reports.length} controlled agent reviews.`, metadataJson: JSON.stringify({ runIds, instruction: input.instruction, roles: reports.map((r) => r.role) }) });
        return { reports, runIds, completedAt: new Date().toISOString() };
      }),
    agentTask: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive(), instruction: z.string().min(4).max(1_000_000, "Instruction exceeds the 1 MB safe storage limit."), mode: z.enum(["preview", "apply"]).default("preview"), runId: z.number().int().positive().optional() }))
      .mutation(async ({ ctx, input }) => {
        const project = await ownedProject(ctx.user.id, input.projectId);
        const files = await db.listProjectFiles(project.id);
        if (!files.length) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Generate the editable workspace before asking the coding agent to modify it." });

        // Preview is the safe default: AI proposes complete file replacements, but nothing is changed until the owner explicitly applies the run.
        if (input.mode === "preview") {
          const runId = await db.createAiRun({ projectId: project.id, agentKey: "mobile-coding-agent", model: "gpt-5-mini", status: "running", prompt: input.instruction, toolsJson: JSON.stringify(["workspace.read", "workspace.patch.preview"]), });
          const started = Date.now();
          try {
            const result = await executeCodingTask({ instruction: input.instruction, plan: planFromProject(project.planJson), files: files.map((file) => ({ path: file.path, content: file.content, language: file.language })) });
            const baseHashes = Object.fromEntries(result.patches.map((patch) => {
              const file = files.find((item) => item.path === patch.path);
              return [patch.path, file ? createHash("sha256").update(file.content).digest("hex") : ""];
            }));
            await db.updateAiRun(runId, { status: "preview", filesChangedJson: JSON.stringify(result.patches.map((patch) => patch.path)), durationMs: Date.now() - started, resultJson: JSON.stringify({ ...result, baseHashes }) });
            await db.appendProjectEvent({ projectId: project.id, type: "agent_task_preview", message: `AI prepared ${result.patches.length} proposed file change(s); no workspace files were modified.`, metadataJson: JSON.stringify({ runId, instruction: input.instruction, changedPaths: result.patches.map((patch) => patch.path) }) });
            return { runId, snapshotId: null, applied: false, ...result };
          } catch (error) {
            const message = error instanceof Error ? error.message : "AI coding task failed";
            await db.updateAiRun(runId, { status: "failed", durationMs: Date.now() - started, error: message });
            throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI coding task preview failed. No workspace changes were made." });
          }
        }

        if (!input.runId) throw new TRPCError({ code: "BAD_REQUEST", message: "A preview run is required before applying AI changes." });
        const runs = await db.listAiRuns(project.id);
        const run = runs.find((item) => item.id === input.runId);
        if (!run || run.status !== "preview" || !run.resultJson) throw new TRPCError({ code: "CONFLICT", message: "This AI preview is no longer available for application." });
        const currentFiles = await db.listProjectFiles(project.id);
        const stored = JSON.parse(run.resultJson) as Awaited<ReturnType<typeof executeCodingTask>> & { baseHashes?: Record<string, string> };
        const result = stored;
        const known = new Map(currentFiles.map((file) => [file.path, file.content]));
        const stalePaths = result.patches.filter((patch) => {
          const expected = stored.baseHashes?.[patch.path];
          const current = known.get(patch.path);
          return expected && current !== undefined && createHash("sha256").update(current).digest("hex") !== expected;
        }).map((patch) => patch.path);
        if (stalePaths.length) throw new TRPCError({ code: "CONFLICT", message: `AI preview is stale because these file(s) changed after preview: ${stalePaths.join(", ")}. Generate a new preview.` });
        const patches = result.patches.filter((patch) => known.has(patch.path));
        if (!patches.length) throw new TRPCError({ code: "CONFLICT", message: "The preview contains no applicable workspace changes." });
        const snapshotId = await snapshotProject(project.id, "Before applying AI preview", "before_ai_preview_apply", project.planJson, currentFiles);
        try {
          for (const patch of patches) await db.updateProjectFile(project.id, patch.path, patch.content);
          await db.updateAiRun(run.id, { status: "completed", filesChangedJson: JSON.stringify(patches.map((patch) => patch.path)) });
          await db.appendProjectEvent({ projectId: project.id, type: "agent_task_applied", message: `Applied AI preview #${run.id}: ${patches.length} file(s) changed.`, metadataJson: JSON.stringify({ runId: run.id, snapshotId, changedPaths: patches.map((patch) => patch.path) }) });
          return { runId: run.id, snapshotId, applied: true, ...result, patches };
        } catch (error) {
          const message = error instanceof Error ? error.message : "AI preview apply failed";
          const snapshot = await db.getProjectSnapshot(project.id, snapshotId);
          if (snapshot) await db.replaceProjectFiles(project.id, JSON.parse(snapshot.filesJson) as Array<{ path: string; language: string; content: string; isCritical: boolean }>);
          await db.updateAiRun(run.id, { status: "failed", error: message });
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI preview could not be applied. The workspace was restored to its pre-apply snapshot." });
        }
      }),
    review: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive(), mode: z.enum(["review", "fix"]) }))
      .mutation(async ({ ctx, input }) => {
        const project = await ownedProject(ctx.user.id, input.projectId);
        const files = await db.listProjectFiles(project.id);
        if (!files.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Generate workspace files before reviewing code." });
        if (input.mode === "fix") await snapshotProject(project.id, "Before AI auto-fix", "before_ai_fix", project.planJson, files);
        const result = await reviewProjectFiles(files, input.mode);
        const existingPaths = new Set(files.map((file) => file.path));
        const applied = input.mode === "fix" ? (result.patches ?? []).filter((patch) => existingPaths.has(patch.path)).slice(0, 3) : [];
        for (const patch of applied) await db.updateProjectFile(project.id, patch.path, patch.content);
        const reviewId = await db.createCodeReview({ projectId: project.id, mode: input.mode, status: applied.length ? "applied" : "completed", summary: result.summary, resultJson: JSON.stringify({ ...result, appliedPaths: applied.map((patch) => patch.path) }) });
        await db.appendProjectEvent({ projectId: project.id, type: input.mode === "fix" ? "ai_fix" : "code_review", message: input.mode === "fix" ? `AI auto-fix completed with ${applied.length} bounded patch(es).` : "AI code review completed." });
        return { reviewId, ...result, appliedPaths: applied.map((patch) => patch.path) };
      }),
    deploy: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive(), provider: z.enum(["managed", "vercel", "netlify"]).default("managed") }))
      .mutation(async ({ ctx, input }) => {
        const project = await ownedProject(ctx.user.id, input.projectId);
        const existingDeployments = await db.listDeployments(project.id);
        const activeDeployment = existingDeployments.find((item) => ["queued", "building", "deploying", "starting", "running"].includes(item.status));
        if (activeDeployment) return { deploymentId: activeDeployment.id, status: activeDeployment.status, externalDeploymentId: activeDeployment.externalDeploymentId ?? undefined, targetUrl: activeDeployment.targetUrl ?? undefined };
        if (project.buildStatus !== "passed") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Deployment requires a passed isolated build. Current build status: " + project.buildStatus });
        const [snapshots, testRuns, securityScans, previewRuntimes, artifacts] = await Promise.all([
          db.listProjectSnapshots(project.id), db.listTestRuns(project.id), db.listSecurityScans(project.id), db.listPreviewRuntimes(project.id), db.listBuildArtifacts(project.id),
        ]);
        const latestTest = testRuns[0];
        const latestSecurity = securityScans[0];
        const gate = evaluateProductionGate({
          buildStatus: project.buildStatus,
          previewUrl: project.previewUrl,
          previewHealthStatus: previewRuntimes[0]?.healthStatus,
          testStatus: latestTest?.status,
          securityStatus: latestSecurity?.status,
          securityCritical: latestSecurity?.critical,
          securityHigh: latestSecurity?.high,
          snapshotCount: snapshots.length,
          artifactCount: artifacts.filter((artifact) => artifact.status === "ready").length,
        });
        if (gate.status !== "PASS") throw new TRPCError({ code: "PRECONDITION_FAILED", message: `Production gate blocked deployment: ${gate.checks.filter((check) => check.state === "BLOCKED").map((check) => check.label).join(", ")}.` });
        const files = await db.listProjectFiles(project.id);
        const latestArtifact = artifacts.find((artifact) => artifact.buildJobId && artifact.status === "ready");
        const deploymentId = await db.createDeployment({ projectId: project.id, provider: input.provider, status: "queued" });
        await db.appendDeploymentLog({ deploymentId, state: "QUEUED", message: "Deployment request created; provider confirmation is required." });
        let result;
        try { result = await queueDeployment({ projectId: project.id, projectName: project.name, framework: project.framework, files, provider: input.provider, buildArtifactId: latestArtifact?.id }); }
        catch (error) {
          const message = error instanceof Error ? error.message : "Deployment provider request failed";
          await db.updateDeployment(deploymentId, { status: "failed", error: message });
          await db.appendDeploymentLog({ deploymentId, state: "FAILED", message });
          await db.updateProjectStatus(project.id, { deployStatus: "failed" });
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Deployment provider request failed. Review deployment logs and retry." });
        }
        await db.updateDeployment(deploymentId, { status: result.status, externalDeploymentId: "externalDeploymentId" in result ? result.externalDeploymentId : undefined, targetUrl: "targetUrl" in result ? result.targetUrl : undefined, error: "error" in result ? result.error : undefined });
        await db.appendDeploymentLog({ deploymentId, state: result.status.toUpperCase(), message: "error" in result && result.error ? result.error : `Provider returned ${result.status}.` });
        await db.updateProjectStatus(project.id, { deployStatus: result.status });
        await db.appendProjectEvent({ projectId: project.id, type: "deployment_requested", message: result.configured ? "Deployment queued with the configured deployment service." : "Deployment blocked: deployment service is not configured." });
        return { deploymentId, ...result };
      }),
    deploymentStatus: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive(), deploymentId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const project = await ownedProject(ctx.user.id, input.projectId);
        const deployments = await db.listDeployments(project.id);
        const deployment = deployments.find((item) => item.id === input.deploymentId);
        if (!deployment) throw new TRPCError({ code: "NOT_FOUND", message: "Deployment not found" });
        if (!deployment.externalDeploymentId || ["passed", "failed", "cancelled", "not_configured"].includes(deployment.status)) return deployment;
        const result = await pollDeployment(deployment.externalDeploymentId);
        await db.updateDeployment(deployment.id, { status: result.status, targetUrl: result.targetUrl, error: result.error });
        await db.appendDeploymentLog({ deploymentId: deployment.id, state: result.status.toUpperCase(), message: "logs" in result && result.logs ? result.logs : `Deployment status checked: ${result.status}.` });
        await db.updateProjectStatus(project.id, { deployStatus: result.status });
        const health = result.status === "live" && result.targetUrl ? await healthCheckUrl(result.targetUrl) : null;
        if (health && health.status !== "healthy") {
          await db.appendDeploymentLog({ deploymentId: deployment.id, state: "VERIFYING", message: `Live URL health check: ${health.status}.` });
          await db.updateDeployment(deployment.id, { status: "failed", error: "Deployment provider reported live, but the target URL health check failed." });
          await db.updateProjectStatus(project.id, { deployStatus: "failed" });
        }
        return { ...deployment, ...result, ...(health && health.status !== "healthy" ? { status: "failed", error: "Deployment target failed health verification." } : {}), health };
      }),
    startAutonomousRun: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const project = await ownedProject(ctx.user.id, input.projectId);
        if (project.status === "draft") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Create and approve a project plan before starting the autonomous pipeline." });
        return startAutonomousRun({ id: project.id, name: project.name, framework: project.framework, planJson: project.planJson });
      }),
    autonomousRunStatus: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive(), runId: z.number().int().positive(), advance: z.boolean().default(false) }))
      .query(async ({ ctx, input }) => {
        const project = await ownedProject(ctx.user.id, input.projectId);
        if (input.advance) return advanceAutonomousRun({ id: project.id, name: project.name, framework: project.framework }, input.runId);
        return db.getPipelineRun(project.id, input.runId);
      }),
    gitStatus: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const project = await ownedProject(ctx.user.id, input.projectId);
      const [repository, branches, prs] = await Promise.all([db.getGitRepository(project.id), db.listGitBranches(project.id), db.listGitPullRequests(project.id)]);
      return { provider: githubProvider().status(), repository, branches, pullRequests: prs, activeGitBranchId: project.activeGitBranchId ?? null };
    }),
    gitConnect: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), repositoryUrl: z.string().url() })).mutation(async ({ ctx, input }) => {
      const project = await ownedProject(ctx.user.id, input.projectId);
      const repo = githubRepositoryFromUrl(input.repositoryUrl);
      const remote = await githubProvider().getRepository(repo);
      const existing = await db.getGitRepository(project.id);
      const repositoryId = existing?.id ?? await db.createGitRepository({ projectId: project.id, provider: "github", repositoryUrl: remote.url, owner: remote.owner, name: remote.name, defaultBranch: remote.defaultBranch, connected: true });
      if (existing) await db.updateGitRepository(existing.id, { repositoryUrl: remote.url, owner: remote.owner, name: remote.name, defaultBranch: remote.defaultBranch, connected: true });
      const snapshots = await db.listProjectSnapshots(project.id);
      const files = await db.listProjectFiles(project.id);
      if (!snapshots.length) await db.createSnapshot({ projectId: project.id, label: "Git initial baseline", reason: "git_baseline", planJson: project.planJson, filesJson: JSON.stringify(files.map(f => ({ path: f.path, content: f.content }))) });
      const refreshedSnapshots = await db.listProjectSnapshots(project.id); const baseline = refreshedSnapshots[refreshedSnapshots.length - 1];
      const branches = await db.listGitBranches(project.id);
      if (!branches.length && baseline) { const branchId = await db.createGitBranch({ projectId: project.id, name: remote.defaultBranch, baseSnapshotId: baseline.id, headSnapshotId: baseline.id, protected: true, isDefault: true, upstreamBranch: remote.defaultBranch, syncState: "unknown" }); await db.updateProjectStatus(project.id, { activeGitBranchId: branchId }); }
      await db.appendProjectEvent({ projectId: project.id, type: "git_connected", message: `Connected GitHub repository ${remote.owner}/${remote.name}.`, metadataJson: JSON.stringify({ repositoryId }) });
      return { repositoryId, repository: remote, provider: githubProvider().status() };
    }),
    gitCreateBranch: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), name: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._\/-]{0,159}$/) })).mutation(async ({ ctx, input }) => {
      const project = await ownedProject(ctx.user.id, input.projectId); const branches = await db.listGitBranches(project.id); if (branches.some(b => b.name === input.name)) throw new TRPCError({ code: "CONFLICT", message: "Branch already exists." });
      const currentFiles = await db.listProjectFiles(project.id); const snapshotId = await db.createSnapshot({ projectId: project.id, label: `Branch ${input.name} baseline`, reason: "git_branch", planJson: project.planJson, filesJson: JSON.stringify(currentFiles.map(f => ({ path: f.path, content: f.content }))) });
      const id = await db.createGitBranch({ projectId: project.id, name: input.name, baseSnapshotId: snapshotId, headSnapshotId: snapshotId, protected: ["main", "master", "release"].includes(input.name), isDefault: false, upstreamBranch: input.name, syncState: "local" });
      const repo = await db.getGitRepository(project.id); if (repo && repo.connected) { try { const remoteBase = await githubProvider().getBranch({owner:repo.owner,name:repo.name,defaultBranch:repo.defaultBranch,url:repo.repositoryUrl}, repo.defaultBranch); const created = await githubProvider().createBranch({owner:repo.owner,name:repo.name,defaultBranch:repo.defaultBranch,url:repo.repositoryUrl}, input.name, remoteBase.sha); await db.updateGitBranch(id,{remoteSha:created.sha,lastFetchedSha:created.sha,syncState:"synced"}); } catch (error) { await db.updateGitBranch(id,{syncState:"local"}); await db.appendProjectEvent({projectId:project.id,type:"git_remote_branch_pending",message:`Local branch ${input.name} created; remote branch creation is pending.`,metadataJson:JSON.stringify({error:error instanceof Error?error.message:String(error)})}); } }
      await db.appendProjectEvent({ projectId: project.id, type: "git_branch_created", message: `Created branch ${input.name}.`, metadataJson: JSON.stringify({ branchId: id }) }); return { id, name: input.name };
    }),
    gitCommit: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), branchId: z.number().int().positive(), message: z.string().trim().min(3).max(240) })).mutation(async ({ ctx, input }) => {
      const project = await ownedProject(ctx.user.id, input.projectId); const branch = await db.getGitBranch(project.id, input.branchId); if (!branch) throw new TRPCError({ code: "NOT_FOUND", message: "Branch not found." }); if (project.activeGitBranchId !== branch.id) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Checkout this branch before committing. The server-enforced active branch prevents accidental commits to another branch." });
      const current = await db.listProjectFiles(project.id); const head = await db.getProjectSnapshot(project.id, branch.headSnapshotId); if (!head) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Branch head snapshot is missing." });
      let headFiles: any[]; try { headFiles = JSON.parse(head.filesJson); } catch { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Branch head snapshot is corrupted." }); }
      const diff = summarizeVersion(headFiles, current.map(f => ({ path: f.path, content: f.content }))); if (!diff.filesChanged) throw new TRPCError({ code: "BAD_REQUEST", message: "No changes to commit." });
      const snapshotId = await db.createSnapshot({ projectId: project.id, label: `Commit: ${input.message}`, reason: "git_commit", planJson: project.planJson, filesJson: JSON.stringify(current.map(f => ({ path: f.path, content: f.content }))) });
      const commits = await db.listGitCommits(project.id, branch.id); const treeHash = contentHash(current.map(f => `${f.path}\0${f.content}`).sort().join("\n"));
      const id = await db.createGitCommit({ projectId: project.id, branchId: branch.id, parentCommitId: commits[0]?.id, snapshotId, message: input.message, treeHash, authorUserId: ctx.user.id }); await db.updateGitBranch(branch.id, { headSnapshotId: snapshotId });
      await db.appendProjectEvent({ projectId: project.id, type: "git_commit", message: `Committed ${diff.filesChanged} changed file(s) to ${branch.name}.`, metadataJson: JSON.stringify({ commitId: id, branchId: branch.id }) }); return { id, filesChanged: diff.filesChanged };
    }),
    gitCheckout: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), branchId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const project = await ownedProject(ctx.user.id, input.projectId); const branch = await db.getGitBranch(project.id, input.branchId); if (!branch) throw new TRPCError({ code: "NOT_FOUND", message: "Branch not found." }); const head = await db.getProjectSnapshot(project.id, branch.headSnapshotId); if (!head) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Branch head snapshot is missing." });
      const current = await db.listProjectFiles(project.id); await db.createSnapshot({ projectId: project.id, label: "Pre-checkout safety restore", reason: "git_checkout_safety", planJson: project.planJson, filesJson: JSON.stringify(current.map(f => ({ path: f.path, content: f.content, language: f.language, isCritical: f.isCritical }))) });
      let files: any[]; try { files = JSON.parse(head.filesJson); } catch { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Branch snapshot is corrupted." }); }
      await db.replaceProjectFiles(project.id, files.map(f => ({ path: f.path, language: f.path.split(".").pop() || "text", content: f.content, isCritical: false }))); await db.updateProjectStatus(project.id,{activeGitBranchId:branch.id}); await db.appendProjectEvent({ projectId: project.id, type: "git_checkout", message: `Checked out ${branch.name}.`, metadataJson: JSON.stringify({ branchId: branch.id }) }); return { branchId: branch.id, name: branch.name };
    }),
    gitCompare: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), sourceBranchId: z.number().int().positive(), targetBranchId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const project = await ownedProject(ctx.user.id, input.projectId); const source = await db.getGitBranch(project.id, input.sourceBranchId); const target = await db.getGitBranch(project.id, input.targetBranchId); if (!source || !target) throw new TRPCError({ code: "NOT_FOUND", message: "Branch not found." }); const base = await db.getProjectSnapshot(project.id, source.baseSnapshotId); const ours = await db.getProjectSnapshot(project.id, target.headSnapshotId); const theirs = await db.getProjectSnapshot(project.id, source.headSnapshotId); if (!base || !ours || !theirs) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Merge snapshot is missing." });
      const parse = (x: any) => { try { return JSON.parse(x.filesJson) as any[]; } catch { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Merge snapshot is corrupted." }); } }; return { source: source.name, target: target.name, ...threeWayMerge(parse(base), parse(ours), parse(theirs)) };
    }),
    gitCreatePullRequest: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), sourceBranchId: z.number().int().positive(), targetBranchId: z.number().int().positive(), title: z.string().trim().min(3).max(240), description: z.string().max(10000).default("") })).mutation(async ({ ctx, input }) => {
      const project = await ownedProject(ctx.user.id, input.projectId); const source = await db.getGitBranch(project.id, input.sourceBranchId); const target = await db.getGitBranch(project.id, input.targetBranchId); if (!source || !target || source.id === target.id) throw new TRPCError({ code: "BAD_REQUEST", message: "Choose two different branches." }); const base = await db.getProjectSnapshot(project.id, source.baseSnapshotId); const ours = await db.getProjectSnapshot(project.id, target.headSnapshotId); const theirs = await db.getProjectSnapshot(project.id, source.headSnapshotId); if (!base || !ours || !theirs) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Merge snapshot is missing." }); const parse=(x:any)=>JSON.parse(x.filesJson); const result=threeWayMerge(parse(base),parse(ours),parse(theirs)); const id=await db.createGitPullRequest({ projectId: project.id, sourceBranchId: source.id, targetBranchId: target.id, title: input.title, description: input.description, status: result.clean ? "open" : "conflicted", conflictsJson: JSON.stringify(result.conflicts) }); await db.appendProjectEvent({ projectId: project.id, type: "git_pr_created", message: `Pull request ${source.name} → ${target.name} created${result.clean ? "." : " with conflicts."}`, metadataJson: JSON.stringify({ pullRequestId: id }) }); return { id, clean: result.clean, conflicts: result.conflicts };
    }),
    gitMerge: protectedProcedure.input(z.object({ projectId: z.number().int().positive(), pullRequestId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const project = await ownedProject(ctx.user.id, input.projectId); const pr = await db.getGitPullRequest(project.id, input.pullRequestId); if (!pr) throw new TRPCError({ code: "NOT_FOUND", message: "Pull request not found." }); if (pr.status !== "open") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Pull request is not mergeable." }); const source=await db.getGitBranch(project.id,pr.sourceBranchId); const target=await db.getGitBranch(project.id,pr.targetBranchId); if(!source||!target) throw new TRPCError({code:"NOT_FOUND",message:"Branch not found."});
      if(target.protected){ const tests=await db.listTestRuns(project.id), scans=await db.listSecurityScans(project.id); if(!tests.some(t=>t.status==="passed"&&t.failed===0)||!scans.some(x=>x.status==="passed"&&x.critical===0&&x.high===0)) throw new TRPCError({code:"PRECONDITION_FAILED",message:"Protected branch requires a passed test run and a clean security scan before merge."}); }
      const base=await db.getProjectSnapshot(project.id,source.baseSnapshotId), ours=await db.getProjectSnapshot(project.id,target.headSnapshotId), theirs=await db.getProjectSnapshot(project.id,source.headSnapshotId); if(!base||!ours||!theirs) throw new TRPCError({code:"INTERNAL_SERVER_ERROR",message:"Merge snapshot is missing."}); const parse=(x:any)=>JSON.parse(x.filesJson); const result=threeWayMerge(parse(base),parse(ours),parse(theirs)); if(!result.clean){ await db.updateGitPullRequest(pr.id,{status:"conflicted",conflictsJson:JSON.stringify(result.conflicts)}); throw new TRPCError({code:"CONFLICT",message:`Merge has ${result.conflicts.length} conflict(s). Resolve them before merging.`}); }
      const current=await db.listProjectFiles(project.id); await db.createSnapshot({projectId:project.id,label:"Pre-merge safety restore",reason:"git_merge_safety",planJson:project.planJson,filesJson:JSON.stringify(current.map(f=>({path:f.path,content:f.content,language:f.language,isCritical:f.isCritical})))}); const sid=await db.createSnapshot({projectId:project.id,label:`Merge ${source.name} into ${target.name}`,reason:"git_merge",planJson:project.planJson,filesJson:JSON.stringify(result.files)}); await db.replaceProjectFiles(project.id,result.files.map(f=>({path:f.path,language:f.path.split(".").pop()||"text",content:f.content,isCritical:false}))); await db.updateGitBranch(target.id,{headSnapshotId:sid}); await db.updateGitPullRequest(pr.id,{status:"merged"}); await db.appendProjectEvent({projectId:project.id,type:"git_merge",message:`Merged ${source.name} into ${target.name}.`,metadataJson:JSON.stringify({pullRequestId:pr.id})}); return {status:"merged",snapshotId:sid};
    }),
    gitFetch: protectedProcedure.input(z.object({ projectId:z.number().int().positive(), branchId:z.number().int().positive() })).mutation(async({ctx,input})=>{ const project=await ownedProject(ctx.user.id,input.projectId); const repo=await db.getGitRepository(project.id); const branch=await db.getGitBranch(project.id,input.branchId); if(!repo||!branch) throw new TRPCError({code:"PRECONDITION_FAILED",message:"GitHub and branch are required."}); const remote=await githubProvider().getBranch({owner:repo.owner,name:repo.name,defaultBranch:repo.defaultBranch,url:repo.repositoryUrl},branch.upstreamBranch||branch.name); const previous=branch.remoteSha; const state=previous===remote.sha?"synced":previous?"behind_or_diverged":"fetched"; await db.updateGitBranch(branch.id,{remoteSha:remote.sha,lastFetchedSha:remote.sha,syncState:state}); await db.updateGitRepository(repo.id,{lastFetchedAt:new Date(),lastRemoteDefaultSha:remote.sha}); return {branch:branch.name,remoteSha:remote.sha,previousRemoteSha:previous,syncState:state}; }),
    gitPull: protectedProcedure.input(z.object({ projectId:z.number().int().positive(), branchId:z.number().int().positive() })).mutation(async({ctx,input})=>{ const project=await ownedProject(ctx.user.id,input.projectId); const repo=await db.getGitRepository(project.id); const branch=await db.getGitBranch(project.id,input.branchId); if(!repo||!branch) throw new TRPCError({code:"PRECONDITION_FAILED",message:"GitHub and branch are required."}); if(project.activeGitBranchId!==branch.id) throw new TRPCError({code:"PRECONDITION_FAILED",message:"Checkout the branch before pulling."}); const remote=await githubProvider().getBranchFiles({owner:repo.owner,name:repo.name,defaultBranch:repo.defaultBranch,url:repo.repositoryUrl},branch.upstreamBranch||branch.name); if(branch.remoteSha===remote.sha) return {status:"up_to_date",sha:remote.sha}; const current=await db.listProjectFiles(project.id); const safety=await db.createSnapshot({projectId:project.id,label:"Pre-pull safety restore",reason:"git_pull_safety",planJson:project.planJson,filesJson:JSON.stringify(current.map(f=>({path:f.path,content:f.content,language:f.language,isCritical:f.isCritical})))}); const head=await db.getProjectSnapshot(project.id,branch.headSnapshotId); if(!head) throw new TRPCError({code:"INTERNAL_SERVER_ERROR",message:"Branch head snapshot is missing."}); const parse=(x:any)=>{try{return JSON.parse(x.filesJson) as Array<{path:string;content:string}>;}catch{throw new TRPCError({code:"INTERNAL_SERVER_ERROR",message:"Snapshot is corrupted."});}}; const base=parse(head); const result=threeWayMerge(base,current.map(f=>({path:f.path,content:f.content})),remote.files); if(!result.clean){await db.updateGitBranch(branch.id,{remoteSha:remote.sha,lastFetchedSha:remote.sha,syncState:"diverged"}); return {status:"conflicted",sha:remote.sha,conflicts:result.conflicts,safetySnapshotId:safety};} const sid=await db.createSnapshot({projectId:project.id,label:`Pull ${branch.name} ${remote.sha.slice(0,8)}`,reason:"git_pull",planJson:project.planJson,filesJson:JSON.stringify(result.files)}); await db.replaceProjectFiles(project.id,result.files.map(f=>({path:f.path,language:f.path.split(".").pop()||"text",content:f.content,isCritical:false}))); await db.updateGitBranch(branch.id,{headSnapshotId:sid,remoteSha:remote.sha,lastFetchedSha:remote.sha,syncState:"synced"}); return {status:"merged",sha:remote.sha,snapshotId:sid,safetySnapshotId:safety}; }),
    gitRemoteBranches: protectedProcedure.input(z.object({ projectId: z.number().int().positive() })).query(async ({ctx,input})=>{ const project=await ownedProject(ctx.user.id,input.projectId); const repo=await db.getGitRepository(project.id); if(!repo) throw new TRPCError({code:"PRECONDITION_FAILED",message:"Connect a GitHub repository first."}); return githubProvider().listBranches({owner:repo.owner,name:repo.name,defaultBranch:repo.defaultBranch,url:repo.repositoryUrl}); }),
    gitPush: protectedProcedure.input(z.object({ projectId:z.number().int().positive(), branchId:z.number().int().positive(), message:z.string().trim().min(3).max(240) })).mutation(async({ctx,input})=>{ const project=await ownedProject(ctx.user.id,input.projectId); const repo=await db.getGitRepository(project.id); const branch=await db.getGitBranch(project.id,input.branchId); if(!repo||!branch) throw new TRPCError({code:"PRECONDITION_FAILED",message:"Connect GitHub and select a valid branch."}); if(project.activeGitBranchId!==branch.id) throw new TRPCError({code:"PRECONDITION_FAILED",message:"Checkout the branch before pushing."}); const files=await db.listProjectFiles(project.id); const remoteProvider=githubProvider(); const remoteBase=await remoteProvider.getBranch({owner:repo.owner,name:repo.name,defaultBranch:repo.defaultBranch,url:repo.repositoryUrl},branch.name).catch(()=>null); if(!remoteBase) throw new TRPCError({code:"PRECONDITION_FAILED",message:"Remote branch does not exist. Create/sync the remote branch before pushing."}); if(branch.remoteSha && remoteBase.sha!==branch.remoteSha) { await db.updateGitBranch(branch.id,{syncState:"diverged"}); throw new TRPCError({code:"CONFLICT",message:`Remote branch changed from ${branch.remoteSha.slice(0,8)} to ${remoteBase.sha.slice(0,8)}. Fetch and reconcile before pushing.`}); } const remoteTree=await remoteProvider.getBranchFiles({owner:repo.owner,name:repo.name,defaultBranch:repo.defaultBranch,url:repo.repositoryUrl},branch.name); const localPaths=new Set(files.map(f=>f.path)); const deletePaths=remoteTree.files.map(f=>f.path).filter(path=>!localPaths.has(path)); const remote=await remoteProvider.createCommit({owner:repo.owner,name:repo.name,defaultBranch:repo.defaultBranch,url:repo.repositoryUrl},branch.name,input.message,files.map(f=>({path:f.path,content:f.content})),remoteBase.sha,deletePaths); const commits=await db.listGitCommits(project.id,branch.id); const currentSnapshot=await db.createSnapshot({projectId:project.id,label:`Remote commit: ${input.message}`,reason:"git_push",planJson:project.planJson,filesJson:JSON.stringify(files.map(f=>({path:f.path,content:f.content})))}); await db.createGitCommit({projectId:project.id,branchId:branch.id,parentCommitId:commits[0]?.id,snapshotId:currentSnapshot,message:input.message,treeHash:contentHash(files.map(f=>`${f.path}\0${f.content}`).sort().join("\n")),authorUserId:ctx.user.id,remoteSha:remote.sha,pushState:"pushed"}); await db.updateGitBranch(branch.id,{remoteSha:remote.sha,lastFetchedSha:remote.sha,syncState:"synced"}); await db.appendProjectEvent({projectId:project.id,type:"git_push",message:`Pushed commit ${remote.sha.slice(0,8)} to ${branch.name}.`,metadataJson:JSON.stringify({remoteSha:remote.sha})}); return remote; }),
    gitOpenRemotePR: protectedProcedure.input(z.object({ projectId:z.number().int().positive(), sourceBranchId:z.number().int().positive(), targetBranchId:z.number().int().positive(), title:z.string().trim().min(3).max(240), body:z.string().max(10000).default("") })).mutation(async({ctx,input})=>{ const project=await ownedProject(ctx.user.id,input.projectId); const repo=await db.getGitRepository(project.id); const source=await db.getGitBranch(project.id,input.sourceBranchId); const target=await db.getGitBranch(project.id,input.targetBranchId); if(!repo||!source||!target) throw new TRPCError({code:"PRECONDITION_FAILED",message:"GitHub and both branches are required."}); const sourceCommits=await db.listGitCommits(project.id,source.id); if(!source.remoteSha || !sourceCommits.some(c=>c.remoteSha===source.remoteSha&&c.pushState==="pushed")) throw new TRPCError({code:"PRECONDITION_FAILED",message:"Push the source branch and verify its remote SHA before opening a GitHub PR."}); const remote=await githubProvider().createPullRequest({owner:repo.owner,name:repo.name,defaultBranch:repo.defaultBranch,url:repo.repositoryUrl},source.name,target.name,input.title,input.body); await db.appendProjectEvent({projectId:project.id,type:"github_pr_opened",message:`Opened GitHub PR #${remote.number}.`,metadataJson:JSON.stringify(remote)}); return remote; }),
    versionHistory: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const project = await ownedProject(ctx.user.id, input.projectId);
        const [current, snapshots] = await Promise.all([db.listProjectFiles(project.id), db.listProjectSnapshots(project.id)]);
        const currentFiles = current.map(file => ({ path: file.path, content: file.content }));
        return snapshots.map(snapshot => {
          let files: Array<{ path: string; content: string }> = [];
          try { files = JSON.parse(snapshot.filesJson) as Array<{ path: string; content: string }>; } catch { files = []; }
          return { id: snapshot.id, label: snapshot.label, reason: snapshot.reason, createdAt: snapshot.createdAt, ...summarizeVersion(files, currentFiles) };
        });
      }),
    compareVersion: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive(), snapshotId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const project = await ownedProject(ctx.user.id, input.projectId);
        const snapshot = await db.getProjectSnapshot(project.id, input.snapshotId);
        if (!snapshot) throw new TRPCError({ code: "NOT_FOUND", message: "Version snapshot not found" });
        const current = await db.listProjectFiles(project.id);
        let before: Array<{ path: string; content: string }> = [];
        try { before = JSON.parse(snapshot.filesJson) as Array<{ path: string; content: string }>; } catch { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Version snapshot is corrupted" }); }
        return { snapshot: { id: snapshot.id, label: snapshot.label, reason: snapshot.reason, createdAt: snapshot.createdAt }, ...summarizeVersion(before, current.map(file => ({ path: file.path, content: file.content }))) };
      }),
    reindexGraph: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const project = await ownedProject(ctx.user.id, input.projectId);
        const result = await indexProjectGraph(project.id, planFromProject(project.planJson), await db.listProjectFiles(project.id));
        await db.appendProjectEvent({ projectId: project.id, type: "graph_indexed", message: `Indexed ${result.nodes} project graph nodes and ${result.edges} relationships.` });
        return result;
      }),
    platformHealth: publicProcedure.query(() => platformServiceStatus()),
    audit: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const project = await ownedProject(ctx.user.id, input.projectId);
        const [files, snapshots, reviews, exports, graph, gitBranches, gitRepository] = await Promise.all([db.listProjectFiles(project.id), db.listProjectSnapshots(project.id), db.listCodeReviews(project.id), db.listProjectExports(project.id), db.getProjectGraph(project.id), db.listGitBranches(project.id), db.getGitRepository(project.id)]);
        return auditProject({ project, filePaths: files.map((file) => file.path), snapshotCount: snapshots.length, reviewCount: reviews.length, exportCount: exports.length, graphNodeCount: graph.nodes.length, gitBranchCount: gitBranches.length, gitRepositoryConnected: Boolean(gitRepository?.connected) });
      }),
    productionGate: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const project = await ownedProject(ctx.user.id, input.projectId);
        const [snapshots, testRuns, securityScans, previewRuntimes, artifacts] = await Promise.all([
          db.listProjectSnapshots(project.id), db.listTestRuns(project.id), db.listSecurityScans(project.id), db.listPreviewRuntimes(project.id), db.listBuildArtifacts(project.id),
        ]);
        return evaluateProductionGate({
          buildStatus: project.buildStatus,
          previewUrl: project.previewUrl,
          previewHealthStatus: previewRuntimes[0]?.healthStatus,
          testStatus: testRuns[0]?.status,
          securityStatus: securityScans[0]?.status,
          securityCritical: securityScans[0]?.critical,
          securityHigh: securityScans[0]?.high,
          snapshotCount: snapshots.length,
          artifactCount: artifacts.filter((artifact) => artifact.status === "ready").length,
        });
      }),
    validate: protectedProcedure
      .input(z.object({ projectId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const project = await ownedProject(ctx.user.id, input.projectId);
        const files = await db.listProjectFiles(project.id);
        const paths = new Set(files.map((file) => file.path));
        const errors: string[] = [];
        const warnings: string[] = [];
        for (const required of ["package.json", "README.md"]) if (!paths.has(required)) errors.push(`Missing required starter file: ${required}`);
        if (!files.length) errors.push("No generated files exist yet. Generate the workspace first.");
        if (!(paths.has("app/_layout.tsx") && paths.has("app/index.tsx") && (paths.has("app.json") || paths.has("app.config.ts")))) errors.push("Missing required Expo Router entry files: app/_layout.tsx, app/index.tsx, and app.json/app.config.ts");
        if (!paths.has(".env.example")) warnings.push("No .env.example file is present; environment contracts should be documented before deployment.");
        warnings.push("Validation checks workspace structure only. Build execution happens only through the isolated build service.");
        const status = errors.length ? "error" : "ready";
        await db.updateProjectStatus(project.id, { buildStatus: status === "ready" ? "structure_ready" : "build_error" });
        await db.appendProjectEvent({ projectId: project.id, type: "validation", message: status === "ready" ? "Workspace structure validation passed." : "Workspace structure validation found errors.", metadataJson: JSON.stringify({ errors, warnings }) });
        return { status, checkedFiles: files.length, errors, warnings };
      }),
    capabilityStatus: publicProcedure.query(() => ({
      livePreview: buildProviderStatus().configured && previewProviderStatus().configured ? "READY AFTER A PASSED BUILD" : "BLOCKED — build + preview infrastructure required",
      remoteBuild: buildProviderStatus().configured ? "READY" : "BLOCKED — build infrastructure required",
      buildEngines: { native: "PRIMARY — isolated native worker required", expo: "OPTIONAL — isolated Expo/EAS-compatible worker required", auto: "AUTO — prefers MINHAS Native" },
      previewRuntime: previewProviderStatus().configured ? "READY" : "BLOCKED — preview infrastructure required",
      artifactManagement: buildProviderStatus().configured ? "READY AFTER A CONFIRMED ARTIFACT" : "BLOCKED — build infrastructure required",
      autoFix: platformServiceStatus().ai.status === "ONLINE" && platformServiceStatus().database.status === "ONLINE" ? "LIVE — bounded task patches with restore points" : "BLOCKED — AI + database required",
      codeReview: platformServiceStatus().ai.status === "ONLINE" && platformServiceStatus().database.status === "ONLINE" ? "LIVE — server-side AI review" : "BLOCKED — AI + database required",
      codingAgent: platformServiceStatus().ai.status === "ONLINE" && platformServiceStatus().database.status === "ONLINE" ? "LIVE — conversational coding agent" : "BLOCKED — AI + database required",
      snapshots: platformServiceStatus().database.status === "ONLINE" ? "LIVE — persisted restore points" : "BLOCKED — database required",
      autonomousPipeline: platformServiceStatus().database.status === "ONLINE" ? "LIVE — persisted bounded pipeline; execution gates require real evidence" : "BLOCKED — database required",
      projectGraph: platformServiceStatus().database.status === "ONLINE" ? "LIVE — persisted nodes and relationships" : "BLOCKED — database required",
      exportZip: platformServiceStatus().artifact.status === "ONLINE" ? "LIVE — secure artifact-backed ZIP export" : "BLOCKED — artifact storage required",
      deploy: deployProviderStatus().configured ? "READY" : "BLOCKED — deployment infrastructure required",
      voiceInput: "BLOCKED — verified transcription service required",
      templates: "LIVE — curated mobile starter catalog",
      documentation: "LIVE — project README + platform documentation",
      gitVersionControl: platformServiceStatus().database.status === "ONLINE" ? "LIVE — branches, commits, diffs, three-way merge, protected branches" : "BLOCKED — database required",
      githubRemote: platformServiceStatus().github.status === "ONLINE" ? "READY — real GitHub API adapter" : "BLOCKED — GITHUB_TOKEN required",
    })),
  }),
});
export type AppRouter = typeof appRouter;
