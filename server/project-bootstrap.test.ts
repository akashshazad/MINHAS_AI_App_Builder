import mysql from "mysql2/promise";
import type { RowDataPacket } from "mysql2";
import { afterEach, describe, expect, it } from "vitest";
import { createProjectBootstrap, getGitBranch, getProjectSnapshot, listGitCommits, listProjectFiles } from "./db";

const cleanupIds: number[] = [];
const databaseUrl = process.env.DATABASE_URL;

afterEach(async () => {
  if (!cleanupIds.length || !databaseUrl) return;
  const connection = await mysql.createConnection(databaseUrl);
  try {
    for (const projectId of cleanupIds.splice(0)) {
      await connection.query("DELETE FROM gitCommits WHERE projectId = ?", [projectId]);
      await connection.query("DELETE FROM gitBranches WHERE projectId = ?", [projectId]);
      await connection.query("DELETE FROM projectSnapshots WHERE projectId = ?", [projectId]);
      await connection.query("DELETE FROM projectFiles WHERE projectId = ?", [projectId]);
      await connection.query("DELETE FROM projectEvents WHERE projectId = ?", [projectId]);
      await connection.query("DELETE FROM projects WHERE id = ?", [projectId]);
    }
  } finally {
    await connection.end();
  }
});

describe("project bootstrap transaction", () => {
  it.skipIf(!databaseUrl)("initializes an editable workspace and returns the same project for an idempotent retry", async () => {
    const connection = await mysql.createConnection(databaseUrl!);
    const [rows] = await connection.query<(RowDataPacket & { id: number })[]>("SELECT id FROM users ORDER BY id LIMIT 1");
    await connection.end();
    const userId = rows[0]?.id;
    if (!userId) return;

    const idempotencyKey = `bootstrap_${Date.now()}_test`;
    const data = {
      userId,
      name: `Bootstrap regression ${Date.now()}`,
      idea: "Build a test mobile app with a home screen and settings.",
      sourceLanguage: "english",
      projectType: "mobile_app",
      framework: "Expo + React Native + TypeScript",
      status: "workspace_ready",
      buildStatus: "not_checked",
      planJson: JSON.stringify({ schemaVersion: "1.0", action: "create_project", project: { projectName: "Bootstrap regression", type: "mobile_app", framework: "Expo + React Native + TypeScript", summary: "Regression workspace", requirements: [], pages: [], components: [], database: [], apis: [], authenticationRequired: false, businessRules: [], testingStrategy: [], implementationNotes: [] } }),
      deployStatus: "planned",
    } as const;
    const files = [{ path: "app/index.tsx", language: "tsx", content: "export default function App(){return null}", isCritical: true }];
    const event = { type: "plan_validated", message: "Bootstrap regression", metadataJson: JSON.stringify({ idempotencyKey }) };

    const first = await createProjectBootstrap(data, files, event);
    cleanupIds.push(first.projectId);
    const second = await createProjectBootstrap(data, files, event);

    expect(first.existing).toBe(false);
    expect(second).toEqual({ projectId: first.projectId, existing: true });
    expect((await listProjectFiles(first.projectId)).map((file) => file.path)).toEqual(["app/index.tsx"]);
    const snapshots = await getProjectSnapshot(first.projectId, first.snapshotId!);
    expect(snapshots?.reason).toBe("initial_bootstrap");
    const branch = await getGitBranch(first.projectId, first.branchId!);
    expect(branch?.name).toBe("main");
    expect(branch?.headSnapshotId).toBe(first.snapshotId);
    expect((await listGitCommits(first.projectId, first.branchId!))[0]?.message).toBe("Initial workspace");
  }, 30_000);
});
