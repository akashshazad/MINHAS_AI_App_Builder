
# MINHAS AI Builder — 10X Architecture & Feature Contract

## Product position
MINHAS AI Builder is an AI-native mobile application development control plane. Its primary target is real Expo + React Native + TypeScript applications for Android and iOS.

The builder follows a conversational workflow: idea → structured plan → editable workspace → conversational coding agent → review/fix → validation → isolated build/test/security → verified preview → production gate → deployment → health verification.

## Implemented control-plane capabilities

- Natural-language mobile-app planning
- Source-language detection (English / Urdu / Roman Urdu)
- Curated mobile starter templates
- Persisted projects and workspaces
- Expo Router-compatible starter generation
- File explorer and editable source files
- Conversational coding agent with bounded patches
- Automatic pre-task restore point
- Automatic rollback on failed agent application
- AI code review and bounded auto-fix
- Project event/audit history
- Project snapshots and restore
- Project dependency/impact graph
- Autonomous software-factory pipeline
- Isolated build provider contract
- Isolated test provider contract
- Security scan evidence
- Verified preview runtime contract
- Production deployment gate
- Deployment provider contract
- Post-deployment health verification
- Secure ZIP export contract
- Artifact metadata and checksums
- Honest capability/service-health reporting

## Conversational coding agent safety

The coding agent may only patch existing workspace text/code files. The service rejects unsafe paths, secrets, environment files, binaries, dependency lockfiles, and unknown files. A restore point is created before applying patches. If an application error occurs while applying a task, the pre-task snapshot is restored.

Generated application code is never executed inside the MINHAS API/control-plane process. Builds, tests, and previews require isolated external runtimes.

## Provider boundary

External build, preview, deployment, artifact, authentication, and AI infrastructure must be configured through environment variables or approved platform integrations. MINHAS does not manufacture fake success states when those services are unavailable.

## Feature truth model

A capability is displayed as LIVE/ONLINE only when its actual evidence exists. Configuration availability is not equivalent to successful execution. A build is not a passed build until the provider confirms it. A preview is not live until health verification succeeds. Deployment is not live until provider confirmation and target health verification succeed.

## Release gate

Production release requires, as applicable:

1. passed isolated build
2. confirmed test evidence
3. security evidence with no critical/high findings
4. healthy verified preview
5. restore point
6. ready build artifact
7. deployment provider confirmation
8. target health verification

## Next-level extension contracts

The architecture is intentionally extensible for:

- visual preview inspection and point-to-edit workflows
- richer multi-agent planning
- GitHub/GitLab synchronization
- team collaboration and permissions
- integration catalog and credential vault
- analytics and application telemetry
- app-store submission automation
- native capability adapters (camera, audio, location, notifications, biometrics)
- Figma/design ingestion
- test-device farms

These are integration contracts, not claims of operational availability until the corresponding service is configured and verified.


