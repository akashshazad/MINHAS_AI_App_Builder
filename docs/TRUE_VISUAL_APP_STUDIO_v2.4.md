
# MINHAS AI Builder v2.4 — True Visual App Studio Contract

## Objective
Provide a real, secure contract for point-to-edit using telemetry emitted by an isolated Expo/React Native preview runtime.

## Flow
Real Preview Runtime → Authenticated Telemetry → Validation → Source Mapping → AI Request → Diff Preview → Explicit Apply → Snapshot → Validation.

## Truthfulness
The control plane must never invent component coordinates or source mappings. If telemetry has not actually been emitted, the UI must say **Runtime telemetry unavailable**.

## Security
Reject malformed telemetry and unsafe source paths; never map `.env`, `.git`, or `node_modules`; require authenticated project/session ownership in production; expire stale sessions; never expose secrets; never execute generated source in the control-plane process.

## Scope
This release provides the secure bridge/schema foundation. True device-level point-to-edit must only be marked LIVE after a real isolated preview runtime is connected and verified.


