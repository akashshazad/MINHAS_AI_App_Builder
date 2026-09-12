
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

export type StoredArtifact = { storageKey: string; fileName: string; sha256: string; byteSize: number; };

function safeKey(key: string) {
  if (!/^[a-f0-9-]{36}\/[A-Za-z0-9._-]+$/.test(key)) throw new Error("Invalid artifact storage key");
  return key;
}

export class LocalArtifactStore {
  constructor(private readonly root = process.env.NATIVE_ARTIFACT_ROOT || ".native-artifacts") {}
  async put(jobId: string, sourcePath: string, fileName: string): Promise<StoredArtifact> {
    if (!/^[a-f0-9-]{36}$/.test(jobId)) throw new Error("Invalid build job id");
    if (path.basename(fileName) !== fileName) throw new Error("Invalid artifact filename");
    const destinationDir = path.join(this.root, jobId);
    await fs.mkdir(destinationDir, { recursive: true, mode: 0o750 });
    const storageKey = `${jobId}/${fileName}`;
    const destination = path.join(destinationDir, fileName);
    const data = await fs.readFile(sourcePath);
    const sha256 = crypto.createHash("sha256").update(data).digest("hex");
    await fs.writeFile(destination, data, { flag: "wx", mode: 0o640 });
    return { storageKey, fileName, sha256, byteSize: data.byteLength };
  }
  async read(storageKey: string) {
    const key = safeKey(storageKey);
    return fs.readFile(path.join(this.root, key));
  }
  async exists(storageKey: string) { try { await this.read(storageKey); return true; } catch { return false; } }
}

export function signArtifact(storageKey: string, expiresAt: number, secret = process.env.ARTIFACT_SIGNING_SECRET) {
  if (!secret) throw new Error("Artifact signing secret is not configured");
  const payload = `${storageKey}.${expiresAt}`;
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}
export function verifyArtifactSignature(storageKey: string, expiresAt: number, signature: string, now = Date.now(), secret = process.env.ARTIFACT_SIGNING_SECRET) {
  if (!secret || expiresAt < now) return false;
  const expected = signArtifact(storageKey, expiresAt, secret);
  const actual = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  return actual.length === expectedBytes.length && crypto.timingSafeEqual(expectedBytes, actual);
}


