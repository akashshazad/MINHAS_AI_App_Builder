
# MINHAS AI Builder 10X v2.1 — Next-Level Safety & Agent Workflow

## Upgrade focus

The AI coding workflow now uses **Preview → Explicit Apply** instead of automatically modifying the workspace immediately after an AI response.

### New guarantees
- AI coding requests default to `preview`.
- Preview runs persist the proposed complete-file patches and do not modify workspace files.
- The owner must explicitly apply a preview before files change.
- Applying a preview creates a restore snapshot first.
- Only files that still exist in the workspace can be applied.
- Failed application attempts restore the pre-apply snapshot.
- AI run history records preview and apply events separately.
- Existing secret/path/lockfile safety rules remain active.

## Target next-level roadmap

1. Visual point-to-edit using verified preview telemetry.
2. File-level and line-level diff viewer with accept/reject per file.
3. Multi-agent planner/reviewer/tester roles with isolated permissions.
4. Git provider synchronization with branch/commit audit trails.
5. Device/emulator test matrix for Android/iOS.
6. Collaboration roles and project permissions.
7. Native capability adapters with explicit permission contracts.
8. Release signing and store submission workflow with secret isolation.


