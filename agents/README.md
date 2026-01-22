# Autonomous agent coordination

This repo is intended to be built by **two autonomous AI coding agents** working in parallel.

## Roles (initial)
### Agent A — UI-first iteration
Goal: maximize early iteration on on-screen registration form UX.
- Angular shell + routing
- Trial selection UI
- Registration form layout matching the left-half of the official PDF
- Grid interaction UX + validation feedback
- Playwright E2E that drives the UI

### Agent B — Platform foundations
Goal: unblock integration and deployment.
- .NET API scaffold + conventions
- AuthN/AuthZ + TestAuth mode
- EF Core schema + migrations + seed trials
- Background processing (Channels) scaffolding
- Infra (Bicep) scaffold + deploy scripts

## Collaboration rules
- Prefer narrow PRs and frequent merges.
- Treat API contract in docs/prd/PRD_MVP_API_Contract.md as authoritative unless explicitly updated.
- If an agent needs a contract change, open a work item first and update the PRD (don’t silently drift).

## Shared definitions
- MVP = left-half form + terms + DB insert + PDF gen + email + secretary portal.
- MVP+ = anything not required to submit an ASCA entry and deliver a PDF + notifications.
