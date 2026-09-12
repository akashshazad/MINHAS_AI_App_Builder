
# MINHAS AI App Builder — Setup and Usage

## 1. Extract the project

Extract the ZIP archive into a PC, Codespace, or Linux/macOS workspace and enter the project directory:

```bash
unzip MINHAS-AI-App-Builder-project-FIXED-1.zip
cd minhas-ai-app-builder
```

## 2. Install dependencies

The repository contains a `pnpm-lock.yaml`, so the reproducible installation is:

```bash
corepack enable
pnpm install --frozen-lockfile
```

If the environment only provides npm, use the checked-in npm lockfile:

```bash
npm ci
```

The matching `package-lock.json` is included for this purpose. Do not mix package managers within one installation directory.

## 3. Configure environment variables

This project intentionally does not commit an `.env` file or real credentials. Create `.env` locally and populate it from the variable contract below. Never commit `.env`, tokens, passwords, OAuth secrets, or deployment credentials.

Required core values include `VITE_APP_ID`, `OAUTH_SERVER_URL`, `JWT_SECRET`, and `DATABASE_URL`. The exact OAuth callback allowlist is mandatory for production:

```env
OAUTH_ALLOWED_REDIRECT_URIS=https://your-published-domain.example/api/oauth/callback
OAUTH_NATIVE_REDIRECT_URI=manusminhasaiappbuilder://oauth/callback
PUBLIC_APP_URL=https://your-published-domain.example
CORS_ALLOWED_ORIGINS=https://your-published-domain.example
TRUST_PROXY_HOPS=1
```

Wildcards are rejected. Configure the values in the deployment secret manager or local `.env`; do not place them in source code or an APK repository.

Provider variables are required for real isolated build, preview, and deployment flows:

```env
BUILD_SERVICE_URL=
BUILD_SERVICE_TOKEN=
PREVIEW_SERVICE_URL=
PREVIEW_SERVICE_TOKEN=
DEPLOYMENT_SERVICE_URL=
DEPLOYMENT_SERVICE_TOKEN=
```

The complete variable contract is documented in `docs/OAUTH_CONFIGURATION.md`, `.env.example`, and `server/platform-config.ts`.

## 4. Configure the database

Set `DATABASE_URL` to the development or production database, then run the existing Drizzle workflow:

```bash
pnpm db:push
# or, after npm install:
npm run db:push
```

Review migrations before applying them to production. Take a backup before destructive changes.

## 5. Run locally

Start the API and Expo web preview together:

```bash
npm run dev
```

Useful individual commands:

```bash
npm run dev:server
npm run dev:metro
npm run check
npm test
npm run lint
npm run build
npm run start
```

For native development, use `npm run android` or `npm run ios` in an environment with the relevant SDK/toolchain installed.

## 6. Production lifecycle

The intended production flow is:

```text
User Prompt
  → AI Planning
  → Code Generation
  → Editable Workspace
  → Validation
  → Isolated Build Worker
  → Artifact Validation
  → Preview Runtime
  → Health Check
  → Security/Test Evidence
  → Production Gate
  → Deployment
  → Deployment Health Check
  → LIVE
```

Generated code must never execute inside the main API process. Build, test, preview, and deployment services must be isolated provider/worker services with resource limits, timeouts, credential redaction, and persisted logs.

The deployment endpoint is protected by the final production gate. A project is not deployable merely because a button, route, database row, or provider request exists. Missing evidence returns a blocked state rather than fake success.

## 7. Credential rotation

If the original project ever contained a database password, API key, GitHub token, OAuth secret, deployment credential, or session secret, revoke and rotate it at the provider first. Removing a value from source code is not sufficient. Then update the deployment secret manager and invalidate old sessions where appropriate.

## 8. Final pre-production checklist

Run the following before deployment:

```bash
npm run check
npm test
npm run lint
npm run build
```

Then verify, using real configured services:

- OAuth exact redirect, callback, session restoration, logout, and expired-session behavior.
- Database migration, backup, restore, and rollback.
- Isolated build pass and artifact checksum/metadata.
- Preview runtime URL plus health check, console logs, and runtime error handling.
- Security scan, dependency scan, secret scan, authorization checks, and path-traversal checks.
- Export and restore evidence.
- Production-gate status is `PASS` with no critical blockers.

If any stage is unavailable, the product must display `BLOCKED` or `DEGRADED`; it must never display a fake success state.


