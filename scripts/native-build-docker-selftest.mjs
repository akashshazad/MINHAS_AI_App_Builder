
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync('server/native-build-service/docker-executor.ts','utf8');
for (const marker of ['docker', '--rm', '--read-only', '--cap-drop', 'no-new-privileges', '--pids-limit', '--memory', '--cpus', 'shell: false']) assert.ok(source.includes(marker), `missing Docker security marker: ${marker}`);
assert.ok(source.includes('network'), 'network isolation must be explicit');
console.log('NATIVE DOCKER EXECUTOR SELFTEST PASS');


