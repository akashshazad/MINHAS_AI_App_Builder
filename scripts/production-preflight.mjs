
#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const required = [
  'package.json', 'pnpm-lock.yaml', 'app.config.ts', '.env.example',
  'server/_core/index.ts', 'server/routers.ts', 'drizzle/schema.ts',
  'drizzle/0007_production_git_sync.sql', 'Dockerfile', 'eas.json',
  '.github/workflows/ci.yml'
];
const forbidden = [
  /^\.env$/, /^\.env\./, /^node_modules(?:\/|$)/, /^\.git(?:\/|$)/,
  /^\.expo\/cache(?:\/|$)/, /^dist(?:\/|$)/
];
const secretPatterns = [
  /-----BEGIN [A-Z ]+ PRIVATE KEY-----/,
  /(?:AKIA|ASIA)[0-9A-Z]{16}/,
  /(?:sk|pk)_[A-Za-z0-9]{20,}/,
];
const errors = [];
for (const file of required) if (!fs.existsSync(path.join(root, file))) errors.push(`Missing required file: ${file}`);
if (process.env.NODE_ENV === 'production') {
  for (const key of ['DATABASE_URL','JWT_SECRET','OAUTH_SERVER_URL','PUBLIC_APP_URL','CORS_ALLOWED_ORIGINS','BUILD_SERVICE_TOKEN','ARTIFACT_SIGNING_SECRET']) {
    if (!process.env[key]) errors.push(`Missing production environment variable: ${key}`);
  }
  for (const key of ['JWT_SECRET','BUILD_SERVICE_TOKEN','ARTIFACT_SIGNING_SECRET']) {
    if (process.env[key] && process.env[key].length < 32) errors.push(`${key} must be at least 32 characters in production.`);
  }
  if (process.env.NATIVE_BUILD_EXECUTION_MODE !== 'docker') errors.push('NATIVE_BUILD_EXECUTION_MODE must be docker in production.');
}
const walk = (dir) => {
  const out=[];
  for (const ent of fs.readdirSync(dir,{withFileTypes:true})) {
    const rel=path.relative(root,path.join(dir,ent.name)).replaceAll(path.sep,'/');
    if (forbidden.some(rx=>rx.test(rel))) continue;
    if (ent.isDirectory()) out.push(...walk(path.join(dir,ent.name))); else out.push(rel);
  }
  return out;
};
for (const rel of walk(root)) {
  const full=path.join(root,rel);
  let text=''; try { text=fs.readFileSync(full,'utf8'); } catch { continue; }
  if (secretPatterns.some(rx=>rx.test(text)) && !rel.endsWith('production-preflight.mjs')) errors.push(`Potential hard-coded secret in: ${rel}`);
}
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
if (pkg.packageManager !== 'pnpm@9.12.0') errors.push(`packageManager must remain pnpm@9.12.0 (found ${pkg.packageManager}).`);
if (errors.length) { console.error('PRODUCTION PREFLIGHT FAIL'); for (const e of errors) console.error(`- ${e}`); process.exit(1); }
console.log('PRODUCTION PREFLIGHT PASS: release structure, production env contract, package-manager pin, and secret scan are valid.');


