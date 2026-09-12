
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const required = [
  "e2e/run.mjs", "playwright.config.ts", "e2e/README.md",
  "prettier.config.mjs", ".prettierignore", ".husky/pre-commit",
  "i18n/index.ts", "locales/en.json", "locales/ur.json", "locales/ur-Roman.json",
  "store/app-store.tsx", "lib/monitoring/index.ts", "lib/monitoring/config.ts",
  "monitoring.config.example.ts", ".env.monitoring.example",
  "server/_core/middleware/security.ts", "server/_core/middleware/rate-limit.ts",
  "scripts/install-git-hooks.mjs",
];
for (const file of required) if (!existsSync(file)) throw new Error(`Missing required feature file: ${file}`);
for (const file of ["locales/en.json", "locales/ur.json", "locales/ur-Roman.json"]) JSON.parse(readFileSync(file, "utf8"));
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
for (const script of ["e2e", "hooks:install", "prepare"]) if (!pkg.scripts?.[script]) throw new Error(`Missing package script: ${script}`);
execFileSync("node", ["--check", "e2e/run.mjs"]);
execFileSync("node", ["--check", "scripts/install-git-hooks.mjs"]);
console.log("FEATURE STRUCTURE SELFTEST PASS");


