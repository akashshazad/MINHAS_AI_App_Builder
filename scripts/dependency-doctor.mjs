
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const lock = fs.readFileSync(path.join(root, 'pnpm-lock.yaml'), 'utf8');
const required = ['pnpm@9.12.0'];
const failures = [];

if (pkg.packageManager !== 'pnpm@9.12.0') failures.push(`packageManager must be pnpm@9.12.0 (found ${pkg.packageManager ?? 'missing'})`);
if (!pkg.devDependencies?.['@playwright/test']) failures.push('@playwright/test is not declared in devDependencies');
if (!/^lockfileVersion:\s*['\"]?9\.0/.test(lock)) failures.push('pnpm-lock.yaml must use lockfileVersion 9.0');
if (!lock.includes("'@playwright/test'")) failures.push('pnpm-lock.yaml has no @playwright/test importer entry');

const pnpm = spawnSync('pnpm', ['--version'], { encoding: 'utf8', shell: false });
if (pnpm.status !== 0) failures.push('pnpm executable is unavailable in this environment');
else if (pnpm.stdout.trim() !== '9.12.0') failures.push(`pnpm 9.12.0 required; found ${pnpm.stdout.trim()}`);

const offline = process.env.PNPM_OFFLINE === '1';
const store = process.env.PNPM_STORE_DIR || '.pnpm-store';
if (offline && !fs.existsSync(path.resolve(store))) failures.push(`PNPM_OFFLINE=1 but store is missing: ${store}`);

if (failures.length) {
  console.error('[DEPENDENCY DOCTOR] BLOCKED');
  for (const f of failures) console.error(`- ${f}`);
  console.error('\nRemediation: use a network-enabled Docker/CI build stage to preinstall pnpm 9.12.0 and generate/validate the lockfile; or provide a complete pnpm store and run with PNPM_OFFLINE=1.');
  process.exit(2);
}
console.log('[DEPENDENCY DOCTOR] PASS');
console.log(`pnpm=${pnpm.stdout.trim()} playwright=${pkg.devDependencies['@playwright/test']} offline=${offline}`);


