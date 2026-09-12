
import * as db from "./db";
import { generateStarterFiles } from "./ai";
import { pollIsolatedBuild, queueIsolatedBuild } from "./providers";
import { snapshotProject } from "./orchestrator-snapshot";
import type { ProjectFile } from "../drizzle/schema";
import type { ProjectPlan } from "../shared/types";

export const AGENT_MANIFEST = [
  { key: "product_manager", name: "Product Manager Agent", role: "Turn intent into requirements and acceptance criteria.", tools: ["llm"], files: ["plan.json"], timeoutSeconds: 120, tokenBudget: 6000 },
  { key: "architecture", name: "Architecture Agent", role: "Create a typed technical architecture and dependency impact map.", tools: ["llm", "project_graph"], files: ["plan.json", "graph"], timeoutSeconds: 180, tokenBudget: 8000 },
  { key: "coding", name: "Coding Agent", role: "Generate and edit approved project files without arbitrary execution.", tools: ["llm", "files", "snapshots"], files: ["approved project files"], timeoutSeconds: 300, tokenBudget: 12000 },
  { key: "testing", name: "Testing Agent", role: "Interpret isolated test output and propose minimal fixes.", tools: ["llm", "isolated_test_service"], files: ["test files", "error logs"], timeoutSeconds: 300, tokenBudget: 8000 },
  { key: "security", name: "Security Agent", role: "Review static findings and block critical deployment risks.", tools: ["static_scan", "llm"], files: ["source files", "dependency manifests"], timeoutSeconds: 180, tokenBudget: 7000 },
  { key: "debugger", name: "Debugger Agent", role: "Apply bounded error-to-root-cause-to-patch loops, max five attempts.", tools: ["llm", "snapshots", "isolated_build_service"], files: ["affected files"], timeoutSeconds: 300, tokenBudget: 10000 },
  { key: "devops", name: "DevOps Agent", role: "Prepare artifacts and deployment handoff after all gates pass.", tools: ["isolated_build_service", "deployment_service"], files: ["deployment manifests", "artifacts"], timeoutSeconds: 300, tokenBudget: 7000 },
] as const;

export const PIPELINE_STEPS = ["requirements", "workspace", "graph", "build", "tests", "security", "preview", "deploy"] as const;

function nodeKey(type: string, value: string) { return `${type}:${value}`; }

export async function seedAgentManifest() {
  // The manifest is code-owned policy; the table is intentionally not auto-seeded here so
  // a deployment can seed it transactionally or through an admin migration later.
  return AGENT_MANIFEST;
}

export async function indexProjectGraph(projectId: number, plan: ProjectPlan, files: ProjectFile[]) {
  const nodes = [
    { projectId, nodeKey: nodeKey("project", String(projectId)), nodeType: "project", label: plan.projectName, metadataJson: JSON.stringify({ framework: plan.framework }) },
    ...files.map((file) => ({ projectId, nodeKey: nodeKey("file", file.path), nodeType: "file", label: file.path, metadataJson: JSON.stringify({ language: file.language, version: file.version }) })),
    ...plan.pages.map((page) => ({ projectId, nodeKey: nodeKey("screen", page), nodeType: "screen", label: page, metadataJson: null })),
    ...plan.database.map((entity) => ({ projectId, nodeKey: nodeKey("data", entity), nodeType: "database", label: entity, metadataJson: null })),
    ...plan.apis.map((api) => ({ projectId, nodeKey: nodeKey("api", api), nodeType: "api", label: api, metadataJson: null })),
  ];
  const root = nodeKey("project", String(projectId));
  const edges = nodes.filter((node) => node.nodeKey !== root).map((node) => ({ projectId, fromNodeKey: root, toNodeKey: node.nodeKey, relation: "contains" }));
  await db.replaceProjectGraph(projectId, nodes, edges);
  return { nodes: nodes.length, edges: edges.length };
}

