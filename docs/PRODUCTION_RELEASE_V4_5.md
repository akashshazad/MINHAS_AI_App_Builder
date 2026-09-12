
# MINHAS AI App Builder — v4.5.0 Production Runtime Safety

## Purpose
v4.5.0 hardens the runtime control plane after v4.4.0. Existing Expo/native build architecture, E2E readiness, i18n, state management, monitoring adapter, CORS, and rate limiting are preserved.

## Changes
- Added request correlation middleware with bounded, validated `X-Request-Id` values.
- Added centralized Express error boundary with production-safe error messages and request correlation.
- Removed direct trust of client-supplied `X-Forwarded-For` from API rate-limit identity. The limiter now uses Express `req.ip`, which is governed by the application's explicit `trust proxy` configuration.
- Added a runtime safety self-test covering required middleware and monitoring/i18n/state structures.
- Extended the production verification chain with the runtime safety self-test.

## Security behavior
- Do not log secrets, tokens, passwords, cookies, or request bodies from the error boundary.
- Production responses expose a stable generic 500 message plus request ID.
- Development responses may expose the normalized error message for local debugging.
- `X-Request-Id` accepts only a bounded safe character set; invalid client IDs are replaced with a fresh UUID.
- Rate-limit identity no longer accepts a spoofable forwarded header directly.

## Verification boundary
The sandbox does not contain the project's installed `node_modules`, Android SDK, Docker daemon, or Playwright browser. Therefore this release does not claim live APK/AAB certification, live Docker execution, or successful Playwright E2E execution from this environment.

Network-enabled CI remains the authoritative place to run dependency-complete TypeScript/lint/build and browser E2E checks.


