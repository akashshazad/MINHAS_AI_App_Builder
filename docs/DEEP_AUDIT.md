
# MINHAS AI Deep Audit

## Scope

This audit treated the existing MINHAS AI App Builder as the source of truth and used incremental changes only. Existing project planning, generated files, workspace editing, snapshots, review/auto-fix, export, deployment, authentication, and mobile navigation were preserved.

## Corrected in this iteration

| Area | Evidence-based result |
|---|---|
| Provider configuration | Centralized build, preview, deployment, artifact, AI, database, and auth status in `server/platform-config.ts`. Both specification names and existing MINHAS-prefixed names are supported. |
| Build service | Requests now use bounded timeouts, send an explicit sandbox policy, require a provider-issued build ID, and persist queued/failed state plus phase logs. A missing or failing provider cannot appear as success. |
| Preview runtime | Added persisted preview runtime records, start/status procedures, console/network/error fields, and URL health checks. A live preview is only shown after a confirmed build/provider response. |
| Deployment | Provider responses now require a deployment ID. Deployment lifecycle logs and live URL health verification are persisted. Provider failure is surfaced as a blocked/failed operation. |
| Artifacts | Added build artifact metadata for type, filename, SHA-256, byte size, version, package name, storage key, and expiry. Metadata is stored only when the external build provider confirms a passed build. |
| Existing features | Added an authenticated per-project audit endpoint and workspace summary. It reports planning, workspace, validation, snapshots, AI review, project graph, build, preview, export, and deployment as LIVE, DEGRADED, or BLOCKED based on evidence. |
| Safety | Generated code is never executed in the main API process. Provider requests are isolated-service handoffs; missing provider configuration stops the flow. ZIP traversal protections and bounded review/auto-fix remain in place. |

## Intentionally not claimed as complete

- A real isolated worker/container service still requires deployment and credentials outside this project.
- A real preview runtime still requires a configured preview provider.
- Android APK/AAB compilation, signing, and artifact upload require a configured mobile build provider.
- Automated project tests require an isolated test provider; local host execution is intentionally not used.
- Deployment adapters require configured provider credentials and provider-side health/status APIs.

## Verification

The following passed after the changes:

- `pnpm check`
- `pnpm test` — 5 test files passed, 11 tests passed, 1 auth test skipped by its existing environment guard
- `pnpm lint`
- `pnpm build`
- Additive Drizzle migration generated and applied successfully
- WebDev preview health check passed
- Mobile Settings preview captured at 375×812

## Authentication repair

The login failure was traced to the browser session lifecycle: the web client uses cookie authentication across the Expo and API subdomains, while cookie policy and reverse-proxy awareness were not robust enough for the managed HTTPS runtime. The repair enables trusted proxy handling, uses a same-site `Lax` cookie with the shared parent domain, keeps secure/httpOnly/path attributes, and surfaces OAuth configuration/opening failures in Home and Settings instead of silently swallowing them. Native Bearer-token flow remains intact.

Verification included cookie policy unit tests, TypeScript validation, the full Vitest suite, lint, production build, an unauthenticated `/api/auth/me` smoke test returning the expected 401 JSON, and OAuth portal reachability returning HTTP 200.

## OAuth configuration discovery and native hardening

The project does not use invented OAuth values. Runtime discovery found `EXPO_PUBLIC_OAUTH_PORTAL_URL=https://manus.im`, `EXPO_PUBLIC_OAUTH_SERVER_URL=https://api.manus.im`, `VITE_APP_ID=aHuZ7szCobkrp6TZiBeA3k` (mapped by `scripts/load-env.js` to the Expo public app ID during bundling), and the preview API base URL supplied by the runtime. The repository has no `eas.json`, no EAS project ID metadata, and no native credential files; the reported EAS project ID was not independently discoverable from source and was not copied into configuration.

The native lifecycle was hardened without replacing the existing auth architecture. Cold starts now validate the SecureStore Bearer token with `/api/auth/me` before restoring a user, invalid sessions clear both token and cached profile, and the OAuth callback only shows success after server validation. The existing deep-link scheme, callback route, API layer, SecureStore, auth hook, and navigation remain in place.

The OAuth portal, API health endpoint, and unauthenticated session contract were verified. A real authenticated Android login, callback, SecureStore persistence, restart, and logout cannot be truthfully claimed in this sandbox because no user authentication interaction or Android device session was available. No fake success state was added.

## Architecture-preserving final gate hardening

The existing project architecture was preserved. The hardening pass removed the Android intent-filter wildcard host, added fail-closed exact OAuth redirect validation, and prevented production callback redirects from trusting arbitrary forwarded hosts. Production configuration now requires exact `OAUTH_ALLOWED_REDIRECT_URIS` and/or `OAUTH_NATIVE_REDIRECT_URI` values; wildcard entries are rejected.

A persisted production gate was added to distinguish code presence from verified readiness. Deployment is blocked unless build, tests, security, preview, authentication, database, migration/restore evidence, export, and rollback checks pass. The gate is exposed through the protected `projects.productionGate` procedure and returns per-check evidence instead of a generic success state.

The current runtime lacks an exact OAuth redirect allowlist, so authentication and deployment remain explicitly **BLOCKED** until the deployment secret manager is configured. This is intentional and complies with the no-wildcard, no-guessed-URL requirement.

Verification completed in this pass: TypeScript check passed; 18 tests passed and 1 pre-existing auth test was skipped; lint passed with the existing module-type warning; production server build passed. The final security command is run separately as part of the release gate.


## Final hardening pass (2026-09-10)

Additional defects found and corrected after the previous hardened archive:

- Workspace regeneration is now a first-class operation. It requires explicit confirmation, creates a restore point before replacement, and invalidates stale build/preview/deployment state.
- Build polling now treats cancelled jobs as terminal. Deployment polling now treats live/cancelled deployments as terminal.
- A build artifact is now an explicit production-gate requirement and the deployment request carries the confirmed artifact ID.
- Preview URLs supplied by a build provider are health-checked before the runtime is marked live.
- Production preview gating now requires healthy runtime evidence rather than URL presence alone.
- Deployment health-check failures now downgrade the deployment to failed instead of leaving a false live state.
- The health-check helper rejects non-HTTP(S), credential-bearing, localhost, link-local, loopback, and private IPv4 targets and disables automatic redirect following.
- Credentialed CORS no longer reflects arbitrary Origin values. Production uses an exact `CORS_ALLOWED_ORIGINS` allowlist and proxy trust is bounded by `TRUST_PROXY_HOPS`.
- Production-gate migration evidence is no longer inferred from snapshot count; it is correctly represented as a restore-point check.
- Corrupt persisted project plans now fail with a controlled server error instead of an unhandled JSON parse exception.

## Verification limitation

This archive was statically re-audited in the available sandbox. Dependency installation could not be repeated because the sandbox has no registry/network access, so a fresh `npm ci`/`pnpm install` and full test/build run could not be executed in this pass. The previously recorded verification remains in this document, but the new changes should be re-run through `npm ci`, `npm run check`, `npm test`, `npm run lint`, and `npm run build` in a network-enabled development environment before release.