export function staticSecurityFindings(files: ProjectFile[]) {
  const findings: Array<{ path: string; severity: "critical" | "high" | "medium"; rule: string; message: string }> = [];
  for (const file of files) {
    if (/\beval\s*\(/.test(file.content) || /new Function\s*\(/.test(file.content)) findings.push({ path: file.path, severity: "critical", rule: "no-dynamic-code", message: "Dynamic code execution pattern detected." });
    if (/(AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]+ PRIVATE KEY-----)/.test(file.content)) findings.push({ path: file.path, severity: "critical", rule: "no-hardcoded-secret", message: "Possible hard-coded secret detected." });
    if (/\.\.[\\/]/.test(file.content) && /path|file|upload|download/i.test(file.content)) findings.push({ path: file.path, severity: "high", rule: "path-traversal", message: "Path traversal risk pattern requires review." });
  }
  return findings;
}

async function createRun(projectId: number) {
  const pipelineRunId = await db.createPipelineRun({ projectId, status: "queued", maxRetries: 5, currentStep: PIPELINE_STEPS[0] });
  await db.createPipelineSteps(PIPELINE_STEPS.map((stepKey, ordinal) => ({ pipelineRunId, stepKey, ordinal, status: "queued", attempts: 0 })));
  await db.appendProjectEvent({ projectId, type: "autonomous_run_created", message: "Autonomous pipeline created with bounded retries and persisted step state." });
  return pipelineRunId;
}

export async function startAutonomousRun(project: { id: number; name: string; framework: string; planJson: string }) {
  const runId = await createRun(project.id);
  const plan = JSON.parse(project.planJson) as ProjectPlan;
  let files = await db.listProjectFiles(project.id);
  if (!files.length) {
    const generated = await generateStarterFiles(plan);
    await db.insertProjectFiles(generated.map((file) => ({ ...file, projectId: project.id })));
    files = await db.listProjectFiles(project.id);
    await snapshotProject(project.id, "Before autonomous workspace generation", "autonomous_generation", project.planJson, []);
  }
  const graph = await indexProjectGraph(project.id, plan, files);
  const run = await db.getPipelineRun(project.id, runId);
  const graphStep = run?.steps.find((step) => step.stepKey === "graph");
  if (graphStep) await db.updatePipelineStep(graphStep.id, { status: "passed", attempts: 1, outputJson: JSON.stringify(graph), startedAt: new Date(), finishedAt: new Date() });
  const workspaceStep = run?.steps.find((step) => step.stepKey === "workspace");
  if (workspaceStep) await db.updatePipelineStep(workspaceStep.id, { status: "passed", attempts: 1, outputJson: JSON.stringify({ files: files.length }), startedAt: new Date(), finishedAt: new Date() });
  const requirementsStep = run?.steps.find((step) => step.stepKey === "requirements");
  if (requirementsStep) await db.updatePipelineStep(requirementsStep.id, { status: "passed", attempts: 1, outputJson: JSON.stringify({ plan: "persisted" }), startedAt: new Date(), finishedAt: new Date() });
  await db.updatePipelineRun(runId, { status: "running", currentStep: "build" });
  return advanceAutonomousRun(project, runId);
}

export async function advanceAutonomousRun(project: { id: number; name: string; framework: string }, runId: number) {
  const run = await db.getPipelineRun(project.id, runId);
  if (!run) throw new Error("Pipeline run not found");
  const files = await db.listProjectFiles(project.id);
  const current = run.steps.find((step) => ["queued", "running", "blocked"].includes(step.status) && !["requirements", "workspace", "graph"].includes(step.stepKey));
  if (!current) return run;

  if (current.stepKey === "build") {
    if (current.status === "queued" && current.outputJson) {
      const queued = JSON.parse(current.outputJson) as { externalJobId?: string; buildJobId?: number };
      if (!queued.externalJobId) throw new Error("Build step has no external job ID.");
      const result = await pollIsolatedBuild(queued.externalJobId);
      if (queued.buildJobId) await db.updateBuildJob(queued.buildJobId, { status: result.status, externalJobId: queued.externalJobId, logs: result.logs, error: result.error, previewUrl: result.previewUrl });
      await db.updatePipelineStep(current.id, { status: result.terminal ? (result.status === "passed" ? "passed" : "failed") : "queued", attempts: current.attempts, outputJson: JSON.stringify(result), error: result.error, finishedAt: result.terminal ? new Date() : undefined });
      if (!result.terminal) return db.getPipelineRun(project.id, runId);
      if (result.status !== "passed") { await db.updatePipelineRun(runId, { status: "failed", currentStep: "build", error: result.error || "Isolated build failed." }); return db.getPipelineRun(project.id, runId); }
      if (result.artifact && queued.buildJobId) await db.createBuildArtifact({ projectId: project.id, buildJobId: queued.buildJobId, status: "ready", artifactType: result.artifact.type, fileName: result.artifact.fileName, storageKey: result.artifact.storageKey, sha256: result.artifact.sha256, byteSize: result.artifact.byteSize, versionName: result.artifact.versionName, versionCode: result.artifact.versionCode, packageName: result.artifact.packageName });
      await db.updateProjectStatus(project.id, { buildStatus: "passed", previewUrl: null });
      await db.updatePipelineRun(runId, { status: "running", currentStep: "tests", error: undefined });
      return db.getPipelineRun(project.id, runId);
    }
    await db.updatePipelineStep(current.id, { status: "running", attempts: current.attempts + 1, startedAt: new Date() });
    try {
      const buildJobId = await db.createBuildJob({ projectId: project.id, provider: "isolated-build-service", status: "queued", logs: "Autonomous Android release build requested through isolated runtime." });
      const result = await queueIsolatedBuild({ projectId: project.id, projectName: project.name, framework: "Expo + React Native + TypeScript", files, buildType: "android-release" });
      if (!result.configured) { await db.updateBuildJob(buildJobId, { status: "not_configured", error: result.error, logs: result.error }); await db.updatePipelineStep(current.id, { status: "blocked", error: result.error, finishedAt: new Date(), outputJson: JSON.stringify(result) }); await db.updatePipelineRun(runId, { status: "blocked", currentStep: "build", error: result.error }); return db.getPipelineRun(project.id, runId); }
      await db.updateBuildJob(buildJobId, { status: result.status, externalJobId: "externalJobId" in result ? result.externalJobId : undefined, logs: "logs" in result ? result.logs : undefined, error: "error" in result ? result.error : undefined, previewUrl: "previewUrl" in result ? result.previewUrl : undefined });
      await db.updatePipelineStep(current.id, { status: result.status === "passed" ? "passed" : "queued", outputJson: JSON.stringify({ ...result, buildJobId }), finishedAt: result.status === "passed" ? new Date() : undefined });
      return db.getPipelineRun(project.id, runId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Isolated build request failed";
      await db.updatePipelineStep(current.id, { status: "failed", error: message, finishedAt: new Date() });
      await db.updatePipelineRun(runId, { status: "failed", currentStep: "build", error: message });
      return db.getPipelineRun(project.id, runId);
    }
  }

  if (current.stepKey === "tests") {
    if (current.status === "queued" && current.outputJson) {
      const state = JSON.parse(current.outputJson) as { externalJobId?: string; testRunId?: number; buildJobId?: number };
      if (!state.externalJobId || !state.testRunId) throw new Error("Test step has no external job ID or test run ID.");
      const result = await pollIsolatedBuild(state.externalJobId);
      if (state.buildJobId) await db.updateBuildJob(state.buildJobId, { status: result.status, externalJobId: state.externalJobId, logs: result.logs, error: result.error, previewUrl: result.previewUrl });
      const passed = result.status === "passed";
      await db.updateTestRun(state.testRunId, { status: result.terminal ? (passed ? "passed" : "failed") : "running", passed: passed ? 1 : 0, failed: result.terminal && !passed ? 1 : 0, logs: result.logs || result.error });
      await db.updatePipelineStep(current.id, { status: result.terminal ? (passed ? "passed" : "failed") : "queued", outputJson: JSON.stringify({ ...result, testRunId: state.testRunId }), error: result.error, finishedAt: result.terminal ? new Date() : undefined });
      if (!result.terminal) return db.getPipelineRun(project.id, runId);
      await db.updatePipelineRun(runId, { status: passed ? "running" : "failed", currentStep: passed ? "security" : "tests", error: passed ? undefined : (result.error || "Isolated tests failed.") });
      return db.getPipelineRun(project.id, runId);
    }
    await db.updatePipelineStep(current.id, { status: "running", attempts: current.attempts + 1, startedAt: new Date() });
    try {
      const buildJobId = await db.createBuildJob({ projectId: project.id, provider: "isolated-build-test-runtime", status: "queued", logs: "Autonomous isolated test runtime requested." });
      const result = await queueIsolatedBuild({ projectId: project.id, projectName: project.name, framework: "Expo + React Native + TypeScript", files, buildType: "test" });
      if (!result.configured) { await db.updateBuildJob(buildJobId, { status: "not_configured", error: result.error, logs: result.error }); await db.updatePipelineStep(current.id, { status: "blocked", error: result.error, finishedAt: new Date(), outputJson: JSON.stringify(result) }); await db.updatePipelineRun(runId, { status: "blocked", currentStep: "tests", error: result.error }); return db.getPipelineRun(project.id, runId); }
      await db.updateBuildJob(buildJobId, { status: result.status, externalJobId: "externalJobId" in result ? result.externalJobId : undefined, logs: "logs" in result ? result.logs : undefined, error: "error" in result ? result.error : undefined, previewUrl: "previewUrl" in result ? result.previewUrl : undefined });
      const testRunId = await db.createTestRun({ projectId: project.id, pipelineRunId: runId, provider: "isolated-build-test-runtime", status: result.status === "passed" ? "passed" : "queued", passed: result.status === "passed" ? 1 : 0, failed: 0, logs: result.logs });
      await db.updatePipelineStep(current.id, { status: result.status === "passed" ? "passed" : "queued", outputJson: JSON.stringify({ ...result, testRunId, buildJobId }), finishedAt: result.status === "passed" ? new Date() : undefined });
      await db.updatePipelineRun(runId, { status: "running", currentStep: result.status === "passed" ? "security" : "tests" });
      return db.getPipelineRun(project.id, runId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Isolated test request failed";
      await db.updatePipelineStep(current.id, { status: "failed", error: message, finishedAt: new Date() });
      await db.updatePipelineRun(runId, { status: "failed", currentStep: "tests", error: message });
      return db.getPipelineRun(project.id, runId);
    }
  }

  if (current.stepKey === "security") {
    const findings = staticSecurityFindings(files);
    const critical = findings.filter((item) => item.severity === "critical").length;
    const high = findings.filter((item) => item.severity === "high").length;
    await db.createSecurityScan({ projectId: project.id, pipelineRunId: runId, status: critical || high ? "failed" : "passed", critical, high, findingsJson: JSON.stringify(findings) });
    await db.updatePipelineStep(current.id, { status: critical || high ? "failed" : "passed", attempts: current.attempts + 1, outputJson: JSON.stringify({ critical, high, findings }), finishedAt: new Date() });
    await db.updatePipelineRun(runId, { status: critical || high ? "failed" : "running", currentStep: critical || high ? "security" : "preview", error: critical || high ? "High or critical security findings block deployment." : undefined });
    return db.getPipelineRun(project.id, runId);
  }

  const message = `${current.stepKey} requires its upstream verified gate and provider evidence; no success is claimed automatically.`;
  await db.updatePipelineStep(current.id, { status: "blocked", attempts: current.attempts + 1, error: message, finishedAt: new Date() });
  await db.updatePipelineRun(runId, { status: "blocked", currentStep: current.stepKey, error: message });
  return db.getPipelineRun(project.id, runId);
}


