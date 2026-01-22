# PRD — MVP Work Items (Sequential Execution Order)

This defines the implementation order and detailed Definition of Done per item.  
**Mandatory rule:** no work item is complete without required tests and telemetry updates.

---

## Global Definition of Done (applies to every work item)
- ✅ Code implemented and reviewed
- ✅ Playwright E2E added/updated for impacted flow (unless infra-only)
- ✅ DB validation assertion added/updated for persistence changes
- ✅ OpenTelemetry spans/logs/metrics added for new behaviors
- ✅ No PII logged
- ✅ Feature flags used when needed; defaults safe

---

## 0) Repo + baseline build

### WI-0.1 Create repo structure
**Deliverables**
- `/src/web` Angular 22
- `/src/api` .NET 10 Web API
- `/src/tests/e2e` Playwright (TS)
- `/infra` Bicep
- Root scripts: `build.ps1` / `build.sh` (optional)

**Acceptance criteria**
- Angular builds locally
- API runs locally
- Playwright can run a smoke test that loads the site

**Tests**
- Playwright: `smoke.spec.ts` loads landing page and asserts main shell renders.

---

## 1) Azure infrastructure (CLI + Bicep)

### WI-1.1 Bicep: RG + SWA + App Service + SQL + Storage + KV + App Insights + ACS Email
**Deliverables**
- `/infra/main.bicep` and `/infra/params.mvp.json`
- `/infra/scripts/deploy.ps1` with `az deployment group create`

**Acceptance criteria**
- One command provisions/updates infra idempotently
- Outputs include URLs and resource names

**Tests**
- API `/health` returns 200 in Azure
- Storage connectivity check endpoint or script
- SQL connectivity check endpoint or script

### WI-1.2 App configuration wiring via Key Vault
**Deliverables**
- Key Vault secrets set
- Web App config reads secrets (Key Vault references or injected at deploy)

**Acceptance criteria**
- API reads SQL and Storage connection successfully in Azure

**Tests**
- Integration: simple DB query on startup/health details (non-PII)

---

## 2) AuthN/AuthZ (Entra External ID)

### WI-2.1 JWT auth and role policies
**Backend**
- JWT bearer validation
- Authorization policies: `HandlerOnly`, `SecretaryOnly`

**Frontend**
- MSAL setup (login/logout)
- Token acquisition to call API

**Acceptance criteria**
- Handler-only endpoint returns 200 for handler, 403 for secretary-only, 401 for anonymous

**Tests**
- Integration tests for policy enforcement
- Playwright uses the auth testing method defined in Test Strategy PRD

### WI-2.2 User provisioning + secretary allowlist
**Deliverables**
- `Users` table (subject/email/role)
- Allowlist config `SECRETARY_EMAIL_ALLOWLIST`

**Acceptance criteria**
- First login upserts user
- Secretary allowlist assigns Secretary role

**Tests**
- DB validation: user row exists and role matches allowlist behavior

---

## 3) EF Core code-first schema + seeds

### WI-3.1 Entities + migration + seed trials
**Entities**
- Trials, Users, Entries, EntrySelections, Notifications

**Acceptance criteria**
- DB created via migration
- Trial seed rows exist

**Tests**
- Integration: apply migration, query trials count > 0

---

## 4) Trial selection UI + API

### WI-4.1 Trials API
- `GET /api/trials` returns active trials
- `GET /api/trials/{id}` returns detail

**Acceptance criteria**
- Angular displays trial list and can select one

**Tests**
- Playwright: trial list shows seeded items

---

## 5) Entry draft creation + edit (left-half)

### WI-5.1 Create draft entry
- `POST /api/entries` with `trialId`

**Acceptance criteria**
- Entry row created in SQL with Draft status and CreatedByUserId

**Tests**
- Integration: insert and read entry
- Playwright: select trial → starts entry

### WI-5.2 Update entry fields
- `PUT /api/entries/{entryId}` for left-half fields

