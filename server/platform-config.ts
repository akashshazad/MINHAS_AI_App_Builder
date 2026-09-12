
export type ServiceName = "build" | "preview" | "deployment" | "artifact" | "ai" | "database" | "auth" | "github";

const trim = (value: string | undefined) => value?.replace(/\/+$/, "") || "";

export const PLATFORM_CONFIG = {
  buildUrl: trim(process.env.BUILD_SERVICE_URL || process.env.MINHAS_BUILD_SERVICE_URL),
  buildToken: process.env.BUILD_SERVICE_TOKEN || process.env.MINHAS_BUILD_SERVICE_TOKEN || "",
  previewUrl: trim(process.env.PREVIEW_SERVICE_URL || process.env.MINHAS_PREVIEW_SERVICE_URL),
  previewToken: process.env.PREVIEW_SERVICE_TOKEN || process.env.MINHAS_PREVIEW_SERVICE_TOKEN || "",
  deploymentUrl: trim(process.env.DEPLOYMENT_SERVICE_URL || process.env.MINHAS_DEPLOY_SERVICE_URL),
  deploymentToken: process.env.DEPLOYMENT_SERVICE_TOKEN || process.env.MINHAS_DEPLOY_SERVICE_TOKEN || "",
  artifactUrl: trim(process.env.MINHAS_ARTIFACT_STORAGE_URL || process.env.BUILT_IN_FORGE_API_URL),
  aiUrl: trim(process.env.AI_SERVICE_URL || process.env.BUILT_IN_FORGE_API_URL),
  databaseConfigured: Boolean(process.env.DATABASE_URL),
  authConfigured: Boolean(process.env.OAUTH_SERVER_URL && process.env.JWT_SECRET),
  githubApiUrl: trim(process.env.GITHUB_API_URL || "https://api.github.com"),
  githubToken: process.env.GITHUB_TOKEN || "",
  requestTimeoutMs: Math.max(3000, Number(process.env.MINHAS_PROVIDER_TIMEOUT_MS || 20000)),
} as const;

export function platformServiceStatus() {
  const status = (configured: boolean, reason: string) => ({ status: configured ? "ONLINE" as const : "OFFLINE" as const, configured, reason: configured ? null : reason });
  return {
    build: status(Boolean(PLATFORM_CONFIG.buildUrl && PLATFORM_CONFIG.buildToken), "BUILD_SERVICE_URL and BUILD_SERVICE_TOKEN are required"),
    preview: status(Boolean(PLATFORM_CONFIG.previewUrl && PLATFORM_CONFIG.previewToken), "PREVIEW_SERVICE_URL and PREVIEW_SERVICE_TOKEN are required"),
    deployment: status(Boolean(PLATFORM_CONFIG.deploymentUrl && PLATFORM_CONFIG.deploymentToken), "DEPLOYMENT_SERVICE_URL and DEPLOYMENT_SERVICE_TOKEN are required"),
    artifact: status(Boolean(PLATFORM_CONFIG.artifactUrl), "Artifact storage is not configured"),
    ai: status(Boolean(PLATFORM_CONFIG.aiUrl), "AI service is not configured"),
    database: status(PLATFORM_CONFIG.databaseConfigured, "DATABASE_URL is not configured"),
    auth: status(PLATFORM_CONFIG.authConfigured, "OAuth service or JWT secret is not configured"),
    github: status(Boolean(PLATFORM_CONFIG.githubToken), "GITHUB_TOKEN is not configured"),
  };
}


