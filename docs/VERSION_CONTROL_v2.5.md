
# MINHAS AI Builder 10X v2.5 — Version Control & Diff Foundation

v2.5 adds a truthful version-control layer built on persisted project snapshots.

## Capabilities

- version history from real persisted snapshots;
- deterministic SHA-256 file hashes;
- added/modified/deleted file detection;
- bounded line-change summaries;
- snapshot-to-current comparison;
- corrupted snapshot detection;
- ownership checks through the existing protected project procedures;
- audit-friendly version metadata.

## Truthfulness

This release does **not** claim GitHub synchronization merely because a local
version record exists. Real Git/GitHub operations require an authenticated Git
provider and an explicit provider contract. Until connected, the product must
show version history/diff as snapshot-backed and must not claim remote push,
pull, branch creation, or GitHub commit success.

## Next integration

A future provider adapter can add authenticated Git repositories, branches,
commits, pull requests, protected branches, and remote sync without changing
the snapshot safety boundary.


