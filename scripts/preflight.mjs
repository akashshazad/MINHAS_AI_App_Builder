
#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
const root = process.cwd();
const required = ["package.json", "app.config.ts", "shared/types.ts", "server/routers.ts", "server/providers.ts", "docs/MANUS_APP_DEVELOPMENT.md"];
const forbiddenSecrets = /(?:AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]+ PRIVATE KEY-----|(?:sk|pk)_[A-Za-z0-9]{20,})/;
const files = fs.readdirSync(root, { recursive: true }).filter((x) => typeof x === "string" && !x.includes("node_modules/") && !x.includes(".git/"));
const missing = required.filter((f) => !fs.existsSync(path.join(root, f)));
const secretHits = [];
for (const rel of files) { const full = path.join(root, rel); if (fs.existsSync(full) && fs.statSync(full).isFile()) { const text = fs.readFileSync(full, "utf8"); if (forbiddenSecrets.test(text) && !rel.endsWith("preflight.mjs")) secretHits.push(rel); } }
if (missing.length || secretHits.length) { console.error("PREFLIGHT FAIL", { missing, secretHits }); process.exit(1); }
console.log("PREFLIGHT PASS: required project files exist and no known hard-coded secret pattern was found.");


