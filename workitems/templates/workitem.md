# {WI-ID}: {Title}

**Owner:** {Agent/Name}  
**Status:** Proposed | Ready | In-Progress | Blocked | Done  
**Milestone:** {M0 | M1 | M2 | M3 | M4 | M5 | N/A}  
**Dependencies:** {WI-IDs or none}
**Artifacts folder (recommended):** `../artifacts/{WI-ID}/` (relative to the work item file)

## Goal
{1-2 sentences}

## Scope
### In
- 

### Out
- 

## Implementation notes
- API contract: follow [docs/prd/PRD_MVP_API_Contract.md](../../docs/prd/PRD_MVP_API_Contract.md)
- Errors: RFC 7807 ProblemDetails (`application/problem+json`); use `errors` map for validation; use stable `errorCode` for non-validation.
- Correlation: every response includes `x-support-id`; ProblemDetails includes matching `traceId`.
- TestAuth (E2E): `POST /api/testauth/token` is gated and disabled by default; when disabled return 404; when enabled require `X-Test-Auth-Secret` + `X-Test-Role: Handler|Secretary`.
- Async work: tests poll `GET /api/admin/entries/{entryId}/processing-status` until terminal `Success|Failed` (don’t use sleeps).
- Logging: no PII (emails, phones, addresses, breeder names, etc.); rely on `errorCode` + `traceId`/support id.

## Acceptance criteria
- 

## Test Plan
### Unit tests (TDD)
**Artifact requirements**
- Include evidence for any non-trivial logic changes (at minimum: test names + results; optionally coverage).

**Artifacts (add as relative links during work)**
- 

### Integration tests (BDD)
**Artifact requirements**
- Capture representative request/response evidence (including ProblemDetails on failure cases).
- Capture any DB assertions output used to validate behavior.

**Artifacts (add as relative links during work)**
- 

### E2E (BDD, Playwright)
**Artifact requirements**
- Include Playwright trace for at least one green run of the primary scenario.
- Include screenshot(s) for key UI states (happy path + at least one validation/error state).

**Artifacts (add as relative links during work)**
- Example: `../artifacts/{WI-ID}/playwright/{date-or-run}/trace.zip`
- 

### DB verification
**Artifact requirements**
- Include the exact verification query set and the output (or a deterministic script output) used to validate invariants.
- If schema/constraints change, include the migration name/id and any relevant generated SQL.

**Artifacts (add as relative links during work)**
- Example: `../artifacts/{WI-ID}/db/verification-output.txt`
- 

### Telemetry verification
- Verify `x-support-id` is present on success and error responses, and matches ProblemDetails `traceId`.
- Verify key spans exist and are correlated (e.g., `Entry.CreateDraft`, `Entry.Update`, `Entry.Submit`, `Pdf.Generate`, `Email.Send`) with required tags; verify no PII is emitted.

**Artifact requirements**
- Include a screenshot/export of at least one representative trace (success path) showing required spans and key tags.
- If validating metrics, include the query (or dashboard screenshot) demonstrating the metric exists and changes as expected.

**Artifacts (add as relative links during work)**
- Example: `../artifacts/{WI-ID}/telemetry/appinsights-trace.png`
- 

## Risks / Questions
- 
