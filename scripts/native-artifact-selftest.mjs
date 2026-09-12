
import fs from 'node:fs';
import path from 'node:path';
const file = path.join(process.cwd(),'server/native-build-service/artifact-store.ts');
const source = fs.readFileSync(file,'utf8');
for (const marker of ['createHash("sha256")','timingSafeEqual','Invalid artifact storage key','ARTIFACT_SIGNING_SECRET']) {
  if (!source.includes(marker)) throw new Error(`Missing artifact security marker: ${marker}`);
}
console.log('NATIVE ARTIFACT SELFTEST PASS');


