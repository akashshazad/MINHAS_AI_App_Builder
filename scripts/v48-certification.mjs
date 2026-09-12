
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
if (pkg.version !== "4.8.0") throw new Error("Expected package version 4.8.0");
const lock = fs.readFileSync(path.join(root, "pnpm-lock.yaml"), "utf8");
if (!lock.includes("@playwright/test")) {
  console.error("[V4.8 CERTIFICATION BLOCKED] pnpm-lock.yaml lacks @playwright/test.");
  console.error("Run in network-enabled CI: pnpm install && pnpm install --frozen-lockfile && pnpm run e2e:install && pnpm run verify:full.");
  process.exit(2);
}
const result = spawnSync("pnpm", ["run", "verify:full"], { cwd: root, stdio: "inherit" });
process.exit(result.status ?? 1);


