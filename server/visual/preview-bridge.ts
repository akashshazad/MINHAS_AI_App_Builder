
/** MINHAS AI Builder v2.4 — validated preview-runtime telemetry boundary. */
import crypto from "node:crypto";

export type PreviewTelemetry = {
  sessionId: string;
  projectId: string;
  runtimeVersion: string;
  platform: "android" | "ios";
  componentId: string;
  route: string;
  sourceFile: string;
  sourceLine: number;
  sourceColumn?: number;
  bounds?: { x: number; y: number; width: number; height: number };
  observedAt: string;
};

const SAFE_SOURCE = /^(?!.*(?:^|[\\/])(?:\.git|node_modules|\.env)(?:[\\/]|$))[A-Za-z0-9._/@+\\-]+$/;

export function validatePreviewTelemetry(input: unknown): PreviewTelemetry {
  if (!input || typeof input !== "object") throw new Error("Invalid preview telemetry");
  const value = input as Partial<PreviewTelemetry>;
  if (!value.sessionId || !value.projectId || !value.runtimeVersion || !value.componentId || !value.route || !value.sourceFile || !value.observedAt) throw new Error("Incomplete preview telemetry");
  if (!(value.platform === "android" || value.platform === "ios")) throw new Error("Invalid platform");
  if (!SAFE_SOURCE.test(value.sourceFile)) throw new Error("Unsafe source mapping");
  const sourceLine = value.sourceLine;
  if (typeof sourceLine !== "number" || !Number.isInteger(sourceLine) || sourceLine < 1) throw new Error("Invalid source line");
  if (value.bounds) {
    const numbers = [value.bounds.x, value.bounds.y, value.bounds.width, value.bounds.height];
    if (!numbers.every(Number.isFinite) || value.bounds.width < 0 || value.bounds.height < 0) throw new Error("Invalid component bounds");
  }
  if (Number.isNaN(Date.parse(value.observedAt))) throw new Error("Invalid observedAt");
  return value as PreviewTelemetry;
}

export function telemetryFingerprint(telemetry: PreviewTelemetry) {
  return crypto.createHash("sha256").update(JSON.stringify(telemetry)).digest("hex");
}


