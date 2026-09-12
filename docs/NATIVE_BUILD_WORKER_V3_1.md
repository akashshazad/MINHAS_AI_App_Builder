
# MINHAS AI App Builder v3.1 — Native Build Worker

## Objective
v3.1 moves the Native Build Engine from an orchestration-only contract to a concrete, isolated worker reference implementation. Expo/EAS remains optional and unchanged.

## Native path
`MINHAS API -> isolated worker -> materialize workspace -> optional Expo prebuild -> pnpm install -> Gradle -> artifact hash -> artifact storage`

The worker never runs generated code inside the API/control-plane process.

## Security boundaries
- no shell invocation (`shell:false`)
- command allowlist: `npx`, `pnpm`, Gradle wrapper
- path traversal blocked
- `.env*`, `.git`, `node_modules`, `dist`, and `coverage` inputs blocked
- workspace limit: 50 MiB
- file content limit: 2 MiB per file
- non-root/container execution is required by the request contract
- CPU, memory, process, timeout, network and cleanup policy are explicit
- artifact is hashed before it can be accepted

## Expo compatibility
If the selected engine is `native` and an Expo configuration exists without an `android/` directory, the worker may run `expo prebuild --non-interactive --clean` inside the isolated workspace. This does not convert the project to Expo as the build engine; Expo is only used as a compatibility/prebuild step.

If the user selects `expo`, the existing Expo/EAS-compatible provider remains the separate optional path.

## Honest verification boundary
This repository contains the worker implementation and security contract. A real APK/AAB PASS still requires a provisioned Linux worker image with JDK, Android SDK, Gradle tooling, package dependencies, signing material, artifact storage, and a staging/production test project. Until those external dependencies are exercised, the product must report `NOT_VERIFIED`, never fake success.


