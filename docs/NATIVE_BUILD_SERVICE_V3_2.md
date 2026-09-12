
# MINHAS AI App Builder — v3.2 Native Build Service

## Purpose
Turn the v3.1 native worker foundation into an independently deployable build-service boundary. The control plane submits a signed/authenticated job to `POST /v1/builds`; the service validates the worker contract, queues the job, executes the native worker, persists an artifact manifest, and exposes status through `GET /v1/builds/:id`.

## Security boundary
- The build service is a separate process and should run on a dedicated worker node/container.
- Generated project files remain untrusted.
- `/v1/*` requires `Authorization: Bearer <BUILD_SERVICE_TOKEN>`.
- Token comparison uses constant-time comparison.
- Request schema and file/path limits are enforced before execution.
- Docker reference deployment drops Linux capabilities, runs non-root, uses a read-only root filesystem and bounded CPU/PID/memory resources.
- Workspace and artifact roots are separate from the API process.
- Secrets/signing material must be injected through the worker environment/secret manager; never store them in project files or source control.

## Artifact truthfulness
The worker computes SHA-256 and byte size before cleanup. When `NATIVE_ARTIFACT_ROOT` is configured, the artifact is copied to durable artifact storage before the workspace is removed and the returned `storageKey` is the immutable job-relative key. Without artifact storage configuration, the service does **not** claim a downloadable artifact.

## API
`GET /health` is unauthenticated liveness.

`POST /v1/builds` returns HTTP 202 with `{ id, status, engine }`.

`GET /v1/builds/:id` returns status, bounded logs, error and artifact manifest.

## Current queue model
The v3.2 reference implementation uses an in-process bounded-by-provider concurrency model: jobs are retained in process memory and executed asynchronously. This is a foundation, not HA queue infrastructure. A production deployment should move job state to a durable queue/database and use a lease/heartbeat model before claiming HA guarantees.

## Current verification boundary
Static contract tests and self-tests can verify the service boundary. A real Android APK/AAB certification requires a provisioned worker with Android SDK/JDK, dependency cache/registry access, a valid signing configuration where release artifacts are required, and an actual test project executed end-to-end.


