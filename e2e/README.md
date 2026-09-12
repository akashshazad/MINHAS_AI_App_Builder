
# E2E testing

The project has a Playwright E2E smoke boundary covering:

1. API liveness (`/api/health`)
2. Expo web shell boot
3. Browser `pageerror` detection

Run `pnpm run e2e` in a network-enabled environment with Playwright installed. The runner exits with a non-zero **BLOCKED** result when Playwright is unavailable; it never reports a false PASS.

The source repository intentionally does not vendor Playwright browser binaries. CI must install the pinned `@playwright/test` package and its Chromium browser during the CI dependency/bootstrap stage.


