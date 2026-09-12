
# MINHAS AI App Builder v3.1 — Production Release

## Release focus
Concrete Native Android Build Worker foundation while preserving Expo/EAS as an optional engine.

## Acceptance gates
1. API never executes generated project code.
2. Native worker accepts only the versioned request schema.
3. Unsafe paths and duplicate files are rejected.
4. Commands are allowlisted and run without a shell.
5. Workspace and output limits are enforced.
6. Artifact SHA-256 is calculated before acceptance.
7. Worker workspace is deleted in `finally` cleanup.
8. Native Android builds use Gradle wrapper after native project detection/prebuild.
9. Expo remains an independent optional engine.
10. Live APK/AAB certification requires an actual provisioned worker and signing environment.


