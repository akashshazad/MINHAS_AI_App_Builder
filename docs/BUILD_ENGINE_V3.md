
# MINHAS AI App Builder v3.0 — Dual Build Engine

## Decision
Expo is not removed. It is a first-class optional build engine. MINHAS Native is the primary engine.

### Engines
- **MINHAS Native** — primary isolated worker contract. Android uses Gradle; iOS uses Xcode. Expo projects may be prebuilt into native projects inside the isolated worker.
- **Expo / EAS-compatible** — optional compatibility worker for projects that intentionally choose the Expo/EAS path.
- **Auto** — currently resolves to MINHAS Native.

## Safety
Generated project code is never executed in the API/control-plane process. Both engines must execute in the isolated build service with non-root, resource limits, cleanup, and network policy.

## Worker contract
The build service receives `engine: native | expo` and must return a real build job ID. A build is only marked passed after the worker reports success and, where applicable, a verified artifact.

## Migration
Existing projects remain compatible. Existing Expo Router validation is preserved. No existing Expo dependencies are removed in v3.0.

## Verification status
This release adds the orchestration contract and UI selection. Actual native Gradle/Xcode builds still require a configured isolated worker and real Android/iOS signing infrastructure; those are not claimed as verified inside this development environment.


