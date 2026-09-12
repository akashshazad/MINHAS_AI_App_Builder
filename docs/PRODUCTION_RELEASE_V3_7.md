
# Production Release v3.7.0

## Scope
- Docker-native worker execution adapter
- Isolated worker image definition
- Secure secret-file handoff for Android signing
- Result-file contract and cleanup
- Existing queue, lease, artifact, signing, and Expo-secondary architecture preserved

## Verification
- Native build execution self-test: PASS
- Existing static/self-test suite: expected to run through `verify:production` when dependencies are installed
- Full TypeScript/lint/test/build and live Android execution are environment-dependent and are not claimed here without execution evidence.

## Release boundary
v3.7.0 is not final certification. Final requires live end-to-end APK/AAB execution and production security/regression audits.


