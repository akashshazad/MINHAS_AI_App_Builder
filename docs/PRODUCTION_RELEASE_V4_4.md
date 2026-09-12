
# MINHAS AI App Builder v4.4.0 — Production Quality & E2E Readiness

## Added

- Playwright E2E structure and a fail-closed smoke runner for API health + Expo web shell.
- Canonical Prettier configuration and `.prettierignore`.
- Git pre-commit hook with lint + TypeScript gates; `prepare` installs `.husky` as Git hooks path when a repository is present.
- i18n contract with English, Urdu and Roman Urdu locale files and RTL metadata.
- Central app store/provider for cross-screen client state without replacing tRPC/React Query server state.
- Error-monitoring adapter/configuration with environment-only Sentry DSN contract; no secret is committed and no fake ingestion is claimed.
- Central Express security middleware for CORS, security headers and API rate limiting.

## E2E honesty boundary

The repository does not vendor Playwright or browser binaries. `pnpm run e2e` exits non-zero with an explicit BLOCKED result when Playwright is unavailable. CI must install the approved Playwright package/browser in a network-enabled environment before enabling the live browser gate.

## Verification

Run:

- `pnpm run feature-structure:selftest`
- `pnpm run check`
- `pnpm run lint`
- `pnpm test`
- `pnpm run build`
- `pnpm run preflight`
- `pnpm run production:preflight`
- `pnpm run security:audit`
- `pnpm run e2e`

No gate may be marked PASS unless it actually executes successfully.


