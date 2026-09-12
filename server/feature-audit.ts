
import { buildProviderStatus, deployProviderStatus, previewProviderStatus } from "./providers";
import { PLATFORM_CONFIG } from "./platform-config";

export type AuditState = "LIVE" | "DEGRADED" | "BLOCKED";
export type AuditItem = { key: string; label: string; state: AuditState; evidence: string; nextAction?: string };

export function auditProject(input: {
  project: { status: string; planJson: string; buildStatus: string; previewUrl: string | null; deployStatus: string };
  filePaths: string[];
  snapshotCount: number;
  reviewCount: number;
  exportCount: number;
  graphNodeCount: number;
  gitBranchCount?: number;
  gitRepositoryConnected?: boolean;
}) {
  const paths = new Set(input.filePaths);
  const build = buildProviderStatus();
  const preview = previewProviderStatus();
  const deployment = deployProviderStatus();
  const items: AuditItem[] = [
    { key: "planning", label: "AI planning", state: input.project.planJson ? "LIVE" : "DEGRADED", evidence: input.project.planJson ? "Structured plan is persisted." : "No persisted plan.", nextAction: input.project.planJson ? undefined : "Run planning again." },
    { key: "workspace", label: "Editable workspace", state: input.filePaths.length ? "LIVE" : "DEGRADED", evidence: `${input.filePaths.length} persisted file(s).`, nextAction: input.filePaths.length ? undefined : "Generate the approved workspace." },
    { key: "validation", label: "Workspace validation", state: paths.has("package.json") && paths.has("README.md") ? "LIVE" : "DEGRADED", evidence: "Required starter-file check is available.", nextAction: paths.has("package.json") && paths.has("README.md") ? undefined : "Generate or restore package.json and README.md." },
    { key: "snapshots", label: "Snapshots / restore", state: input.snapshotCount ? "LIVE" : "DEGRADED", evidence: `${input.snapshotCount} persisted snapshot(s).`, nextAction: input.snapshotCount ? undefined : "Create a snapshot before risky edits." },
    { key: "ai-review", label: "AI review / bounded auto-fix", state: input.reviewCount ? "LIVE" : "DEGRADED", evidence: `${input.reviewCount} persisted review record(s).`, nextAction: input.reviewCount ? undefined : "Run a review after generating files." },
    { key: "graph", label: "Project graph", state: input.graphNodeCount ? "LIVE" : "DEGRADED", evidence: `${input.graphNodeCount} persisted graph node(s).`, nextAction: input.graphNodeCount ? undefined : "Re-index the project graph." },
    { key: "git", label: "Version control", state: input.gitBranchCount ? "LIVE" : "DEGRADED", evidence: `${input.gitBranchCount ?? 0} local branch(es); protected-branch and three-way merge controls are available.`, nextAction: input.gitBranchCount ? undefined : "Initialize version control or create a branch." },
    { key: "github", label: "GitHub remote", state: input.gitRepositoryConnected ? "LIVE" : "BLOCKED", evidence: input.gitRepositoryConnected ? "Repository connection is persisted." : "No GitHub repository is connected; remote operations remain unavailable.", nextAction: input.gitRepositoryConnected ? undefined : "Connect a GitHub repository with configured server credentials." },
    { key: "build", label: "Isolated build service", state: build.configured ? (input.project.buildStatus === "passed" ? "LIVE" : "DEGRADED") : "BLOCKED", evidence: build.configured ? `Provider configured; current build status is ${input.project.buildStatus}.` : build.reason || "Provider unavailable.", nextAction: build.configured ? "Run a build and inspect provider logs." : "Configure BUILD_SERVICE_URL and BUILD_SERVICE_TOKEN." },
    { key: "preview", label: "Preview runtime", state: preview.configured && input.project.previewUrl ? "LIVE" : "BLOCKED", evidence: input.project.previewUrl || (preview.reason || "No confirmed preview runtime."), nextAction: preview.configured ? "Pass a build, then start preview." : "Configure PREVIEW_SERVICE_URL and PREVIEW_SERVICE_TOKEN." },
    { key: "export", label: "ZIP export", state: PLATFORM_CONFIG.artifactUrl && input.exportCount ? "LIVE" : "DEGRADED", evidence: `${input.exportCount} export record(s); secrets are excluded by the exporter.`, nextAction: input.exportCount ? undefined : "Create a secure export after workspace generation." },
    { key: "deployment", label: "Deployment", state: deployment.configured && input.project.deployStatus === "live" ? "LIVE" : deployment.configured ? "DEGRADED" : "BLOCKED", evidence: deployment.configured ? `Provider configured; current deployment status is ${input.project.deployStatus}.` : deployment.reason || "Provider unavailable.", nextAction: deployment.configured ? "Deploy only after a confirmed passed build and verify health." : "Configure DEPLOYMENT_SERVICE_URL and DEPLOYMENT_SERVICE_TOKEN." },
  ];
  return { generatedAt: new Date().toISOString(), items, live: items.filter((item) => item.state === "LIVE").length, blocked: items.filter((item) => item.state === "BLOCKED").length, degraded: items.filter((item) => item.state === "DEGRADED").length };
}


