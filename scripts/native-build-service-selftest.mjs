
import fs from 'node:fs';
import path from 'node:path';

const required = [
  'server/native-build-service/index.ts',
  'server/native-build-service/service.ts',
  'server/native-build-service/service.test.ts',
  'Dockerfile.native-build-service',
  'docker-compose.native-build.yml',
  'docs/NATIVE_BUILD_SERVICE_V3_2.md',
];
for (const file of required) {
  if (!fs.existsSync(path.join(process.cwd(), file))) throw new Error(`Missing v3.2 file: ${file}`);
}
const service = fs.readFileSync(path.join(process.cwd(), 'server/native-build-service/service.ts'), 'utf8');
for (const marker of ['authorization', '/v1/builds', 'nativeWorkerRequest', '/v1/artifacts', 'artifact-url']) {
  if (!service.includes(marker)) throw new Error(`Missing native build service marker: ${marker}`);
}
console.log('NATIVE BUILD SERVICE SELFTEST PASS');


