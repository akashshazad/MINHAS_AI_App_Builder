
# MINHAS AI App Builder v4.6.1 — Dependency-Complete E2E + Full Certification Gate

## Goal
This release upgrades v4.5 with a dependency-complete certification path: pinned Playwright test dependency declaration, browser installation command, real E2E test project, and one full release gate covering TypeScript, lint, unit tests, production bundle, E2E, preflight, production preflight, security and release self-tests.

## Certification honesty
The current sandbox cannot complete dependency installation because the pnpm executable is not locally available and Corepack cannot reach registry.npmjs.org (DNS/network unavailable). Therefore the pnpm lockfile cannot safely be regenerated here, and no fake full-certification PASS is claimed.

## Required CI/developer commands
1. `corepack enable`
2. `pnpm install --frozen-lockfile` after the lockfile has been updated with `@playwright/test` in a network-enabled environment.
3. `pnpm run e2e:install`
4. `pnpm run verify:full`
5. `pnpm run release:v46-certify`

The certification script exits with code 2 if the lockfile is not dependency-complete.


