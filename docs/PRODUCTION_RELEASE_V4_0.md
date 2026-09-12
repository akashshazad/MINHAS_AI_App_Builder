
# MINHAS AI App Builder v4.0.0 — Production Release Control Plane

## Purpose
v4.0 adds a DB-backed release control plane, immutable release provenance fields, terminal-state protection, bounded build attempts, a live certification harness, and source security audit gates.

## Release lifecycle
`draft -> queued -> building -> verified -> published` with explicit `blocked` and `rolled-back` states. `published` and `rolled-back` are terminal and cannot be silently overwritten.

## Provenance
Each release records project, build type, native engine, request SHA-256, job/worker identifiers, artifact SHA-256/bytes, timestamps, and optional version.

## Live certification
Run `pnpm run release:live <request.json>` against a real configured build service. The command requires `BUILD_SERVICE_URL` and `BUILD_SERVICE_TOKEN`, submits a real build, polls it, obtains a signed artifact URL, downloads the artifact, verifies SHA-256/size, and validates archive integrity. It exits non-zero on any failure. It never emits a live PASS without a real artifact.

## Security audit
`pnpm run security:audit` checks source for common hardcoded secrets, unsafe process execution patterns, and dangerous Docker isolation flags. Findings are evidence only; production CI should fail on critical/high findings.

## Queue reliability
Native build jobs have a bounded `BUILD_MAX_ATTEMPTS` (default 3). Expired leases are requeued only while attempts remain; exhausted jobs become failed. This prevents infinite retry loops.

## Database migration
`db/migrations/004_native_build_v4.sql` defines the release table and retry column. Runtime bootstrap remains for backward compatibility, but production deployments should use the migration runner.

## Honest certification rule
The repository can be statically/self-test certified in this environment. A production Android APK/AAB is **not** certified until a real Linux/Docker worker with JDK, Android SDK, dependencies, signing profile, artifact storage, and a reachable build service produces and verifies the artifact.


