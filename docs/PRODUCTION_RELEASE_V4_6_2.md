
# MINHAS AI App Builder v4.6.3 — Final Production Gate

v4.6.3 is the final production-gate release candidate. It preserves the v4.6.1 dependency-bootstrap hardening and fixes the standalone E2E runner import/version guard.

## Production gate

The project is **NOT marked production-certified by source packaging alone**. The final gate intentionally blocks until the dependency lockfile contains Playwright and the dependency-complete verification actually runs.

Required sequence in a network-enabled CI/staging environment:

1. Install pnpm 9.12.0.
2. Run `pnpm install` to regenerate `pnpm-lock.yaml` with `@playwright/test`.
3. Run `pnpm install --frozen-lockfile`.
4. Run `pnpm run e2e:install`.
5. Run `pnpm run release:final-gate`.
6. Run live release certification against provisioned staging infrastructure.
7. Verify real APK/AAB artifact structure, SHA-256, signing, archive integrity, publication and health.

No lockfile is hand-edited and no PASS is emitted when a required dependency or live environment is missing.

## Current sandbox limitation

This packaging environment has no pnpm executable, no installed node_modules/Playwright browser, and cannot complete a real Docker/Android release. Therefore the final production gate remains intentionally BLOCKED here.


