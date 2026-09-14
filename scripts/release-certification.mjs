#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root=process.cwd();
const errors=[]; const warnings=[];
const required=[
  'server/native-build-service/queue.ts','server/native-build-service/docker-executor.ts',
  'server/native-build-service/signing.ts','server/native-worker/runner.ts',
  'server/native-worker/cli.ts','docs/PRODUCTION_RELEASE_V3_9.md'
];
for(const f of required) if(!fs.existsSync(path.join(root,f))) errors.push(`Missing release-critical file: ${f}`);
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const queue=read('server/native-build-service/queue.ts');
const docker=read('server/native-build-service/docker-executor.ts');
const service=read('server/native-build-service/service.ts');
const signing=read('server/native-build-service/signing.ts');
const checks=[
  [queue.includes('runDockerNativeBuild'),'Queue must support Docker execution.'],
  [queue.includes('controller.signal'),'Queue cancellation must propagate to execution.'],
  [queue.includes('status:"cancelled"'),'Cancellation must remain authoritative.'],
  [docker.includes('NATIVE_ARTIFACT_ROOT') && docker.includes(':/artifacts:rw'),'Docker worker must persist artifacts to mounted artifact storage.'],
  [docker.includes('signal?: AbortSignal') && docker.includes('runDocker(plan, request.sandbox.timeoutSeconds * 1000, signal)'),'Docker cancellation signal must reach child process.'],
  [docker.includes('--read-only') && docker.includes('--cap-drop') && docker.includes('no-new-privileges'),'Docker security boundary must remain hardened.'],
  [signing.includes('mode: 0o600') && signing.includes('finally'),'Signing material must be ephemeral and cleaned up.'],
  [service.includes('SIGTERM') && service.includes('SIGINT'),'Build service must have graceful shutdown handlers.'],
];
for(const [ok,msg] of checks) if(!ok) errors.push(msg);
const envExample=fs.existsSync(path.join(root,'.env.example'))?read('.env.example'):'';
if(!envExample.includes('NATIVE_BUILD_EXECUTION_MODE')) warnings.push('NATIVE_BUILD_EXECUTION_MODE is not documented in .env.example.');
const artifact=process.argv[2];
if(artifact){
  if(!fs.existsSync(artifact)) errors.push(`Artifact not found: ${artifact}`);
  else {
    const stat=fs.statSync(artifact); const hash=crypto.createHash('sha256').update(fs.readFileSync(artifact)).digest('hex');
    if(stat.size<=0) errors.push('Artifact is empty.');
    console.log(`ARTIFACT sha256=${hash} bytes=${stat.size}`);
    try { execFileSync('unzip',['-t',artifact],{stdio:'pipe'}); console.log('ARTIFACT ZIP STRUCTURE PASS'); }
    catch { errors.push('Artifact ZIP structure check failed.'); }
  }
}
if(errors.length){console.error('RELEASE CERTIFICATION BLOCKED'); for(const e of errors) console.error(`- ${e}`); process.exit(1)}
console.log('RELEASE CERTIFICATION PASS');
console.log(`Checks passed: ${checks.length}`);
for(const w of warnings) console.log(`WARNING: ${w}`);
if(!artifact) console.log('Live APK/AAB certification remains infrastructure-dependent; no artifact path was supplied.');

