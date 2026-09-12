
import type { ProjectFile } from "../drizzle/schema";
import { PLATFORM_CONFIG } from "./platform-config";
import { resolveBuildEngine, type BuildEngineSelection } from "./build-engine";

const TERMINAL_BUILD_STATES = new Set(["success", "passed", "failed", "cancelled", "not_configured"]);
const TERMINAL_DEPLOY_STATES = new Set(["live", "failed", "cancelled", "not_configured"]);
export function normalizeBuildStatus(value: string) { const status = value.toLowerCase(); return status === "success" || status === "succeeded" ? "passed" : status === "error" || status === "failure" ? "failed" : status; }
export function normalizeDeploymentStatus(value: string) { const status = value.toLowerCase(); return status === "success" || status === "succeeded" || status === "deployed" ? "live" : status === "error" || status === "failure" ? "failed" : status; }
function headers(token?: string) { return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }; }
async function request(baseUrl: string, token: string | undefined, path: string, init: RequestInit = {}) {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), PLATFORM_CONFIG.requestTimeoutMs);
  try {
    const response = await fetch(`${baseUrl}${path}`, { ...init, headers: { ...headers(token), ...(init.headers || {}) }, signal: controller.signal });
    const text = await response.text(); let data: any = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
    if (!response.ok) throw new Error(data.error || data.message || `Provider request failed (${response.status})`);
    return data;
  } finally { clearTimeout(timer); }
}
async function providerPost(baseUrl: string, token: string | undefined, path: string, body: unknown) { return request(baseUrl, token, path, { method: "POST", body: JSON.stringify(body) }); }
async function providerGet(baseUrl: string, token: string | undefined, path: string) { return request(baseUrl, token, path); }
function filesPayload(files: ProjectFile[]) { return files.map((file) => ({ path: file.path, language: file.language, content: file.content })); }

export function buildProviderStatus() { return { configured: Boolean(PLATFORM_CONFIG.buildUrl && PLATFORM_CONFIG.buildToken), provider: "isolated-build-service", reason: PLATFORM_CONFIG.buildUrl && PLATFORM_CONFIG.buildToken ? null : "BUILD_SERVICE_URL and BUILD_SERVICE_TOKEN are required" }; }
export async function queueIsolatedBuild(input: { projectId: number; projectName: string; framework: string; files: ProjectFile[]; buildType?: "web" | "android-debug" | "android-release" | "aab" | "test"; engine?: BuildEngineSelection }) {
  if (!PLATFORM_CONFIG.buildUrl || !PLATFORM_CONFIG.buildToken) return { configured: false as const, status: "not_configured", error: "Build service unavailable. Generated code was not executed." };
  const engine = resolveBuildEngine(input.engine || "auto", input.framework, input.files.map((file) => file.path));
  const data = await providerPost(PLATFORM_CONFIG.buildUrl, PLATFORM_CONFIG.buildToken, "/v1/builds", { projectId: input.projectId, projectName: input.projectName, framework: input.framework, engine, buildType: input.buildType || "android-release", files: filesPayload(input.files), sandbox: { nonRoot: true, readOnlyBase: true, network: "deny-by-default", cpuLimit: "1", memoryLimitMb: 512, processLimit: 64, timeoutSeconds: 900, cleanup: "always" } });
  const externalJobId = String(data.id || data.jobId || "");
  if (!externalJobId) return { configured: true as const, status: "failed", error: "Build service returned no build ID." };
  return { configured: true as const, status: normalizeBuildStatus(String(data.status || "queued")), engine, externalJobId, logs: String(data.logs || ""), previewUrl: data.previewUrl ? String(data.previewUrl) : undefined };
}
export async function pollIsolatedBuild(externalJobId: string) {
  if (!PLATFORM_CONFIG.buildUrl || !PLATFORM_CONFIG.buildToken) return { configured: false as const, status: "not_configured" };
  const data = await providerGet(PLATFORM_CONFIG.buildUrl, PLATFORM_CONFIG.buildToken, `/v1/builds/${encodeURIComponent(externalJobId)}`); const status = normalizeBuildStatus(String(data.status || "queued"));
  return { configured: true as const, status, terminal: TERMINAL_BUILD_STATES.has(status), logs: String(data.logs || ""), error: data.error ? String(data.error) : undefined, previewUrl: data.previewUrl ? String(data.previewUrl) : undefined, artifact: data.artifact ? { type: String(data.artifact.type || "android-release"), fileName: String(data.artifact.fileName || "artifact"), storageKey: data.artifact.storageKey ? String(data.artifact.storageKey) : undefined, sha256: data.artifact.sha256 ? String(data.artifact.sha256) : undefined, byteSize: Number(data.artifact.byteSize || 0) || undefined, versionName: data.artifact.versionName ? String(data.artifact.versionName) : undefined, versionCode: Number(data.artifact.versionCode || 0) || undefined, packageName: data.artifact.packageName ? String(data.artifact.packageName) : undefined } : undefined };
}
export function previewProviderStatus() { return { configured: Boolean(PLATFORM_CONFIG.previewUrl && PLATFORM_CONFIG.previewToken), provider: "isolated-preview-service", reason: PLATFORM_CONFIG.previewUrl && PLATFORM_CONFIG.previewToken ? null : "PREVIEW_SERVICE_URL and PREVIEW_SERVICE_TOKEN are required" }; }
export async function startPreview(input: { projectId: number; buildExternalJobId: string; previewUrl?: string }) {
  if (input.previewUrl) {
    const health = await healthCheckUrl(input.previewUrl);
    if (health.status !== "healthy") return { configured: true as const, status: "failed", externalRuntimeId: input.buildExternalJobId, previewUrl: input.previewUrl, healthStatus: health.status, error: "Build provider supplied a preview URL, but the URL did not pass the health check." };
    return { configured: true as const, status: "live", externalRuntimeId: input.buildExternalJobId, previewUrl: input.previewUrl, healthStatus: "healthy" as const };
  }
  if (!PLATFORM_CONFIG.previewUrl || !PLATFORM_CONFIG.previewToken) return { configured: false as const, status: "not_configured", error: "Preview service unavailable. No live runtime was claimed." };
  const data = await providerPost(PLATFORM_CONFIG.previewUrl, PLATFORM_CONFIG.previewToken, "/v1/previews", { projectId: input.projectId, buildId: input.buildExternalJobId }); const externalRuntimeId = String(data.id || data.runtimeId || "");
  if (!externalRuntimeId) return { configured: true as const, status: "failed", error: "Preview service returned no runtime ID." };
  return { configured: true as const, status: String(data.status || "starting"), externalRuntimeId, previewUrl: data.previewUrl ? String(data.previewUrl) : undefined, healthStatus: String(data.healthStatus || "unknown") };
}
export async function pollPreview(externalRuntimeId: string) {
  if (!PLATFORM_CONFIG.previewUrl || !PLATFORM_CONFIG.previewToken) return { configured: false as const, status: "not_configured" };
  const data = await providerGet(PLATFORM_CONFIG.previewUrl, PLATFORM_CONFIG.previewToken, `/v1/previews/${encodeURIComponent(externalRuntimeId)}`);
  return { configured: true as const, status: String(data.status || "starting"), previewUrl: data.previewUrl ? String(data.previewUrl) : undefined, healthStatus: String(data.healthStatus || "unknown"), consoleLogs: String(data.consoleLogs || ""), networkLogs: String(data.networkLogs || ""), error: data.error ? String(data.error) : undefined };
}
function isPrivateIpv4(host: string) {
  const parts = host.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  return a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

function isUnsafeHealthUrl(value: string) {
  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return true;
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host === "::1" || host === "0.0.0.0" || host === "[::1]" || isPrivateIpv4(host)) return true;
    return false;
  } catch { return true; }
}

