
# MINHAS AI App Builder — Production Hardening v2.7.0

## Scope
This release hardens the v2.6 Git/GitHub foundation for production-oriented use without removing existing mobile app-builder capabilities.

### Production fixes
- Server-persisted active Git branch; commits and pushes are rejected unless the target branch is checked out.
- Remote branch metadata: upstream, remote SHA, last fetched SHA, and sync state.
- Remote fetch and pull/reconciliation procedures with pre-pull safety snapshots.
- Remote SHA optimistic-concurrency protection; stale/diverged pushes are blocked.
- Remote branch creation when GitHub is connected; failures remain explicit and auditable.
- Atomic GitHub tree/commit pushes with deletion propagation.
- GitHub API URL allowlist and bounded retry/backoff for rate limits/transient failures.
- Remote repository/tree/file count limits to prevent uncontrolled resource consumption.
- Improved three-way merge that handles insertions/deletions and blocks overlapping edits instead of silently overwriting.
- Push records persisted as local commit metadata with remote SHA and push state.
- Mobile Version Control screen exposes Fetch, Pull, and Push actions.
- Release packaging excludes `.expo/cache` and other generated cache artifacts.

## Verification truth
Static structure and source-level checks are performed in this environment. Full dependency-backed TypeScript, lint, automated test, and production bundle execution are **not claimed as passed** when the dependency installation is unavailable. Real GitHub/OAuth/database/build/deployment verification remains environment-dependent and must be evidenced by the configured provider at deployment time.

## Production gate
A release is production-ready only after all applicable gates are executed in the target CI/CD environment:
1. Frozen dependency install from `pnpm-lock.yaml`.
2. TypeScript check.
3. Lint.
4. Full Vitest suite.
5. Server production bundle.
6. Preflight/security scan.
7. Database migration against a disposable/staging database.
8. GitHub integration test with a dedicated test repository/token.
9. Android/iOS build verification in an isolated build service.
10. Preview health verification.
11. Deployment health verification and rollback evidence.

No unavailable external gate is represented as PASS.


