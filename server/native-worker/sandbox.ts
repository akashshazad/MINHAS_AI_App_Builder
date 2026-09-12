
import path from "node:path";
import fs from "node:fs/promises";
import { nativeWorkerRequest, type NativeWorkerRequest } from "./contract";

const MAX_TOTAL_BYTES = 50 * 1024 * 1024;
const PROTECTED = /^(?:\.env(?:\..*)?|\.git(?:\/|$)|node_modules(?:\/|$)|dist(?:\/|$)|coverage(?:\/|$))/i;

export function safeRelativePath(value: string) {
  const normalized = value.replace(/\\/g, "/");
  if (!normalized || normalized.startsWith("/") || normalized.includes("\0")) throw new Error(`Unsafe file path: ${value}`);
  const clean = path.posix.normalize(normalized);
  if (clean === "." || clean === ".." || clean.startsWith("../") || clean.includes("/../")) throw new Error(`Path traversal blocked: ${value}`);
  if (PROTECTED.test(clean)) throw new Error(`Protected/generated path is not accepted: ${value}`);
  return clean;
}

export async function materializeWorkspace(request: NativeWorkerRequest, root: string) {
  const parsed = nativeWorkerRequest.parse(request);
  let totalBytes = 0;
  const seen = new Set<string>();
  for (const file of parsed.files) {
    const relative = safeRelativePath(file.path);
    if (seen.has(relative)) throw new Error(`Duplicate workspace path: ${relative}`);
    seen.add(relative);
    totalBytes += Buffer.byteLength(file.content, "utf8");
    if (totalBytes > MAX_TOTAL_BYTES) throw new Error("Workspace exceeds 50 MiB limit.");
    const target = path.join(root, relative);
    const parent = path.dirname(target);
    await fs.mkdir(parent, { recursive: true });
    await fs.writeFile(target, file.content, { encoding: "utf8", flag: "wx" });
  }
  return { fileCount: parsed.files.length, totalBytes };
}


