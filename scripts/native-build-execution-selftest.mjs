
import assert from 'node:assert/strict';
import fs from 'node:fs';
const docker=fs.readFileSync('server/native-build-service/docker-executor.ts','utf8');
const cli=fs.readFileSync('server/native-worker/cli.ts','utf8');
const image=fs.readFileSync('Dockerfile.native-worker','utf8');
for (const marker of ['--read-only','--cap-drop','no-new-privileges','--pids-limit','--memory','--cpus','--network','shell: false','/run/minhas/request.json:ro']) assert.ok(docker.includes(marker), `missing execution security marker: ${marker}`);
assert.ok(cli.includes('NATIVE_WORKER_SECRET_FILE'), 'worker secret file contract missing');
assert.ok(image.includes('USER builder'), 'worker image must be non-root');
console.log('NATIVE BUILD EXECUTION SELFTEST PASS');


