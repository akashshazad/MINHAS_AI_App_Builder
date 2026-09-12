
# MINHAS AI App Builder — v3.3 Production Native Build Queue

## Goal
Upgrade v3.2's in-process build queue into a durable, lease-based worker boundary.

## Implemented
- MySQL-backed `nativeBuildJobs` durable queue.
- Atomic row claiming with `FOR UPDATE` and lease expiry.
- Worker identity, lease deadline and heartbeat timestamps.
- Recovery of abandoned starting/running jobs after lease expiry.
- Cancellation endpoint for queued/active jobs.
- Artifact manifest persistence separate from workspace lifetime.
- Bounded worker concurrency.
- Durable job state survives service restart when the configured database is retained.
- `/health` reports whether durable storage is configured.

## Security
- Existing bearer authentication remains mandatory for `/v1/*`.
- Build payload validation remains enforced by the native worker contract.
- Generated files remain untrusted and are executed only inside the isolated worker boundary.
- Signing secrets are not stored in the queue payload or project files.

## Truth boundary
This is durable queue infrastructure, not proof of a live production worker cluster. HA, crash recovery and APK/AAB certification require an actual deployed database, at least one provisioned worker, Android SDK/JDK, dependency access, signing configuration for release builds, and an end-to-end build test.


