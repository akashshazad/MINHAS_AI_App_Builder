
# MINHAS AI App Builder — 10X v4.0.0

**Native Build Service:** MINHAS Native is the primary build engine; Expo/EAS remains optional. v3.6 adds ephemeral Android signing and an isolated Docker execution boundary; Expo/EAS remains optional.


> **MINHAS AI App Builder 10X v3.0.0 — Dual Build Engine:** MINHAS Native is primary; Expo/EAS remains optional.

# MINHAS AI App Builder — FINAL v1.3

Mobile-only AI app builder control plane using Expo + React Native + TypeScript.

**Permanent development contract:** `docs/MANUS_APP_DEVELOPMENT.md`

**Final completion record:** `docs/FINAL_COMPLETION.md`

# MINHAS AI App Builder

Production-oriented Expo mobile app and full-stack AI App Builder foundation. The project preserves an editable workspace, AI planning/generation, snapshots, review/auto-fix, isolated build/preview/deployment provider contracts, secure export, OAuth hardening, and an evidence-based production gate.

## Start here

Read [`docs/SETUP_AND_USAGE.md`](docs/SETUP_AND_USAGE.md) for extraction, dependency installation, environment configuration, database setup, local development, production lifecycle, credential rotation, and final verification.

OAuth configuration is documented in [`docs/OAUTH_CONFIGURATION.md`](docs/OAUTH_CONFIGURATION.md). The final audit is in [`docs/DEEP_AUDIT.md`](docs/DEEP_AUDIT.md).

## Honest capability boundary

The API does not execute generated code. Real build, test, preview, mobile packaging, and deployment require configured isolated providers. Unverified infrastructure is never presented as successful. Build, preview, tests, packaging, and deployment require real execution evidence before they are marked live.

## Common commands

```bash
npm install
npm run dev
npm run check
npm test
npm run lint
npm run build
```

For reproducible installs, prefer `pnpm install --frozen-lockfile` because the repository is locked with pnpm.

## 10X Builder Edition

This package extends FINAL v1.3 with a conversational coding agent, safe bounded file patches, automatic pre-task snapshots/rollback, a curated mobile template catalog, Expo Router-correct starter generation, and truthful capability reporting. See `docs/MINHAS_10X_BUILDER_ARCHITECTURE.md`, `docs/MANUS_FEATURE_PARITY.md`, and `docs/10X_AUDIT_2026-09-10.md`.


## v4.0.0 Release Control Plane
See `docs/PRODUCTION_RELEASE_V4_0.md`. v4 adds DB-backed release provenance/state, bounded queue attempts, live release certification, and security audit gates.


