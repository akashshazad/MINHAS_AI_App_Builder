
# MINHAS AI App Builder — v2.6 Git/GitHub + 10X Deep Audit

## Purpose
v2.6 adds a real version-control domain on top of the v2.5 snapshot foundation and performs a zero-omission audit pass. It does not claim remote GitHub success when credentials or the remote service are unavailable.

## Implemented
- Persisted Git repositories, branches, commits and pull requests.
- Snapshot-backed local branch heads and commits.
- Safe checkout with a pre-checkout restore snapshot.
- Deterministic SHA-256 tree hashes.
- Three-way merge classification: unchanged, one-sided change, identical change, deletion, and conflict.
- Conflict state is persisted and blocks merge.
- Protected branches (`main`, `master`, `release`) require a passed test run and clean security scan before merge.
- Local pull-request review and safe merge workflow.
- Real GitHub REST adapter for repository discovery, branches, atomic tree/commit push, and remote pull requests.
- GitHub token is server-side only; it is never persisted in project data or sent to the mobile client.
- Explicit blocked state when `GITHUB_TOKEN` is not configured.
- Expo Router validation corrected: `app/_layout.tsx`, `app/index.tsx`, and `app.json`/`app.config.ts` are checked instead of obsolete `src/App.tsx` / `src/main.tsx`.
- Version Control mobile screen with connection, branches, checkout, commit, PR and merge controls.

## Remote limitations
GitHub operations are real API calls but require `GITHUB_TOKEN`. The current adapter intentionally does not fake clone/pull or fabricate remote commit state. A future provider can add authenticated remote synchronization and webhook reconciliation once those contracts are required and available.

## 10X audit rule
The project remains **NOT COMPLETE** whenever a required capability is blocked by missing infrastructure. A blocked provider is not converted to PASS/READY merely because its UI exists.


