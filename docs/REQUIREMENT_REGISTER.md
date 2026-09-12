
# MINHAS AI App Builder — Requirement Register

A requirement is complete only when implementation and verification evidence are both available. Source implementation is not substituted for runtime evidence.

| ID | Requirement | Priority | Status | Evidence |
|---|---|---:|---|---|
| REQ-001 | Real Expo + React Native + TypeScript mobile application builder scope is preserved. | Critical | IMPLEMENTED / RUNTIME VERIFICATION REQUIRED | Route/source audit |
| REQ-002 | Existing workflows remain preserved; no fake success or required placeholders. | Critical | IMPLEMENTED / RUNTIME VERIFICATION REQUIRED | Source audit + provider contracts |
| REQ-003 | Mobile Pressable controls use supported interaction styling and handlers. | High | IMPLEMENTED / STATIC VERIFIED | Source audit |
| REQ-004 | Commits, pushes, and pulls are restricted to the server-persisted checked-out branch. | High | IMPLEMENTED / RUNTIME VERIFICATION REQUIRED | `activeGitBranchId` + router enforcement |
| REQ-005 | External capability states are truthful and unavailable infrastructure is reported as blocked. | Critical | IMPLEMENTED / RUNTIME VERIFICATION REQUIRED | Provider status boundaries |
| REQ-006 | GitHub push uses optimistic remote-SHA protection and never silently overwrites remote divergence. | Critical | IMPLEMENTED / INTEGRATION TEST REQUIRED | GitHub provider + router |
| REQ-007 | Fetch/pull/reconcile uses safety snapshots and conflict blocking. | Critical | IMPLEMENTED / INTEGRATION TEST REQUIRED | `gitFetch` / `gitPull` |
| REQ-008 | Three-way merge supports insertions/deletions and blocks overlapping edits. | Critical | IMPLEMENTED / TEST EXECUTION REQUIRED | `server/git/merge.ts` |
| REQ-009 | Remote branch creation/synchronization is explicit and auditable. | High | IMPLEMENTED / INTEGRATION TEST REQUIRED | GitHub provider + events |
| REQ-010 | Release package excludes generated caches and binaries not intended as source. | High | IMPLEMENTED / STATIC VERIFIED | Packaging audit |

## Current verification boundary
The current environment has Node/TypeScript but no installed project dependencies and no working package-registry network access. Therefore dependency-backed `pnpm install`, TypeScript compilation, lint, Vitest, and production bundle are not independently re-run in this pass. This is intentionally recorded as unverified rather than PASS.


