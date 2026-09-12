
#!/usr/bin/env node
import fs from "node:fs";
import assert from "node:assert/strict";
const pkg=JSON.parse(fs.readFileSync("package.json","utf8"));
assert.equal(pkg.version,"4.8.0");
const queue=fs.readFileSync("server/native-build-service/durable-store.ts","utf8");
assert.match(queue,/executionToken varchar\(64\)/);
assert.match(queue,/AND executionToken=\?/);
assert.match(queue,/executionToken=NULL/);
const middleware=fs.readFileSync("server/_core/middleware/rate-limit.ts","utf8");
assert.match(middleware,/apiRateLimitBuckets/);
assert.match(middleware,/API_RATE_LIMIT_DISTRIBUTED/);
assert.match(middleware,/Rate limiting service unavailable/);
assert.ok(fs.existsSync("lib/offline/sync-engine.ts"));
assert.ok(fs.existsSync("lib/offline/sync-engine.test.ts"));
assert.ok(fs.existsSync("drizzle/0010_v47_reliability.sql"));
console.log("V4.7 RELIABILITY SELFTEST PASS");


