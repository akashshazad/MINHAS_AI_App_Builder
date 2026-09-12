
# MINHAS AI App Builder 10X — v3.4.0

## Production Native Artifact & Worker Hardening

v3.4 extends v3.3 with durable local artifact storage, SHA-256 preservation, HMAC-signed short-lived artifact URLs, expired-worker lease recovery, and artifact persistence before the native workspace cleanup boundary.

### Security
- Artifact keys are validated and traversal-resistant.
- Download signatures are HMAC-SHA256 and short-lived.
- Signing secrets are environment configuration only.
- Artifact filenames are sanitized in Content-Disposition.
- Native worker remains isolated and non-root by contract.

### Truth boundary
This release is production infrastructure code, not a claim that a live Android APK/AAB has been built in this sandbox. Real certification still requires provisioned Docker workers, Android SDK/JDK, dependencies, signing secrets, durable DB/object storage, and an end-to-end Android project build.


