
import { readFileSync } from "node:fs";
import { join } from "node:path";
const root = process.cwd();
const required = [
  "server/native-worker/contract.ts",
  "server/native-worker/sandbox.ts",
  "server/native-worker/commands.ts",
  "server/native-worker/runner.ts",
  "docs/NATIVE_BUILD_WORKER_V3_1.md",
];
for (const file of required) readFileSync(join(root, file), "utf8");
console.log(`NATIVE WORKER SELFTEST PASS (${required.length} required files)`);


