
# MINHAS AI App Builder 10X v3.2.0 — Release

## Delivered
- Standalone Native Build Service HTTP boundary.
- Authenticated `/v1/builds` submission and status APIs.
- Contract-first Zod validation before queueing.
- Async job execution through the existing v3.1 native worker.
- SHA-256/size artifact manifest.
- Optional durable artifact filesystem with integrity-checked download endpoint.
- Dedicated Docker image specification with JDK 17 + Android SDK 35 + build-tools 35.0.0 + pnpm 9.12.0.
- Docker Compose hardening: non-root service, read-only root filesystem, dropped capabilities, no-new-privileges, PID/memory/CPU limits, private port binding.
- Environment-based secret and storage configuration.
- Service contract tests and structural self-test.

## Not claimed
This release does not claim that a real APK/AAB was built successfully in this sandbox. It also does not claim HA queueing, multi-worker scheduling, remote object storage, Android signing certification, or live deployment. Those require provisioned infrastructure and end-to-end execution evidence.

## Next production hardening target
v3.3 should add durable job state + worker leases/heartbeats, cancellation, retry policy, concurrency limits, remote object storage, signed artifact URLs, signing profiles, and end-to-end Android build certification.


