
# MINHAS AI App Builder — v3.9.0 Production Release

## Purpose
v3.9 hardens the native production path and establishes a release-certification gate without claiming a live Android build when Android/Docker infrastructure is unavailable.

## Changes
- Durable queue can execute native builds through the Docker worker boundary.
- Queue cancellation propagates to the Docker child process and preserves `cancelled` as the authoritative terminal state.
- Docker workers can persist artifacts into the host durable artifact store through an explicit `/artifacts` mount.
- Signing profiles remain ephemeral; secrets are delivered only through a temporary read-only secret file.
- Native build service has graceful SIGTERM/SIGINT shutdown hooks.
- Added `release:certify` for structural/security release gating and optional APK/AAB artifact integrity verification.

## Execution modes
- `NATIVE_BUILD_EXECUTION_MODE=docker` — force isolated Docker execution.
- `NATIVE_BUILD_EXECUTION_MODE=local` — explicit local worker execution for controlled development environments.
- Any other value leaves the compatibility default: Docker is selected when `NATIVE_BUILDER_IMAGE` is configured; otherwise local execution is retained.

## Live certification rule
A release is **not** Android-production-certified until a provisioned worker has produced the requested APK/AAB, the artifact has passed structural/integrity verification, signing has been validated, and the complete CI/regression/security gates have passed.

## Security gates
- non-root worker
- read-only container root filesystem
- dropped Linux capabilities
- `no-new-privileges`
- CPU/memory/PID limits
- bounded logs/timeouts
- deny-by-default network where applicable
- ephemeral signing material
- artifact path safety and SHA-256
- cancellation propagation

## Honest limitation
The development sandbox does not provide the external Docker/Android SDK/signing infrastructure required to claim a live APK/AAB production certification. This release therefore certifies the implementation and verification gates, not an imaginary build result.


