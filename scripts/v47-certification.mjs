
#!/usr/bin/env node
import fs from "node:fs";
import { spawnSync } from "node:child_process";
const pkg=JSON.parse(fs.readFileSync("package.json","utf8"));
if(pkg.version!=="4.7.0") throw new Error(`Expected version 4.7.0, got ${pkg.version}`);
const required=["server/native-build-service/durable-store.ts","server/native-build-service/queue.ts","server/_core/middleware/rate-limit.ts","lib/offline/sync-engine.ts","lib/offline/sync-engine.test.ts","drizzle/0010_v47_reliability.sql"];
const missing=required.filter(f=>!fs.existsSync(f));
if(missing.length) throw new Error(`Missing release files: ${missing.join(", ")}`);
const lock=fs.readFileSync("pnpm-lock.yaml","utf8");
if(!lock.includes("@playwright/test:")) {
 console.error("[V4.7 CERTIFICATION BLOCKED] pnpm-lock.yaml still lacks @playwright/test.");
 console.error("Run in a network-enabled build environment: pnpm install; pnpm install --frozen-lockfile; pnpm run e2e:install; pnpm run verify:full; pnpm run release:live; then certify a real signed APK/AAB.");
 process.exit(2);
}
const result=spawnSync("pnpm",["run","verify:full"],{stdio:"inherit",shell:false});
process.exit(result.status ?? 1);


