
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { createNativeBuildPlan } from "./commands";
import type { NativeWorkerRequest } from "./contract";
import type { NativeBuildPlan } from "./commands";
import { materializeWorkspace } from "./sandbox";
import { loadSigningProfileFromEnvironment, withEphemeralSigningMaterial } from "../native-build-service/signing";

const ALLOWED_BINARIES = new Set(["npx", "pnpm", "./gradlew", "gradlew.bat"]);

function run(command: string[], cwd: string, timeoutMs: number, signal?: AbortSignal, extraEnv: Record<string,string> = {}) {
  if (!ALLOWED_BINARIES.has(command[0])) throw new Error(`Worker command is not allowlisted: ${command[0]}`);
  return new Promise<{ code: number; output: string }>((resolve, reject) => {
    const child = spawn(command[0], command.slice(1), { cwd, shell: false, env: { ...process.env, CI: "1", npm_config_audit: "false", npm_config_fund: "false", ...extraEnv }, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    const append = (chunk: Buffer) => { output += chunk.toString("utf8"); if (output.length > 500_000) output = output.slice(-500_000); };
    child.stdout.on("data", append); child.stderr.on("data", append);
    const abort = () => { child.kill("SIGKILL"); reject(new Error("Build cancelled.")); };
    if (signal?.aborted) return abort();
    signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => { child.kill("SIGKILL"); reject(new Error(`Command timed out: ${command.join(" ")}`)); }, timeoutMs);
    child.on("error", (error) => { clearTimeout(timer); signal?.removeEventListener("abort", abort); reject(error); });
    child.on("exit", (code) => { clearTimeout(timer); signal?.removeEventListener("abort", abort); resolve({ code: code ?? 1, output }); });
  });
}

export async function runNativeBuild(request: NativeWorkerRequest, workspaceRoot: string, onArtifact?: (path: string, fileName: string, jobId: string) => Promise<{ storageKey?: string }>, isCancelled?: () => boolean, signal?: AbortSignal, requestedJobId?: string) {
  const jobId = requestedJobId && /^[a-f0-9-]{36}$/.test(requestedJobId) ? requestedJobId : crypto.randomUUID();
  await fs.mkdir(workspaceRoot, { recursive: true });
  const root = path.join(workspaceRoot, jobId);
  await fs.mkdir(root, { recursive: true });
  try {
    await materializeWorkspace(request, root);
    const signingProfile = request.signingProfileId ? loadSigningProfileFromEnvironment(request.signingProfileId) : null;
    if (request.signingProfileId && !signingProfile) throw new Error(`Android signing profile '${request.signingProfileId}' is not configured.`);
    const build = async (buildEnv: Record<string,string> = {}): Promise<{ plan: NativeBuildPlan; logs: string[] } | { id: string; status: "cancelled" | "failed"; engine: "native"; logs: string; error: string }> => {
      const plan = await createNativeBuildPlan(root, request.buildType);
      const logs: string[] = [];
      for (const command of plan.commands) {
        if (isCancelled?.()) return { id: jobId, status: "cancelled", engine: "native", logs: logs.join("\n"), error: "Build cancelled." };
        const result = await run(command, root, request.sandbox.timeoutSeconds * 1000, signal, buildEnv);
        logs.push(`$ ${command.join(" ")}\n${result.output}`);
        if (result.code !== 0) return { id: jobId, status: "failed", engine: "native", logs: logs.join("\n"), error: `Command failed with exit code ${result.code}.` };
      }
      return { plan, logs };
    };
    const outcome = signingProfile && request.buildType !== "android-debug" && request.buildType !== "test"
      ? await withEphemeralSigningMaterial(signingProfile, async ({ gradleUserHome }) => build({ GRADLE_USER_HOME: gradleUserHome }))
      : await build();
    if ("status" in outcome) return outcome;
    const plan = outcome.plan;
    const logs = outcome.logs;
    if (isCancelled?.()) return { id: jobId, status: "cancelled" as const, engine: "native" as const, logs: logs.join("\n"), error: "Build cancelled." };
    const artifactPath = path.join(root, plan.artifactRelativePath);
    const artifact = await fs.readFile(artifactPath);
    const sha256 = crypto.createHash("sha256").update(artifact).digest("hex");
    let storageKey: string | undefined;
    const artifactRoot = process.env.NATIVE_ARTIFACT_ROOT;
    if (artifactRoot && !onArtifact) {
      const fileName = path.basename(artifactPath);
      const destinationDir = path.join(artifactRoot, jobId);
      await fs.mkdir(destinationDir, { recursive: true });
      await fs.copyFile(artifactPath, path.join(destinationDir, fileName), fs.constants.COPYFILE_EXCL);
      storageKey = `${jobId}/${fileName}`;
    }
    if (onArtifact) { const stored = await onArtifact(artifactPath, path.basename(artifactPath), jobId); storageKey = stored.storageKey; }
    return { id: jobId, status: "passed" as const, engine: "native" as const, logs: logs.join("\n"), artifact: { type: plan.artifactType, fileName: path.basename(artifactPath), sha256, byteSize: artifact.byteLength, ...(storageKey ? { storageKey } : {}) } };
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}
