
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const checks = [
  [pkg.version === "4.8.0", "package version 4.8.0"],
  [fs.existsSync(path.join(root, "lib/auth/oauth-callback.ts")), "OAuth callback parser"],
  [fs.existsSync(path.join(root, "lib/query/adaptive-refresh.ts")), "adaptive refresh utility"],
  [fs.existsSync(path.join(root, "lib/ui/error-message.ts")), "safe UI error helper"],
  [!fs.readFileSync(path.join(root, "app/project/[id]/version-control.tsx"), "utf8").includes("refetchInterval:8000"), "git polling removed"],
  [!fs.readFileSync(path.join(root, "app/(tabs)/settings.tsx"), "utf8").includes("refetchInterval: 15000"), "settings polling removed"],
  [fs.readFileSync(path.join(root, "app/oauth/callback.tsx"), "utf8").includes('router.replace("/(tabs)")'), "direct OAuth redirect"],
  [!fs.readFileSync(path.join(root, "app/oauth/callback.tsx"), "utf8").includes("setTimeout"), "no OAuth redirect timeout"],
  [!fs.readFileSync(path.join(root, "app/oauth/callback.tsx"), "utf8").includes("url.match("), "no regex URL fallback"],
  [!fs.readFileSync(path.join(root, ".env.example"), "utf8").match(/NATIVE_BUILD_EXECUTION_MODE=/g)?.length !== 2, "env duplicate guard"],
  [fs.readFileSync(path.join(root, "app.config.ts"), "utf8").includes("MINHAS_APP_BUNDLE_ID"), "configurable bundle id"],
];
for (const [ok, label] of checks) if (!ok) throw new Error(`V4.8 selftest failed: ${label}`);
console.log("V4.8 RELEASE SELFTEST PASS");


