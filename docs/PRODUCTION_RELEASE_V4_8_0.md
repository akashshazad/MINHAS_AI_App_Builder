
# MINHAS AI App Builder v4.8.0 — Production Hardening

This release implements the selected high-value production fixes from the 10X architecture review.

## Implemented
- OAuth callback parsing uses the standard URL API with bounded parameter validation; regex parsing and delayed redirects are removed.
- OAuth success redirects immediately after the session is persisted and validated.
- OAuth logs no longer print user objects, authorization codes, state values, or session-token material.
- Native bundle/package ID is configurable through `MINHAS_APP_BUNDLE_ID` with a stable production-safe default; scheme may be overridden with `MINHAS_APP_SCHEME`.
- `.env.example` duplicate settings were removed.
- Adaptive refresh utility provides bounded non-terminal refresh intervals and stops on terminal states.

## Existing v4.7 reliability retained
Execution fencing, distributed rate limiting, offline sync foundation, durable queue, artifact verification, signing isolation, Docker execution boundaries, release control, and audit safety remain unchanged.

## Certification boundary
This source tree is statically hardened, but a true production certification still requires a dependency-complete CI/worker environment: regenerate the lockfile with Playwright, install dependencies and browser binaries, run the full verification suite, then run the live signed native APK/AAB release certification against real Docker/Android infrastructure. No sandbox-only PASS is presented as a live certification.


