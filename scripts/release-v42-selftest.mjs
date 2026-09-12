
#!/usr/bin/env node
import fs from "node:fs";
import assert from "node:assert/strict";

const required = [
  "server/native-build-service/service.ts",
  "server/native-build-service/durable-store.ts",
  "server/native-build-service/release-control-plane.ts",
  "server/native-build-service/worker-registry.ts",
  "server/native-build-service/ha.ts",
  "server/native-build-service/artifact-store.ts",
  "server/native-build-service/docker-executor.ts",
  "server/native-worker/runner.ts",
  "server/native-worker/contract.ts",
  "drizzle/0009_native_build_ha_audit_v42.sql",
  "scripts/live-release-certification.mjs",
  "scripts/apply-custom-migrations.mjs",
  "docs/PRODUCTION_RELEASE_V4_2.md",
];
for (const file of required) assert.ok(fs.existsSync(file), `Missing v4.2 file: ${file}`);

const durable = fs.readFileSync(required[1], "utf8");
for (const marker of ["status NOT IN ('passed','failed','cancelled')", "nativeBuildWorkers", "recoverExpired"]) assert.ok(durable.includes(marker), `Missing durable safety marker: ${marker}`);

const release = fs.readFileSync(required[2], "utf8");
for (const marker of ["REQUIRED_GATES", "Number.isSafeInteger(record.manifest.artifactBytes)", "await this.ensure()", 'state === "verified"']) assert.ok(release.includes(marker), `Missing release safety marker: ${marker}`);

const service = fs.readFileSync(required[0], "utf8");
for (const marker of ['res.status(ok?200:503)', '/v1/releases/:id/audit', "MAX_TTL_MS", "getHAHealth"]) assert.ok(service.includes(marker), `Missing service readiness marker: ${marker}`);

const docker = fs.readFileSync("server/native-build-service/docker-executor.ts", "utf8");
for (const marker of ["--read-only", "--cap-drop", "no-new-privileges", "NATIVE_BUILDER_NETWORK_ALLOWLISTED"]) assert.ok(docker.includes(marker), `Missing Docker isolation marker: ${marker}`);

const live = fs.readFileSync("scripts/live-release-certification.mjs", "utf8");
assert.ok(live.includes("queued.buildJobId"), "Live certification must use the returned buildJobId for artifact retrieval.");
assert.ok(!live.includes("queued." + "id}/artifact-url"), "Live certification contains stale release/build identifier usage.");

console.log("V4.2 RELEASE SAFETY SELFTEST PASS");


