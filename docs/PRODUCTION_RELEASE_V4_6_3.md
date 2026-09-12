
# MINHAS AI App Builder v4.6.3 — Final Production Gate Hardening

## Status
This release is the final production-gate candidate. It does not claim live production certification until the dependency-complete and real native release gates execute in a network-enabled, provisioned environment.

## Final hardening
- Native build-service and native-worker images use Node 22 + OpenJDK 17 so `npm` and the exact `pnpm@9.12.0` bootstrap are actually available.
- Corepack is not required for pnpm bootstrap.
- Final gate requires Playwright declaration and lockfile resolution before dependency-complete certification.
- Final gate runs dependency doctor, TypeScript, lint, tests, build, Playwright E2E, preflight, production preflight, security and regression checks.
- Real APK/AAB certification remains evidence-based: signing, artifact SHA-256, archive validation, and deployment/health verification must run on provisioned infrastructure.

## Required external certification
1. `pnpm install` in a network-enabled environment to regenerate the lockfile with `@playwright/test`.
2. `pnpm install --frozen-lockfile`.
3. `pnpm run e2e:install`.
4. `pnpm run release:final-gate`.
5. `pnpm run release:live` against staging/production infrastructure.
6. Verify signed APK/AAB SHA-256, archive structure, release provenance, publication and health.

No step may be replaced with a fake PASS.


