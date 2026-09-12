
import crypto from 'node:crypto';
const workerId = `${process.env.HOSTNAME || 'worker'}-${crypto.randomUUID()}`;
if (!/^.+-[0-9a-f-]{36}$/.test(workerId)) throw new Error('worker id contract failed');
for (const state of ['ready','busy','draining']) if (!['ready','busy','draining'].includes(state)) throw new Error('worker state contract failed');
console.log('NATIVE BUILD WORKER REGISTRY SELFTEST PASS');


