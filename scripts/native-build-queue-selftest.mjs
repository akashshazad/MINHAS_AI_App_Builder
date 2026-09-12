
import fs from 'node:fs';
import path from 'node:path';
const required=['server/native-build-service/durable-store.ts','server/native-build-service/queue.ts','server/native-build-service/service.ts','docs/NATIVE_BUILD_QUEUE_V3_3.md'];
for(const file of required){if(!fs.existsSync(path.join(process.cwd(),file))) throw new Error(`Missing ${file}`)}
const q=fs.readFileSync(path.join(process.cwd(),'server/native-build-service/queue.ts'),'utf8');
for(const token of ['claim(','heartbeat(','cancel(','saveArtifact']) if(!q.includes(token)) throw new Error(`Missing queue capability: ${token}`);
console.log('NATIVE BUILD QUEUE SELFTEST PASS');


