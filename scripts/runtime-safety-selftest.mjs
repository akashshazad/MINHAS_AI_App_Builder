
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const required = [
  "server/_core/middleware/request-context.ts",
  "server/_core/middleware/error-handler.ts",
  "server/_core/middleware/security.ts",
  "server/_core/middleware/rate-limit.ts",
  "lib/monitoring/index.ts",
  "store/app-store.tsx",
  "i18n/index.ts",
];
for (const rel of required) assert.equal(fs.existsSync(path.join(root, rel)), true, `Missing ${rel}`);
const security = fs.readFileSync(path.join(root, "server/_core/middleware/security.ts"), "utf8");
assert.match(security, /CORS_ALLOWED_ORIGINS/);
assert.match(security, /Access-Control-Allow-Origin/);
assert.match(security, /X-Content-Type-Options/);
assert.match(security, /Strict-Transport-Security/);
const rate = fs.readFileSync(path.join(root, "server/_core/middleware/rate-limit.ts"), "utf8");
assert.doesNotMatch(rate, /x-forwarded-for.*\|\| req\.ip/s);
const requestContext = fs.readFileSync(path.join(root, "server/_core/middleware/request-context.ts"), "utf8");
assert.match(requestContext, /randomUUID/);
assert.match(requestContext, /X-Request-Id/);
const errorHandler = fs.readFileSync(path.join(root, "server/_core/middleware/error-handler.ts"), "utf8");
assert.match(errorHandler, /requestId/);
assert.match(errorHandler, /Internal server error/);
console.log("RUNTIME SAFETY SELFTEST PASS");


