
# MINHAS AI Builder — Manus Feature Parity Matrix

This matrix compares the current MINHAS architecture with publicly described Manus mobile/app-builder capabilities. It is used as an engineering checklist, not as a claim that MINHAS is affiliated with Manus.

| Capability | MINHAS status | Evidence / contract |
|---|---|---|
| Natural-language app creation | Implemented | AI project planning |
| Full mobile app generation | Implemented | Expo Router starter workspace + editable files |
| Conversational iteration | Implemented | Coding-agent task runner with Preview → Explicit Apply safety gate |
| Real code workspace | Implemented | Project file explorer/editor |
| AI review and auto-fix | Implemented | Bounded review/fix + snapshots |
| Autonomous execution | Implemented | Persisted software-factory pipeline |
| Native-device capability planning | Supported by plan | Expo/React Native target; real adapter required per capability |
| Authentication integration | Provider contract | OAuth/configuration boundary |
| AI integrations | Provider contract | AI service/model boundary |
| Live preview | Provider contract | Isolated preview runtime + health check |
| Build artifacts | Provider contract | Isolated build service + artifact metadata |
| Deployment | Provider contract | Deployment service + post-deploy health check |
| Code export | Implemented | Secure ZIP export |
| Version restore | Implemented | Project snapshots |
| Visual point-to-edit | Extension contract | Requires verified preview interaction telemetry |
| Collaboration | Extension contract | Requires shared-session/permission service |
| Analytics | Extension contract | Requires app telemetry service |
| Custom domains | Not applicable to mobile-first target | Mobile app distribution uses app-store/build artifacts instead |
| Web/Slides/Video/Image builder | Intentionally out of scope | MINHAS Builder is mobile-app focused |

## Design principle

MINHAS should not copy another product's proprietary implementation. It should match or exceed the useful user-facing workflow with its own architecture, security boundaries, and verifiable execution model.


