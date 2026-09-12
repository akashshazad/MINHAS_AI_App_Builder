
# MINHAS AI App Builder 10X v3.6.0 — Native Signing + Docker Execution Boundary

v3.6 adds two production boundaries:

1. Ephemeral Android signing material: keystores are loaded from environment-backed secret material, written only to a temporary 0600 file, used for a build, and removed in `finally`.
2. Docker execution plan: native builds can run in an isolated Docker worker with read-only root filesystem, all Linux capabilities dropped, no-new-privileges, PID/memory/CPU limits, and deny-by-default networking.

## Signing

Use profile-specific environment variables such as `ANDROID_SIGNING_RELEASE_STORE_BASE64`, `ANDROID_SIGNING_RELEASE_STORE_PASSWORD`, `ANDROID_SIGNING_RELEASE_KEY_ALIAS`, and `ANDROID_SIGNING_RELEASE_KEY_PASSWORD`.

Signing secrets must not be committed, logged, persisted in project files, or returned by APIs.

## Docker

`createDockerExecutionPlan` is a deterministic execution boundary. The actual Docker host, image registry, Android SDK/JDK image, and signing secret manager remain deployment concerns. A self-test validates security flags but does not claim a live Android build.

## Verification boundary

No live APK/AAB certification is claimed until a provisioned Linux worker executes a real Android project through Docker, signs it with a controlled release profile, stores the artifact, and verifies the SHA-256 digest end-to-end.


