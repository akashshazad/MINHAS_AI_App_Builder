
import fs from "node:fs/promises";
import { runNativeBuild } from "./runner";
import { nativeWorkerRequest } from "./contract";

const requestPath = process.env.NATIVE_WORKER_REQUEST_FILE || "/run/minhas/request.json";
const resultPath = process.env.NATIVE_WORKER_RESULT_FILE || "/run/minhas/result.json";
const secretPath = process.env.NATIVE_WORKER_SECRET_FILE;

async function loadSecrets() {
  if (!secretPath) return;
  const raw = await fs.readFile(secretPath, "utf8");
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  for (const [key, value] of Object.entries(parsed)) {
    if (!/^ANDROID_SIGNING_[A-Z0-9_]+$/.test(key) || typeof value !== "string") throw new Error("Invalid signing secret key.");
    process.env[key] = value;
  }
}

async function main() {
  await loadSecrets();
  const request = nativeWorkerRequest.parse(JSON.parse(await fs.readFile(requestPath, "utf8")));
  const jobId = process.env.NATIVE_WORKER_JOB_ID;
  if (!jobId || !/^[a-f0-9-]{36}$/.test(jobId)) throw new Error("Invalid worker job id.");
  const result = await runNativeBuild(request, process.env.NATIVE_WORKSPACE_ROOT || "/workspace", undefined, undefined, undefined, jobId);
  await fs.writeFile(resultPath, JSON.stringify(result), { flag: "w", mode: 0o600 });
  if (result.status === "failed" || result.status === "cancelled") process.exitCode = result.status === "cancelled" ? 130 : 1;
}
main().catch(async (error) => {
  await fs.writeFile(resultPath, JSON.stringify({ status: "failed", engine: "native", error: error instanceof Error ? error.message : "Worker failed" }), { flag: "w", mode: 0o600 }).catch(() => undefined);
  process.exitCode = 1;
});

