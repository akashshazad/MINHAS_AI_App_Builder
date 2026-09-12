
# MINHAS AI App Builder v4.6.1 — Dependency Bootstrap Hardening

## Purpose
v4.6.1 addresses the identified dependency-bootstrap failure mode without modifying the lockfile by hand.

## Docker strategy
All Docker build stages pre-install the exact package manager with `npm install --global pnpm@9.12.0`. Runtime/build commands therefore do not depend on Corepack downloading pnpm at container startup.

The project still uses `pnpm install --frozen-lockfile`. This is intentional: the lockfile remains the source of truth and is never silently regenerated in CI.

## Offline strategy
For air-gapped environments, provide a complete pnpm store and run the install with `PNPM_OFFLINE=1` and `PNPM_STORE_DIR` pointing to that store. The dependency doctor verifies the store exists before the certification gate proceeds.

## Registry/proxy strategy
If an internal registry is required, configure the repository `.npmrc`/CI environment with the organization's approved registry/proxy. Do not commit credentials or tokens.

## Important limitation
The current source archive still cannot truthfully claim a dependency-complete certification unless `pnpm-lock.yaml` contains the declared `@playwright/test` package and a real dependency installation succeeds. The certification gate intentionally blocks otherwise.

## Certification order
1. `pnpm run dependency:doctor`
2. `pnpm install --frozen-lockfile`
3. `pnpm run e2e:install`
4. `pnpm run verify:full`
5. `pnpm run release:v46-certify`
6. In a provisioned native-build environment: submit a real release and verify APK/AAB hash, size, archive structure, signature and provenance.


