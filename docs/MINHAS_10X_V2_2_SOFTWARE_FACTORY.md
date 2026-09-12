
# MINHAS AI Builder 10X v2.2 — Controlled AI Software Factory

v2.2 introduces a persisted, controlled multi-agent audit layer. It does not execute generated code and it does not silently modify the workspace.

## Agents
- Product Analyst
- Mobile Architect
- UI/UX Engineer
- QA Lead
- Security Engineer
- Release Engineer

## Flow
User task → six sequential specialist reviews → persisted AI run records → consolidated findings/actions/risks → owner chooses implementation through the existing safe preview/apply workflow.

Each specialist receives the approved mobile plan, bounded workspace context, and earlier specialist summaries. Agents are explicitly prohibited from claiming unverified test, build, preview, deployment, or integration success.

## Safety
The factory is advisory/audit-only. It does not mutate files. Code changes remain behind the existing AI preview → explicit apply → snapshot → stale-hash verification workflow.


