
# MINHAS AI App Builder v4.3.0 — Production Operational Safety

## Purpose
v4.3 closes operational race and abuse-resilience gaps found during the 10X review of v4.2.

## Added
- Liveness endpoint separate from infrastructure readiness.
- Bounded in-process API rate limiting; production multi-instance deployments must also enforce a shared edge/API-gateway limit.
- Idempotency-Key support for build and release submission, with request fingerprint conflict detection.
- Terminal release immutability for `published` and `rolled-back` records.
- Bounded worker concurrency and lease configuration.
- Serialized custom migration execution using MySQL advisory locking.
- Dedicated idempotency persistence migration contract for production deployments.

## Honest boundary
The in-process rate limiter is intentionally not claimed as a distributed HA limiter. For multiple service replicas, configure a shared gateway/WAF/API limiter. Live MySQL, Docker, Android, signing, TLS and artifact infrastructure still require staging/production execution evidence.

## Required gates
1. Apply migrations including `0010_production_operational_safety_v43.sql`.
2. Run dependency-complete `pnpm run verify:production`.
3. Run `pnpm run release:v43-selftest`.
4. Run the live certification flow against staging with real Docker/Android/signing infrastructure.
5. Verify liveness (`/live`) and readiness (`/health`) independently through the deployment platform.

## v4.4 readiness additions

This release adds the production-safety structure requested for E2E, formatting/hooks, i18n, state management, monitoring, and security middleware. Playwright browser binaries are deliberately not vendored; the E2E gate is BLOCKED (non-zero) until CI installs the approved Playwright package/browser in a network-enabled environment.


