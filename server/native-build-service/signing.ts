
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { z } from "zod";

export const signingProfile = z.object({
  profileId: z.string().min(1).max(128).regex(/^[A-Za-z0-9._-]+$/),
  storeFileBase64: z.string().min(1),
  storePassword: z.string().min(1).max(4096),
  keyAlias: z.string().min(1).max(256),
  keyPassword: z.string().min(1).max(4096),
});
export type SigningProfile = z.infer<typeof signingProfile>;

export function loadSigningProfileFromEnvironment(profileId: string): SigningProfile | null {
  const prefix = `ANDROID_SIGNING_${profileId.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
  const profile = signingProfile.safeParse({
    profileId,
    storeFileBase64: process.env[`${prefix}_STORE_BASE64`],
    storePassword: process.env[`${prefix}_STORE_PASSWORD`],
    keyAlias: process.env[`${prefix}_KEY_ALIAS`],
    keyPassword: process.env[`${prefix}_KEY_PASSWORD`],
  });
  if (!profile.success) return null;
  return profile.data;
}

export async function withEphemeralSigningMaterial<T>(profile: SigningProfile, fn: (material: { keystorePath: string; gradleUserHome: string }) => Promise<T>): Promise<T> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "minhas-signing-"));
  const keystorePath = path.join(dir, `${crypto.randomUUID()}.keystore`);
  const gradleUserHome = path.join(dir, "gradle-home");
  try {
    const bytes = Buffer.from(profile.storeFileBase64, "base64");
    if (!bytes.length || bytes.length > 16 * 1024 * 1024) throw new Error("Invalid Android keystore payload.");
    await fs.writeFile(keystorePath, bytes, { flag: "wx", mode: 0o600 });
    await fs.mkdir(gradleUserHome, { recursive: true, mode: 0o700 });
    const properties = [
      `android.injected.signing.store.file=${keystorePath}`,
      `android.injected.signing.store.password=${escapeGradle(profile.storePassword)}`,
      `android.injected.signing.key.alias=${escapeGradle(profile.keyAlias)}`,
      `android.injected.signing.key.password=${escapeGradle(profile.keyPassword)}`,
    ].join("\n") + "\n";
    await fs.writeFile(path.join(gradleUserHome, "gradle.properties"), properties, { flag: "wx", mode: 0o600 });
    return await fn({ keystorePath, gradleUserHome });
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

function escapeGradle(value: string) { return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/\r/g, "\\r"); }


