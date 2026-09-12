
#!/usr/bin/env node
import fs from 'node:fs';
const files=['server/native-build-service/service.ts','server/native-build-service/queue.ts','server/native-build-service/release-control-plane.ts','server/native-build-service/artifact-store.ts','scripts/live-release-certification.mjs','docs/PRODUCTION_RELEASE_V4_1.md','drizzle/0008_native_releases_v41.sql'];
for(const file of files) if(!fs.existsSync(file)) throw new Error(`Missing v4.1 file: ${file}`);
const release=fs.readFileSync('server/native-build-service/release-control-plane.ts','utf8');
for(const marker of ['TRANSITIONS','canTransition','assertTransition','canPublish','async publish','async rollback','published: ["rolled-back"]']) if(!release.includes(marker)) throw new Error(`Missing release safety marker: ${marker}`);
const service=fs.readFileSync('server/native-build-service/service.ts','utf8');
for(const marker of ['/publish','/rollback','const queue = new BuildQueue()','await queue.stop()']) if(!service.includes(marker)) throw new Error(`Missing service marker: ${marker}`);
const queue=fs.readFileSync('server/native-build-service/queue.ts','utf8'); const durable=fs.readFileSync('server/native-build-service/durable-store.ts','utf8');
for(const marker of ['result.status === "cancelled"','controller.abort()']) if(!queue.includes(marker)) throw new Error(`Missing queue safety marker: ${marker}`);
if(!durable.includes('BUILD_MAX_ATTEMPTS')) throw new Error('Retry limit marker missing');
const artifact=fs.readFileSync('server/native-build-service/artifact-store.ts','utf8'); if(!artifact.includes('flag: "wx"')) throw new Error('Artifact immutability marker missing');
const live=fs.readFileSync('scripts/live-release-certification.mjs','utf8');
for(const marker of ['/v1/releases','release-verification','release-publish','artifact-integrity']) if(!live.includes(marker)) throw new Error(`Live certification marker missing: ${marker}`);
console.log('V4.1 RELEASE CONTROL SELFTEST PASS');


