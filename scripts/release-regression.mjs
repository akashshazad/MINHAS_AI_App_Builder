
#!/usr/bin/env node
import {execFileSync} from 'node:child_process';
const commands=[
 ['node',['scripts/native-worker-selftest.mjs']],['node',['scripts/native-build-service-selftest.mjs']],['node',['scripts/native-build-queue-selftest.mjs']],['node',['scripts/native-artifact-selftest.mjs']],['node',['scripts/native-build-worker-selftest.mjs']],['node',['scripts/native-signing-selftest.mjs']],['node',['scripts/native-build-docker-selftest.mjs']],['node',['scripts/native-build-execution-selftest.mjs']],['node',['scripts/release-certification.mjs']],['node',['scripts/release-control-selftest.mjs']],['node',['scripts/security-audit-selftest.mjs']]
];
for(const [cmd,args] of commands){console.log(`\n> ${cmd} ${args.join(' ')}`);execFileSync(cmd,args,{stdio:'inherit'})} console.log('\n10X RELEASE REGRESSION PASS');


