
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const required = [
  'package.json', 'pnpm-lock.yaml', 'Dockerfile',
  'Dockerfile.native-build-service', 'Dockerfile.native-worker',
  'playwright.config.ts', 'e2e/smoke.spec.ts', 'tsconfig.json',
  'eslint.config.js', 'scripts/dependency-doctor.mjs',
  'scripts/v46-certification.mjs'
];
const missing = required.filter((f) => !fs.existsSync(path.join(root, f)));
if (missing.length) {
  console.error('[FINAL GATE BLOCKED] Missing required files:');
  for (const f of missing) console.error(`- ${f}`);
  process.exit(2);
}
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const lock = fs.readFileSync(path.join(root, 'pnpm-lock.yaml'), 'utf8');
const failures = [];
if (pkg.version !== '4.8.0') failures.push(`package version must be 4.8.0 (found ${pkg.version})`);
if (pkg.packageManager !== 'pnpm@9.12.0') failures.push(`packageManager must be pnpm@9.12.0 (found ${pkg.packageManager ?? 'missing'})`);
if (!pkg.devDependencies?.['@playwright/test']) failures.push('@playwright/test is not declared');
if (!/^lockfileVersion:\s*['"]?9\.0/m.test(lock)) failures.push('lockfileVersion 9.0 required');
if (!lock.includes("'@playwright/test'")) failures.push('pnpm-lock.yaml is missing the @playwright/test importer entry');
for (const file of ['Dockerfile','Dockerfile.native-build-service','Dockerfile.native-worker']) {
  const text = fs.readFileSync(path.join(root,file),'utf8');
  if (!text.includes('FROM node:22-bookworm-slim') && file !== 'Dockerfile') failures.push(`${file} must provide Node.js/npm for pnpm bootstrap`);
  if (!text.includes('npm install --global pnpm@9.12.0')) failures.push(`${file} does not bootstrap pnpm 9.12.0`);
  if (text.includes('corepack enable') || text.includes('corepack prepare')) failures.push(`${file} still relies on Corepack bootstrap`);
}
if (failures.length) {
  console.error('[FINAL GATE BLOCKED]');
  for (const f of failures) console.error(`- ${f}`);
  console.error('\nRequired external certification sequence:');
  console.error('1) pnpm install (network-enabled) to regenerate the lockfile with Playwright');
  console.error('2) pnpm install --frozen-lockfile');
  console.error('3) pnpm run e2e:install');
  console.error('4) pnpm run verify:full');
  console.error('5) pnpm run release:live against provisioned staging infrastructure');
  console.error('6) certify real APK/AAB artifact hash, archive integrity, signing, and deployment health');
  process.exit(2);
}
const doctor = spawnSync('pnpm', ['run','dependency:doctor'], { stdio:'inherit', shell:false });
if (doctor.status !== 0) process.exit(doctor.status ?? 2);
const verify = spawnSync('pnpm', ['run','verify:full'], { stdio:'inherit', shell:false });
if (verify.status !== 0) process.exit(verify.status ?? 1);
console.log('FINAL PRODUCTION GATE PASS: dependency-complete verification and release certification prerequisites satisfied.');


