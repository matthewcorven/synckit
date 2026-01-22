# Copilot instructions — dog-trials.com

## Big picture
- MVP is **Angular 22 (Azure Static Web Apps)** + **.NET 10 Web API** + **EF Core + Azure SQL** + **Blob PDFs** + **ACS Email** + **OpenTelemetry**.
- This repo is designed for **three AI agents** working in parallel. See [agents/README.md](../agents/README.md) for coordination rules.

## Agent identification
If you are an autonomous coding agent, **read your entry point file first** to understand your role, scope, and work items:

| Agent | Entry Point | Role | Scope |
|-------|-------------|------|-------|
| **Agent A** | [agents/STREAM_A_ENTRY.md](../agents/STREAM_A_ENTRY.md) | UI-first iteration | Angular SPA, form layout, grid UX, Playwright E2E |
| **Agent B** | [agents/STREAM_B_ENTRY.md](../agents/STREAM_B_ENTRY.md) | Platform foundations | .NET API, EF Core schema, auth, background processing, Bicep |
| **Coordinator** | [agents/STREAM_COORD_ENTRY.md](../agents/STREAM_COORD_ENTRY.md) | Workstream advisor | Status reporting, merge readiness, cross-stream dependencies (**does not write code**) |

Each coding agent (A, B) must update their progress file (`STREAM_A_PROGRESS.md` / `STREAM_B_PROGRESS.md`) throughout work. The Coordinator reads both progress files to advise the human.

## Sources of truth (read these before changing contracts)
- Canonical API/DTOs, error format, auth, telemetry tags: [docs/prd/PRD_MVP_API_Contract.md](../docs/prd/PRD_MVP_API_Contract.md)
- Test approach + required TestAuth mode for deterministic Playwright: [docs/prd/PRD_MVP_Test_Strategy.md](../docs/prd/PRD_MVP_Test_Strategy.md)
- DB-enforced constraints + retry model: [docs/review/DB_Constraints_and_Retry_Model.md](../docs/review/DB_Constraints_and_Retry_Model.md)
- Work sequencing (M0/M1/etc): [workitems/README.md](../workitems/README.md)

If you need to change the API contract, **open/update a work item and update the PRD**; don’t silently drift.

## Repo layout (intended)
- `src/web/`: Angular SPA
- `src/api/`: .NET 10 API (REST under `/api`)
- `src/tests/e2e/`: Playwright E2E (mandatory for merges)
- `infra/`: Bicep deployment (MVP infra described in [docs/prd/PRD_MVP_Azure_Infra_Deploy.md](../docs/prd/PRD_MVP_Azure_Infra_Deploy.md))

## Dev workflows (placeholders; keep docs authoritative)
- Prefer documenting real commands in repo scripts/config once they exist:
  - Web: `src/web/package.json` scripts
  - API: `src/api/*.csproj` + `src/api/README.md` (if added)
  - E2E: `src/tests/e2e/playwright.config.ts`
- If a workflow is “tribal knowledge” (local run, migrations, deploy, e2e auth), suggest adding a doc/script in-repo instead of leaving it implicit.
- Expected documentation targets (some may not exist yet — create when the first real commands land):
  - Local routing + ports: [docs/setup/Local_Dev_Routing.md](../docs/setup/Local_Dev_Routing.md)
  - Auth setup notes: `docs/setup/Auth_Entra_ExternalId.md`
  - Infra/deploy notes + commands: [docs/prd/PRD_MVP_Azure_Infra_Deploy.md](../docs/prd/PRD_MVP_Azure_Infra_Deploy.md) + `infra/` (scripts may be added later)
  - Environment variables: add a small `docs/setup/Environment.md` (future) once real env vars exist
- Expected end state (do not implement unless a work item asks): local web dev server, local API at `/api`, and Playwright uses TestAuth.

## API conventions you must follow
- All endpoints are under `/api`; JSON only.
- Errors: `application/problem+json` using RFC 7807 ProblemDetails (include validation `errors` map).
- Correlation: set `x-support-id` on every response, and include the same value as `traceId` in ProblemDetails.
- IDs are GUID strings; timestamps are UTC ISO 8601 with `Z` suffix.

When adding endpoints/DTOs, mirror the shapes and field names from the API contract PRD exactly.

## Auth + deterministic TestAuth for E2E
- Runtime auth is JWT bearer; roles are `Handler` and `Secretary`.
- E2E relies on a gated TestAuth token endpoint:
  - `POST /api/testauth/token`
  - Requires headers `X-Test-Auth-Secret` and `X-Test-Role: Handler|Secretary`
  - Must be disabled by default (`ENABLE_TEST_AUTH=false`), and unreachable when disabled (404 preferred).

## Data + DB-first integrity (SQL Server is the guardrail)
- Implement concurrency/idempotency using DB constraints and transactions; EF Core validations are not sufficient.
- Follow the exact constraints/indexes listed in [docs/review/DB_Constraints_and_Retry_Model.md](../docs/review/DB_Constraints_and_Retry_Model.md) (filtered unique indexes for nullable uniqueness, retry scan indexes).
- Submit allocates a per-trial sequence number transactionally and sets `RegistrationOrTrackingNumber` once; submit retries must not “burn” extra numbers.

## Background processing (MVP)
- MVP expects in-process background work (Channels) but **idempotent** behaviors:
  - PDF blob name is deterministic: `entries/{entryId}.pdf`
  - If PdfStatus is `Success`, don’t regenerate/resend.
  - On startup, scan for due retries using the indexed “next attempt” fields.

## Telemetry + PII
- Use OpenTelemetry span names and required tags from the API contract PRD.
- **Never log PII** (emails, phone, addresses, breeder names, etc). Use stable `errorCode` and correlate via `traceId`/Support ID.

## Local dev routing (don’t fight CORS)
- Local dev should use an Angular dev-server proxy so the SPA can call relative `/api/*` without CORS.
- See [docs/setup/Local_Dev_Routing.md](../docs/setup/Local_Dev_Routing.md).

## Testing expectations
- Playwright E2E is the merge gate (see required scenarios in [docs/prd/PRD_MVP_Test_Strategy.md](../docs/prd/PRD_MVP_Test_Strategy.md)).
- Prefer polling `GET /api/admin/entries/{entryId}/processing-status` (secretary/test-only) to deterministically wait for async PDF/email completion.
