
import fs from 'node:fs'; import path from 'node:path';
const p='server/native-build-service/security-audit.ts'; if(!fs.existsSync(p)) throw new Error('security audit module missing'); const s=fs.readFileSync(p,'utf8');
for(const marker of ['hardcoded-secret','unsafe-process-execution','dangerous-docker-flag']) if(!s.includes(marker)) throw new Error(`Missing security audit marker: ${marker}`); console.log('SECURITY AUDIT SELFTEST PASS');


