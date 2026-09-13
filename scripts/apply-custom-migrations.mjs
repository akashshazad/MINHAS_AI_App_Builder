#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import mysql from "mysql2/promise";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required.");
const dir = path.resolve("drizzle");
const migrations = [
  ["0005_v13_test_run_external_id.sql", async c => hasColumn(c, "testRuns", "externalRunId")],
  ["0006_git_version_control.sql", async c => (await Promise.all(["gitRepositories", "gitBranches", "gitCommits", "gitPullRequests"].map(t => hasTable(c, t)))).every(Boolean) && await hasIndex(c, "gitBranches", "gitBranches_project_name_uq")],
  ["0007_production_git_sync.sql", async c => {
    const checks = [["projects", "activeGitBranchId"], ["gitRepositories", "lastFetchedAt"], ["gitRepositories", "lastRemoteDefaultSha"], ["gitBranches", "upstreamBranch"], ["gitBranches", "remoteSha"], ["gitBranches", "lastFetchedSha"], ["gitBranches", "syncState"], ["gitCommits", "remoteSha"], ["gitCommits", "pushState"]];
    return (await Promise.all(checks.map(([t, col]) => hasColumn(c, t, col)))).every(Boolean) && await hasIndex(c, "gitRepositories", "gitRepositories_project_uq") && await hasIndex(c, "gitCommits", "gitCommits_project_branch_created_idx") && await hasIndex(c, "gitPullRequests", "gitPullRequests_project_status_idx");
  }],
  ["0008_native_releases_v41.sql", async c => hasTable(c, "nativeReleases")],
  ["0009_native_build_ha_audit_v42.sql", async c => hasTable(c, "nativeBuildAuditEvents")],
  ["0010_v47_reliability.sql", async c => (!await hasTable(c, "nativeBuildJobs") || await hasColumn(c, "nativeBuildJobs", "executionToken")) && await hasTable(c, "apiRateLimitBuckets")],
  ["0011_prompt_capacity.sql", async c => await hasColumnType(c, "projects", "idea", "mediumtext") && await hasColumnType(c, "aiRuns", "prompt", "mediumtext")],
];

async function hasTable(c, table) {
  const [rows] = await c.execute("SELECT 1 FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name=? LIMIT 1", [table]);
  return rows.length > 0;
}
async function hasColumn(c, table, column) {
  const [rows] = await c.execute("SELECT 1 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=? AND column_name=? LIMIT 1", [table, column]);
  return rows.length > 0;
}
async function hasColumnType(c, table, column, expectedType) {
  const [rows] = await c.execute("SELECT DATA_TYPE FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name=? AND column_name=? LIMIT 1", [table, column]);
  return String(rows?.[0]?.DATA_TYPE ?? "").toLowerCase() === expectedType.toLowerCase();
}
async function hasIndex(c, table, index) {
  const [rows] = await c.execute("SELECT 1 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name=? AND index_name=? LIMIT 1", [table, index]);
  return rows.length > 0;
}
async function applyStatement(c, statement) {
  const alterTable = statement.match(/^ALTER TABLE [`]?([^`\s]+)[`]?/i);
  if (alterTable && !(await hasTable(c, alterTable[1]))) return "SKIPPED_MISSING_OPTIONAL_TABLE";
  const addColumn = statement.match(/^ALTER TABLE [`]?([^`\s]+)[`]?\s+ADD COLUMN [`]?([^`\s]+)[`]?/i);
  if (addColumn && await hasColumn(c, addColumn[1], addColumn[2])) return "SKIPPED_EXISTING_COLUMN";
  const createIndex = statement.match(/^CREATE (?:UNIQUE )?INDEX [`]?([^`\s]+)[`]?\s+ON [`]?([^`\s]+)[`]?/i);
  if (createIndex && await hasIndex(c, createIndex[2], createIndex[1])) return "SKIPPED_EXISTING_INDEX";
  await c.query(statement);
  return "APPLIED";
}
async function main() {
  const c = await mysql.createConnection(url);
  try {
    const [lockRows] = await c.execute("SELECT GET_LOCK(?, 60) AS acquired", ["minhas-custom-migrations"]);
    if ((lockRows?.[0]?.acquired ?? 0) !== 1) throw new Error("Could not acquire custom migration lock within 60 seconds.");
    await c.execute("CREATE TABLE IF NOT EXISTS _minhas_custom_migrations (tag varchar(160) PRIMARY KEY, appliedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP)");
    for (const [file, marker] of migrations) {
      const [rows] = await c.execute("SELECT tag FROM _minhas_custom_migrations WHERE tag=? LIMIT 1", [file]);
      if (rows.length) continue;
      const already = await marker(c);
      if (!already) {
        const sql = fs.readFileSync(path.join(dir, file), "utf8");
        const statements = sql.split(/;\s*(?:\r?\n|$)/).map(s => s.trim()).filter(Boolean);
        for (const statement of statements) await applyStatement(c, statement);
      }
      await c.execute("INSERT INTO _minhas_custom_migrations(tag) VALUES(?)", [file]);
      console.log(`${already ? "RECORDED" : "APPLIED"} ${file}`);
    }
  } finally {
    try { await c.execute("SELECT RELEASE_LOCK(?)", ["minhas-custom-migrations"]); } catch {}
    await c.end();
  }
}
main().catch(e => { console.error("CUSTOM MIGRATION FAILED:", e instanceof Error ? e.message : e); process.exit(1); });
