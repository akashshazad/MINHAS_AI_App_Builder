
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { NativeWorkerRequest } from "../native-worker/contract";

export type DockerExecutionPlan = { command: string; args: string[] };

function safeImage(image: string) {
  if (!/^[-A-Za-z0-9._/:@]+$/.test(image)) throw new Error("Invalid native builder image reference.");
  return image;
}

export function createDockerExecutionPlan(request: NativeWorkerRequest, workspace: string, requestFile: string, resultFile: string, jobId: string, secretFile?: string, artifactRoot?: string, image = process.env.NATIVE_BUILDER_IMAGE || "minhas/native-builder:latest"): DockerExecutionPlan {
  if (request.sandbox.network === "package-registry-only" && process.env.NATIVE_BUILDER_NETWORK_ALLOWLISTED !== "true") throw new Error("Package-registry network requires NATIVE_BUILDER_NETWORK_ALLOWLISTED=true on a preconfigured egress-restricted Docker network.");
  const network = request.sandbox.network === "package-registry-only" ? (process.env.NATIVE_BUILDER_NETWORK || "none") : "none";
  const args = ["run", "--rm", "--init", "--network", network, "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges", "--pids-limit", String(request.sandbox.processLimit), "--cpus", request.sandbox.cpuLimit, "--memory", `${request.sandbox.memoryLimitMb}m`, "--tmpfs", "/tmp:rw,noexec,nosuid,size=512m", "-v", `${workspace}:/workspace:rw`, "-v", `${requestFile}:/run/minhas/request.json:ro`, "-v", `${resultFile}:/run/minhas/result.json:rw`, "-e", "NATIVE_WORKER_REQUEST_FILE=/run/minhas/request.json", "-e", "NATIVE_WORKER_RESULT_FILE=/run/minhas/result.json", "-e", `NATIVE_WORKER_JOB_ID=${jobId}`, "-e", "NATIVE_WORKSPACE_ROOT=/workspace"];
  if (artifactRoot) args.push("-v", `${artifactRoot}:/artifacts:rw`, "-e", "NATIVE_ARTIFACT_ROOT=/artifacts");
  if (secretFile) args.push("-v", `${secretFile}:/run/secrets/minhas-signing.json:ro`, "-e", "NATIVE_WORKER_SECRET_FILE=/run/secrets/minhas-signing.json");
  args.push("-w", "/workspace", safeImage(image));
  return { command: "docker", args };
}

export async function runDockerNativeBuild(request: NativeWorkerRequest, jobId: string, workspaceRoot: string, signingSecrets?: Record<string, string>, image?: string, signal?: AbortSignal) {
  const root = path.join(workspaceRoot, jobId);
  await fs.mkdir(root, { recursive: true, mode: 0o750 });
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), "minhas-docker-job-"));
  const requestFile = path.join(temp, "request.json");
  const resultFile = path.join(temp, "result.json");
  const secretFile = signingSecrets && Object.keys(signingSecrets).length ? path.join(temp, "signing.json") : undefined;
  try {
    await fs.writeFile(requestFile, JSON.stringify(request), { flag: "wx", mode: 0o600 });
    await fs.writeFile(resultFile, "", { flag: "wx", mode: 0o600 });
    if (secretFile) await fs.writeFile(secretFile, JSON.stringify(signingSecrets), { flag: "wx", mode: 0o600 });
    const artifactRoot = process.env.NATIVE_ARTIFACT_ROOT;
    const plan = createDockerExecutionPlan(request, root, requestFile, resultFile, jobId, secretFile, artifactRoot, image);
    const result = await runDocker(plan, request.sandbox.timeoutSeconds * 1000, signal);
    const raw = await fs.readFile(resultFile, "utf8").catch(() => "");
    if (!raw) throw new Error(`Native Docker worker produced no result. Exit code ${result.code}. ${result.output.slice(-4000)}`);
    return JSON.parse(raw) as { status: string; logs?: string; error?: string; artifact?: unknown; id: string; engine: "native" };
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
    await fs.rm(root, { recursive: true, force: true });
  }
}

export function runDocker(plan: DockerExecutionPlan, timeoutMs: number, signal?: AbortSignal): Promise<{ code: number; output: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(plan.command, plan.args, { shell: false, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    const append = (chunk: Buffer) => { output += chunk.toString("utf8"); if (output.length > 500_000) output = output.slice(-500_000); };
    child.stdout.on("data", append); child.stderr.on("data", append);
    let settled = false;
    const finishReject = (e: Error) => { if (settled) return; settled = true; reject(e); };
    const kill = () => { child.kill("SIGKILL"); finishReject(new Error("Docker build cancelled.")); };
    if (signal?.aborted) return kill();
    signal?.addEventListener("abort", kill, { once: true });
    const timer = setTimeout(() => { child.kill("SIGKILL"); finishReject(new Error("Docker build timed out.")); }, timeoutMs);
    child.on("error", e => { clearTimeout(timer); signal?.removeEventListener("abort", kill); finishReject(e); });
    child.on("exit", code => { clearTimeout(timer); signal?.removeEventListener("abort", kill); if (!settled) { settled = true; resolve({ code: code ?? 1, output }); } });
  });
}


