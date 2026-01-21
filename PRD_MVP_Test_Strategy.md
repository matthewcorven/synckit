# PRD — MVP Test Strategy (Playwright + Database Validation)

**Expectation:** every work item is fully tested with Playwright E2E and/or SQL validation.  
**Reality:** external IdP logins are brittle to automate; we need deterministic test auth for MVP.

---

## 1) Testing layers

### 1.1 Unit tests
- Backend: validators, mappings, template coordinate map integrity.
- Frontend: light unit tests for key components (optional).

### 1.2 Integration tests
- Use EF Core against a real SQL engine:
  - Local: SQL Server container preferred
  - Deployed: Azure SQL (test user) if needed
- Validate inserts and transitions.

### 1.3 Playwright E2E (mandatory)
- Run against:
  - local dev URL
  - deployed SWA URL
- Minimum suites:
  - handler flow
  - secretary flow
  - validation flow
  - smoke flow

---

## 2) Auth automation: TestAuth mode (recommended and required for MVP)

### 2.1 Requirements
Add a **TestAuth** bypass that is:
- Disabled by default in production
- Enabled only when `ENABLE_TEST_AUTH=true`
- Requires `X-Test-Auth-Secret` header value to be correct
- Allows role selection:
  - `X-Test-Role: Handler|Secretary`
- Produces a short-lived JWT accepted by the API

### 2.2 Safety controls
- In production: `ENABLE_TEST_AUTH=false`
- Additionally restrict by:
  - allowlisted IPs OR
  - `ASPNETCORE_ENVIRONMENT=Development`
- Log any TestAuth usage as security event (no PII).

**Acceptance criteria**
- When disabled, TestAuth endpoints are unreachable.
- When enabled, Playwright can login deterministically without external IdPs.

---

## 3) Playwright structure and required scenarios

### 3.1 Structure
- `/src/tests/e2e`
- `playwright.config.ts`
- Helpers:
  - `loginAs(role)` sets token/cookie for TestAuth

### 3.2 Required MVP scenarios
1) Handler: list trials → select → create draft → fill minimal required fields → accept terms → submit → confirmation.
2) Handler: save draft → reload → data persists.
3) Handler: submit missing required field → validation summary shown.
4) Secretary: list entries for trial → open detail → PDF link present.
5) Secretary: download PDF link returns 200.

**Pass gate:** suite must be green for any merge/deploy.

---

## 4) Database validation (required)

### 4.1 Assertions per submit
For EntryId:
- `Entries.Status='Submitted'` and `SubmittedAt` not null
- Terms fields populated (`TermsVersion`, `TermsAcceptedAtUtc`)
- Required fields stored
- Selections rows match expected count
- After background completion:
  - `PdfStatus='Success'`
  - `GeneratedPdfBlobUri` not null
  - Notification rows exist for handler + secretary (or EmailStatus fields show success)

### 4.2 Implementation
- Preferred: C# integration tests using connection string from env var.
- Alternate: Node script executes SQL queries and asserts results.

---

## 5) Async background work test approach
- Provide a status endpoint (secretary-only or test-only):
  - `GET /api/admin/entries/{entryId}/processing-status`
  - returns `pdfStatus`, `emailStatus`, error codes
- Playwright polls until success or timeout.

---

## 6) Telemetry validation (lightweight)
- Log must include `entryId` and `traceId`.
- Background spans must correlate to submit trace (store trace context in work item).

If full automation of telemetry queries is not feasible, document exact queries for manual verification; keep all other testing automated.

