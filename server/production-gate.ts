
import { PLATFORM_CONFIG } from "./platform-config";

export type GateState = "PASS" | "BLOCKED";
export type GateCheck = { key: string; label: string; state: GateState; evidence: string };

export function getExactRedirectAllowlist() {
  return [...new Set([
    ...(process.env.OAUTH_ALLOWED_REDIRECT_URIS ?? "").split(","),
    process.env.OAUTH_NATIVE_REDIRECT_URI ?? "",
  ].map((value) => value.trim().replace(/\/$/, "")).filter((value) => value && !value.includes("*")))];
}

export function evaluateProductionGate(input: {
  buildStatus: string;
  previewUrl: string | null;
  previewHealthStatus?: string;
  testStatus?: string;
  securityStatus?: string;
  securityCritical?: number;
  securityHigh?: number;
  snapshotCount: number;
  artifactCount: number;
}) {
  const redirectAllowlist = getExactRedirectAllowlist();
  const checks: GateCheck[] = [
    { key: "build", label: "Build", state: input.buildStatus === "passed" ? "PASS" : "BLOCKED", evidence: `Build status: ${input.buildStatus}.` },
    { key: "tests", label: "Tests", state: input.testStatus === "passed" ? "PASS" : "BLOCKED", evidence: input.testStatus ? `Latest test status: ${input.testStatus}.` : "No persisted passing test run." },
    { key: "security", label: "Security", state: input.securityStatus === "passed" && (input.securityCritical ?? 1) === 0 && (input.securityHigh ?? 1) === 0 ? "PASS" : "BLOCKED", evidence: input.securityStatus ? `Latest security status: ${input.securityStatus}; critical=${input.securityCritical ?? 0}, high=${input.securityHigh ?? 0}.` : "No persisted passing security scan." },
    { key: "preview", label: "Preview", state: Boolean(PLATFORM_CONFIG.previewUrl && PLATFORM_CONFIG.previewToken && input.previewUrl && input.previewHealthStatus === "healthy") ? "PASS" : "BLOCKED", evidence: input.previewUrl ? `Preview URL exists; health=${input.previewHealthStatus ?? "unknown"}.` : "No confirmed live preview URL." },
    { key: "auth", label: "Auth / exact OAuth redirects", state: PLATFORM_CONFIG.authConfigured && redirectAllowlist.length > 0 ? "PASS" : "BLOCKED", evidence: redirectAllowlist.length > 0 ? "Exact redirect allowlist is configured." : "OAUTH_ALLOWED_REDIRECT_URIS or OAUTH_NATIVE_REDIRECT_URI is missing." },
    { key: "database", label: "Database", state: PLATFORM_CONFIG.databaseConfigured ? "PASS" : "BLOCKED", evidence: PLATFORM_CONFIG.databaseConfigured ? "Database is configured." : "DATABASE_URL is missing." },
    { key: "restore-point", label: "Restore point", state: input.snapshotCount > 0 ? "PASS" : "BLOCKED", evidence: input.snapshotCount > 0 ? "At least one restore point exists." : "No restore point exists." },
    { key: "artifact", label: "Build artifact", state: input.artifactCount > 0 ? "PASS" : "BLOCKED", evidence: input.artifactCount > 0 ? "A confirmed build artifact exists." : "No confirmed build artifact exists." },
  ];
  const blocked = checks.filter((check) => check.state === "BLOCKED");
  return { status: blocked.length ? "BLOCKED" as const : "PASS" as const, checks, blocked: blocked.length, generatedAt: new Date().toISOString() };
}


