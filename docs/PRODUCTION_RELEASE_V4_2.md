
# MINHAS AI App Builder v4.2.0 — Production Hardening

## Scope
v4.2 hardens the v4.1 release-control foundation for production operation:
- durable worker/job state safety
- terminal job immutability
- HA worker health reporting
- release verification gates
- durable audit-event migration
- bounded signed-artifact TTL
- explicit Docker egress policy
- corrected live-release artifact lookup

## Production requirements
Before declaring a live deployment production-ready, provision and verify:
1. MySQL with migrations `0008` and `0009` applied.
2. At least one registered native worker; for HA use multiple workers.
3. `NATIVE_BUILD_EXECUTION_MODE=docker`.
4. A pinned native-builder image digest, not an unqualified mutable tag.
5. Docker runtime with read-only root filesystem, dropped capabilities, no-new-privileges, CPU/memory/PID limits.
6. If `package-registry-only` is requested, set `NATIVE_BUILDER_NETWORK_ALLOWLISTED=true` only when the configured Docker network is actually egress-restricted to approved package registries.
7. Strong random `BUILD_SERVICE_TOKEN` and `ARTIFACT_SIGNING_SECRET` stored outside source control.
8. Durable artifact storage with backup/retention policy.
9. TLS termination and network-level access control in front of the build service.
10. Run `pnpm run verify:production` in a dependency-complete CI environment and then run `pnpm run release:live <real-request.json>` against staging infrastructure.

## Honest certification boundary
The repository can prove static/self-test safeguards, but a local development environment cannot truthfully certify live Docker/Android builds, signing, MySQL failover, worker HA, TLS, artifact durability, or production deployment. Those require provisioned infrastructure and real credentials.

## Release rule
A release may enter `verified` only with all required gates:
`manifest`, `build`, `artifact`, `archive`, `security` = `PASS`, plus a valid SHA-256 and positive artifact byte size. Publication is then allowed by the release state machine.


