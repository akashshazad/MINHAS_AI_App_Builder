
# MINHAS AI App Builder — v3.5.0 Production Worker Orchestration

## Delivered
- Durable worker registry in the native build service database.
- Worker registration with lease/heartbeat timestamps.
- Worker state reporting (`ready`, `busy`, `draining`) through `/health`.
- Graceful worker deregistration on service stop.
- Queue worker heartbeat remains independent from individual build leases.
- Build cancellation now propagates an AbortSignal to the native command process and terminates the active child process.
- Existing durable job claiming, expired-lease recovery, artifact integrity and signed artifact URL boundaries are preserved.
- Existing Expo/EAS secondary engine is preserved; MINHAS Native remains primary.

## Security
- Worker identifiers are server-generated UUID-based values.
- No signing keys or credentials are persisted by the registry.
- Generated code remains inside the native worker sandbox.
- Cancellation kills the active child process rather than merely changing database status.

## Verification boundary
Static/self-tests verify worker-registry and cancellation contracts. This release is **not** a live Android build certification. Real APK/AAB certification still requires provisioned Docker workers with Android SDK/JDK, dependency access, signing secrets from a secret manager, a real Android project, and an end-to-end execution.


