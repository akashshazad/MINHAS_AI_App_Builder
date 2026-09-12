
import { z } from "zod";

export const nativeWorkerEngine = z.enum(["native"]);
export const nativeWorkerBuildType = z.enum(["android-debug", "android-release", "aab", "test"]);

export const nativeWorkerFile = z.object({
  path: z.string().min(1).max(512),
  language: z.string().max(80).optional(),
  content: z.string().max(2_000_000),
});

export const nativeWorkerRequest = z.object({
  projectId: z.number().int().positive(),
  projectName: z.string().min(1).max(200),
  framework: z.string().min(1).max(100),
  engine: nativeWorkerEngine,
  buildType: nativeWorkerBuildType.default("android-release"),
  signingProfileId: z.string().min(1).max(128).regex(/^[A-Za-z0-9._-]+$/).optional(),
  files: z.array(nativeWorkerFile).min(1).max(10_000),
  sandbox: z.object({
    nonRoot: z.literal(true),
    readOnlyBase: z.literal(true),
    network: z.enum(["deny-by-default", "package-registry-only"]),
    cpuLimit: z.string().max(20),
    memoryLimitMb: z.number().int().min(128).max(8192),
    processLimit: z.number().int().min(16).max(512),
    timeoutSeconds: z.number().int().min(60).max(3600),
    cleanup: z.literal("always"),
  }),
});

export type NativeWorkerRequest = z.infer<typeof nativeWorkerRequest>;

export const nativeWorkerResponse = z.object({
  id: z.string().min(1),
  status: z.enum(["queued", "starting", "running", "passed", "failed", "cancelled"]),
  engine: nativeWorkerEngine,
  artifact: z.object({
    type: z.enum(["apk", "aab"]),
    fileName: z.string(),
    storageKey: z.string().optional(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
    byteSize: z.number().int().positive().optional(),
  }).optional(),
  logs: z.string().max(500_000).optional(),
  error: z.string().max(20_000).optional(),
});


