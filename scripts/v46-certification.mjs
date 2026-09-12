
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const required = ['package.json','pnpm-lock.yaml','playwright.config.ts','e2e/smoke.spec.ts','tsconfig.json','eslint.config.js'];
for (const file of required) if (!fs.existsSync(path.join(root,file))) throw new Error(`Missing release file: ${file}`);
const pkg = JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
if (pkg.version !== '4.6.3') throw new Error(`Expected version 4.6.3, got ${pkg.version}`);
if (!pkg.devDependencies?.['@playwright/test']) throw new Error('Playwright dependency missing');
if (!fs.readFileSync(path.join(root,'pnpm-lock.yaml'),'utf8').includes('@playwright/test')) {
  console.error('[CERTIFICATION BLOCKED] pnpm-lock.yaml does not contain @playwright/test. Run pnpm install in a network-enabled environment, commit the updated lockfile, then rerun certification.');
  process.exit(2);
}
const doctor = spawnSync('pnpm',['run','dependency:doctor'],{stdio:'inherit',shell:false});
if (doctor.status !== 0) process.exit(doctor.status ?? 2);
const r = spawnSync('pnpm',['run','verify:full'],{stdio:'inherit',shell:false});
if (r.status !== 0) process.exit(r.status ?? 1);
console.log('V4.6.3 FULL CERTIFICATION PASS');


