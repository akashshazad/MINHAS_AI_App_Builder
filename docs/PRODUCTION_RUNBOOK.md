
# MINHAS AI App Builder — Production Runbook

## Release rule
A release is **PRODUCTION READY** only when every applicable gate has evidence. Missing external infrastructure is BLOCKED, never PASS.

## 1. Immutable release
- Build from a tagged commit.
- Use Node 22 and pnpm 9.12.0.
- Install with `pnpm install --frozen-lockfile`.
- Do not commit `.env`, credentials, `node_modules`, `.expo/cache`, or `dist`.

## 2. Automated gates
Run:

```bash
pnpm run check
pnpm run lint
pnpm test
pnpm run preflight
pnpm run production:preflight
pnpm run build
```

The CI workflow runs the same gates on protected branches.

## 3. Database
- Provision MySQL 8+ in a private network.
- Set `DATABASE_URL` using a secret manager.
- Apply Drizzle migrations against staging first.
- Take a backup before production migration.
- Verify rollback/restore procedure before enabling write traffic.

## 4. Authentication
Required in production:
- `OAUTH_SERVER_URL`
- `JWT_SECRET` (minimum 32 characters; use a generated secret)
- `PUBLIC_APP_URL`
- `CORS_ALLOWED_ORIGINS`
- approved OAuth redirect URIs

Never expose server secrets through `EXPO_PUBLIC_*` variables.

## 5. API deployment
The server listens on `0.0.0.0:$PORT` in production and fails readiness with HTTP 503 until database/auth prerequisites are configured.

Health endpoints:
- `/api/health` — process health
- `/api/health/ready` — deployment readiness

Use a reverse proxy/load balancer with HTTPS and set `TRUST_PROXY_HOPS` accurately.

## 6. GitHub integration
For real GitHub operations configure `GITHUB_TOKEN` server-side only. Test with a dedicated non-production repository first. Verify fetch, pull, conflict detection, push, and PR creation. Remote divergence must block destructive overwrite.

## 7. Mobile release
Use EAS profiles in `eas.json`:

```bash
eas build --platform android --profile production
eas build --platform ios --profile production
eas submit --platform android --profile production
eas submit --platform ios --profile production
```

Run release smoke tests on physical Android and iOS devices, including login/callback, project creation, AI preview/apply, rollback, Studio, Git sync, offline/error states, and logout.

## 8. Rollback
1. Stop promotion of the failing release.
2. Route traffic to the last healthy server image.
3. Restore the database only when the migration/data change requires it.
4. Restore project snapshots before any destructive workspace recovery.
5. Confirm `/api/health/ready` and authenticated smoke tests.
6. Record incident and release evidence.

## 9. Final certification
Attach CI logs, migration result, GitHub test evidence, Android/iOS build IDs, preview health evidence, deployment health evidence, and rollback evidence to the release record. Without these artifacts, status remains **RELEASE CANDIDATE / NOT LIVE VERIFIED**.


