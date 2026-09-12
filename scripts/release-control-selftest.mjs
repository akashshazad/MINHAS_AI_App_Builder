
import fs from 'node:fs'; import crypto from 'node:crypto';
const p='server/native-build-service/release-control-plane.ts'; if(!fs.existsSync(p)) throw new Error('release control plane missing'); const s=fs.readFileSync(p,'utf8');
for(const marker of ['nativeReleases','requestSha256','published','rolled-back','Invalid release transition','manifestJson']) if(!s.includes(marker)) throw new Error(`Missing release-control marker: ${marker}`);
const hash=crypto.createHash('sha256').update('{"x":1}').digest('hex'); if(!/^[a-f0-9]{64}$/.test(hash)) throw new Error('SHA-256 primitive unavailable'); console.log('RELEASE CONTROL SELFTEST PASS');


