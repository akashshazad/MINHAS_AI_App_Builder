
# MINHAS AI App Builder 10X — v3.0.0

## Release: Dual Build Engine Architecture

### Objective
Remove the hard dependency on Expo/EAS as the only mobile build route without removing Expo support.

### Production architecture
- **MINHAS Native** — primary build engine.
- **Expo / EAS-compatible** — optional secondary engine.
- **Auto** — defaults to MINHAS Native.
- Both engines execute only through the isolated build-service boundary; generated project code is never executed inside the API/control plane.

### User controls
Every project build can select:
- Auto → Native
- MINHAS Native
- Expo / EAS

### Backward compatibility
- Expo dependencies remain intact.
- Expo Router validation remains intact.
- Existing projects are not forced to migrate.
- Existing isolated build, preview, artifact, deployment, Git/GitHub and safety gates remain in place.

### Important verification boundary
This release verifies the orchestration contract, engine selection, routing payload, UI control, and source integrity. It does **not** claim a real Android Gradle or iOS Xcode build in this sandbox because the required external build worker, SDKs, signing credentials, and dependency registry access are not available here.

A project is production-certified only after a real staging/production worker returns a successful build artifact and all required deployment/signing checks pass.


