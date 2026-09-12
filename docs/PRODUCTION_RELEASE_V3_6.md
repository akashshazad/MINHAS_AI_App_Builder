
# Production Release v3.6.0

## Scope
Native Android signing and Docker execution boundary.

## Security
- Release signing material is loaded from environment-backed secrets only.
- Keystore is written to an ephemeral 0600 path and deleted after build.
- Signing passwords are never passed on the Gradle command line and are not logged.
- Docker plan uses `--read-only`, `--cap-drop ALL`, `no-new-privileges`, PID/memory/CPU limits, and deny-by-default networking.

## Verification
Static/self-test verification is required. A live APK/AAB certification remains deployment evidence, not a source-package claim.