export async function healthCheckUrl(url: string) {
  if (isUnsafeHealthUrl(url)) return { status: "blocked" as const, error: "Health-check URL is not an allowed public HTTP(S) URL." };
  try {
    const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(Math.min(10000, PLATFORM_CONFIG.requestTimeoutMs)) });
    return { status: response.ok ? "healthy" as const : "unhealthy" as const, httpStatus: response.status };
  } catch (error) { return { status: "unreachable" as const, error: error instanceof Error ? error.message : "Health check failed" }; }
}
export function deployProviderStatus() { return { configured: Boolean(PLATFORM_CONFIG.deploymentUrl && PLATFORM_CONFIG.deploymentToken), provider: "deployment-service", reason: PLATFORM_CONFIG.deploymentUrl && PLATFORM_CONFIG.deploymentToken ? null : "DEPLOYMENT_SERVICE_URL and DEPLOYMENT_SERVICE_TOKEN are required" }; }
export async function queueDeployment(input: { projectId: number; projectName: string; framework: string; files: ProjectFile[]; provider: string; buildArtifactId?: number }) {
  if (!PLATFORM_CONFIG.deploymentUrl || !PLATFORM_CONFIG.deploymentToken) return { configured: false as const, status: "not_configured", error: "Deployment service unavailable. No deployment was attempted." };
  const data = await providerPost(PLATFORM_CONFIG.deploymentUrl, PLATFORM_CONFIG.deploymentToken, "/v1/deployments", { projectId: input.projectId, projectName: input.projectName, framework: input.framework, provider: input.provider, buildArtifactId: input.buildArtifactId, files: filesPayload(input.files) }); const externalDeploymentId = String(data.id || data.deploymentId || "");
  if (!externalDeploymentId) return { configured: true as const, status: "failed", error: "Deployment service returned no deployment ID." };
  return { configured: true as const, status: normalizeDeploymentStatus(String(data.status || "queued")), externalDeploymentId, targetUrl: data.targetUrl ? String(data.targetUrl) : undefined, logs: String(data.logs || "") };
}
export async function pollDeployment(externalDeploymentId: string) {
  if (!PLATFORM_CONFIG.deploymentUrl || !PLATFORM_CONFIG.deploymentToken) return { configured: false as const, status: "not_configured" };
  const data = await providerGet(PLATFORM_CONFIG.deploymentUrl, PLATFORM_CONFIG.deploymentToken, `/v1/deployments/${encodeURIComponent(externalDeploymentId)}`); const status = normalizeDeploymentStatus(String(data.status || "queued"));
  return { configured: true as const, status, terminal: TERMINAL_DEPLOY_STATES.has(status), error: data.error ? String(data.error) : undefined, targetUrl: data.targetUrl ? String(data.targetUrl) : undefined, logs: String(data.logs || "") };
}


