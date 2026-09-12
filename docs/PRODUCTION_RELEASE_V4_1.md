
# MINHAS AI App Builder v4.1.0 — Live Certification & Release Safety

## Scope
v4.1 hardens the v4.0 release control plane with a constrained release state machine, publish/rollback endpoints, immutable artifact writes, queue terminal-state protection, and a real live certification path.

## Release states
`draft -> queued -> building -> verified -> published`

A release may be blocked from any active state. `published` may only move to `rolled-back`; `rolled-back` is terminal.

## Publication gate
Publication requires:
- state `verified`
- every release gate is `PASS`
- artifact SHA-256 exists
- artifact byte size is greater than zero

No API path should report a release as published when these conditions are absent.

## Live certification
Run:
`pnpm run release:live <request.json>`

The harness requires a configured build service token, submits through `/v1/releases`, polls the real build, validates persisted artifact metadata, downloads the signed artifact URL, recomputes SHA-256 and byte size, runs `unzip -t`, records provenance, marks the release verified, and publishes it only after all gates pass.

A missing build service, credentials, Android SDK/JDK, Docker worker, signing configuration, or real artifact causes a non-zero exit / `BLOCKED`. It never fabricates a production PASS.

## Queue safety
- bounded `BUILD_MAX_ATTEMPTS` (default 3)
- expired leases become queued until the attempt limit; then failed
- cancellation remains authoritative
- graceful service shutdown stops the queue and active builds

## Artifact safety
Artifacts use exclusive creation (`wx`). An existing artifact key cannot be overwritten.

## Infrastructure limitation
The repository can prove code-level gates and self-tests inside a dependency-complete environment. Live APK/AAB certification still requires provisioned Linux/Docker, JDK, Android SDK/build-tools, dependencies, signing material, database, and a reachable build service.


