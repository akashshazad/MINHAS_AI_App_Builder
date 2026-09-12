
#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const service = fs.readFileSync(path.join(root,"server/native-build-service/service.ts"),"utf8");
const release = fs.readFileSync(path.join(root,"server/native-build-service/release-control-plane.ts"),"utf8");
const migrationRunner = fs.readFileSync(path.join(root,"scripts/apply-custom-migrations.mjs"),"utf8");
const pkg = JSON.parse(fs.readFileSync(path.join(root,"package.json"),"utf8"));

assert.equal(pkg.version, "4.8.0");
assert.match(service, /\/live/);
assert.match(service, /IdempotencyCache/);
assert.match(service, /SlidingWindowRateLimiter/);
assert.match(service, /idempotency-key/i);
assert.match(service, /429/);
assert.match(release, /Release is terminal/);
assert.match(release, /state NOT IN \('published','rolled-back'\)/);
assert.match(migrationRunner, /GET_LOCK/);
assert.match(migrationRunner, /RELEASE_LOCK/);
assert.match(migrationRunner, /Could not acquire custom migration lock/);
assert.ok(!fs.existsSync(path.join(root,"drizzle/0010_production_operational_safety_v43.sql")));
console.log("V4.3 PRODUCTION OPERATIONAL SAFETY SELFTEST PASS");


