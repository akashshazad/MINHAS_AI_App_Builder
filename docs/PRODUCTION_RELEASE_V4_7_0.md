
# MINHAS AI App Builder v4.7.0 — Enterprise Reliability & Offline Hardening

## Completed
- Durable native-build execution fencing with a unique execution token per lease claim. Stale workers cannot heartbeat or mutate a job after another worker takes ownership.
- Terminal job states remain authoritative. Cancellation cannot be overwritten by a stale execution.
- Optional distributed API rate limiting backed by MySQL (`API_RATE_LIMIT_DISTRIBUTED=true`) for multi-instance deployments, with local limiter fallback when distributed mode is disabled.
- Persistent mobile offline cache + mutation outbox (`lib/offline/sync-engine.ts`) with retry retention, acknowledgement, conflict removal, and clear-namespace recovery.
- Custom migration 0010 for the fencing token and distributed rate-limit buckets.
- v4.7 release self-test and certification gate.

## Offline contract
The client offline engine deliberately does not invent a server-side conflict policy. A product feature supplies a `SyncTransport`; the engine persists local state and mutations while offline and retains failed operations until the transport acknowledges or classifies them as conflicts. This prevents silent data loss.

## Production requirements still external
Full dependency-complete certification still requires a network-enabled environment to regenerate `pnpm-lock.yaml` with `@playwright/test`, then frozen install, Chromium installation, TypeScript/lint/Vitest/Playwright execution, and a real Docker Android build with signing. No sandbox-only test may be represented as a real APK/AAB certification.

## Required production settings
- `NATIVE_BUILD_EXECUTION_MODE=docker`
- `API_RATE_LIMIT_DISTRIBUTED=true`
- valid `DATABASE_URL` / build database
- strong JWT/OAuth/build/artifact secrets
- provisioned Docker + JDK + Android SDK + signing profile

## Release principle
**NO FAKE PASS. NO SILENT OMISSION. NO STALE WORKER MUTATION. NO SILENT OFFLINE DATA LOSS.**