**Acceptance criteria**
- Fields persist; reload restores

**Tests**
- Playwright: fill fields → save → reload page → values present
- DB validation: entry row values match

### WI-5.3 Update grid selections
- `PUT /api/entries/{entryId}/selections`
- Enforce disabled cell rules

**Acceptance criteria**
- Disabled cells rejected
- Stored selections reflect UI toggles

**Tests**
- Playwright: toggle grid marks, save, reload, marks persist
- DB: verify selection rows exist and match count

---

## 6) Terms UX + acceptance recording

### WI-6.1 Terms endpoint + UI gating
- `GET /api/terms/current` returns `{version, html}`
- UI displays terms; checkbox gates submit

**Acceptance criteria**
- Submit blocked without acceptance

**Tests**
- Playwright: submit disabled until checked

---

## 7) Submission + validation

### WI-7.1 Submit endpoint
- `POST /api/entries/{entryId}/submit`
- Validates required fields and selections
- Stores TermsAcceptedAtUtc + TermsVersion + TermsAcceptedByUserId, marks Submitted
- Allocates per-trial sequential Registration/Tracking # on submit (concurrency-safe; idempotent on retries)
- Enqueues PDF + email work items (Channels)

**Acceptance criteria**
- Invalid submit returns ProblemDetails field errors
- Successful submit returns confirmation with EntryId and SupportId

**Tests**
- Playwright: negative validation case
- Playwright: success case
- DB: status becomes Submitted and terms fields populated

---

## 8) PDF generation (Channels + template)

### WI-8.1 Template asset packaged
- Official PDF stored in API assets
- Form template key constants (organization/sport/form/version)

**Acceptance criteria**
- API can load template at runtime in Azure

**Tests**
- Unit test: template load succeeds

### WI-8.2 PDF stamping implementation
- Deterministic blob name by EntryId
- Update Entries with PdfStatus and GeneratedPdfBlobUri

Notes
- PdfStatus should support non-terminal states (`Queued`, `InProgress`) plus terminal (`Success`, `Failed`).

**Acceptance criteria**
- Generated PDF exists and is accessible via SAS URL

**Tests**
- Integration: submit → poll status → assert PdfStatus=Success and blob exists
- Optional: text extraction contains known values for one test case

---

## 9) Email confirmations (Channels + ACS Email)

### WI-9.1 Email sender
- Sends to handler email + trial secretary email
- Stores notification attempt rows, idempotent by EntryId + recipient type

**Acceptance criteria**
- Notifications recorded and status exposed

Notes
- Email delivery should be tracked per-recipient via Notifications (Handler + Secretary), with non-terminal (`Queued`, `InProgress`) and terminal (`Success`, `Failed`) states.

**Tests**
- Integration: notification rows written (use provider stub or sandbox)
- Playwright: confirmation page shows email status (optional)

---

## 10) Secretary portal MVP

### WI-10.1 Secretary list + detail
- `GET /api/secretary/entries?trialId=...`
- `GET /api/secretary/entries/{entryId}`
- `GET /api/secretary/entries/{entryId}/pdf` returns SAS link

**Acceptance criteria**
- Secretary can browse and download PDF

**Tests**
- Playwright: secretary views list and opens detail

---

## 11) Observability hardening (must-have)

### WI-11.1 OpenTelemetry + correlation
- Traces: ASP.NET Core, EF Core, HttpClient, Azure SDK
- Custom spans: Entry.Submit, Pdf.Generate, Email.Send
- Metrics: queue lengths, success/fail counters
- Logs: include traceId + entryId; no PII

**Acceptance criteria**
- Single correlated trace for submit → pdf/email exists in App Insights

**Tests**
- Documented telemetry query + optional scripted check if feasible

---

## 12) Release readiness
- Rate limiting on submit
- CORS restricted to SWA
- SAS TTL controlled
- TestAuth disabled by default

**Acceptance criteria**
- MVP checklist complete and recorded

