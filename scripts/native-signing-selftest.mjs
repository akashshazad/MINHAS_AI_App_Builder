
import assert from 'node:assert/strict';
import fs from 'node:fs';
const signing=fs.readFileSync('server/native-build-service/signing.ts','utf8');
const runner=fs.readFileSync('server/native-worker/runner.ts','utf8');
for (const marker of ['ANDROID_SIGNING_', 'mkdtemp', '0o600', 'force: true']) assert.ok(signing.includes(marker), `missing signing marker: ${marker}`);
for (const marker of ['GRADLE_USER_HOME', 'withEphemeralSigningMaterial']) assert.ok(runner.includes(marker), `missing runner signing marker: ${marker}`);
assert.ok(!runner.includes('signingGradleProperties'), 'signing secrets must not be passed as Gradle CLI arguments');
console.log('NATIVE SIGNING SELFTEST PASS');


