# PRD — MVP API Contract (REST) + Error/Telemetry Conventions

**Target stack:** Angular 22 (SWA) + .NET 10 Web API  
**Purpose:** Remove ambiguity for AI agents implementing the MVP by specifying endpoints, DTOs, error formats, auth rules, and telemetry conventions.

---

## 1) Global conventions

### 1.1 Base URL and routing
- All API endpoints are served under: `/api`
- JSON only (UTF-8)
- Request/response content type: `application/json`
- Error content type: `application/problem+json` (RFC 7807)

### 1.2 IDs and time formats
- IDs: GUID strings (canonical, lowercase acceptable)
- Timestamps: ISO 8601 UTC with `Z` suffix (e.g., `2026-01-21T03:14:15Z`)
- Dates (DOB, trial dates): ISO 8601 date (e.g., `2026-11-12`)

### 1.3 Authentication
- Bearer JWT: `Authorization: Bearer <access_token>`
- Roles are enforced server-side:
  - Handler
  - Secretary

### 1.4 Headers for correlation
**Response header**
- `x-support-id`: A trace identifier string used as a Support ID (map to OpenTelemetry trace id)

**Request header (optional but recommended)**
- `traceparent`: W3C trace context, if frontend provides it

---

## 2) DTOs (data contracts)

### 2.1 TrialSummaryDto
```json
{
  "trialId": "9d4a8d25-2c59-4f1f-8c79-6c63e74f5f49",
  "name": "Spring Stockdog Trial",
  "hostClub": "Example Club",
  "startDate": "2026-05-02",
  "endDate": "2026-05-03",
  "location": "Optional string",
  "secretaryEmail": "secretary@example.com",
  "isActive": true
}
```

### 2.2 EntryStatus enum
- `Draft`
- `Submitted`

### 2.3 Grid enums (Exact Cell Grid)
**GridId**
- `Upper`
- `Lower`

**Upper rows**
- `Sheep`, `Cattle`, `Ducks`, `Mixed`

**Lower rows**
- `Sheep`, `Cattle`, `Ducks`

**ColumnId (Upper)**
- `STD`, `OPN`, `ADV`, `FTD_OPN`, `FTD_ADV`,
- `DATE1_TRIAL1`, `DATE1_TRIAL2`, `DATE2_TRIAL1`, `DATE2_TRIAL2`, `DATE3_TRIAL1`, `DATE3_TRIAL2`, `DATE4_TRIAL1`, `DATE4_TRIAL2`

**ColumnId (Lower)**
- `NOV`, `WRK_JR_HNDLR`, `FEO`, `POST_ADV`, `RTD`,
- `DATE1_TRIAL1`, `DATE1_TRIAL2`, `DATE2_TRIAL1`, `DATE2_TRIAL2`, `DATE3_TRIAL1`, `DATE3_TRIAL2`, `DATE4_TRIAL1`, `DATE4_TRIAL2`

> Note: Disabled cells are enforced by server validation (see 4.3).

### 2.4 EntryCreateRequestDto
```json
{
  "trialId": "9d4a8d25-2c59-4f1f-8c79-6c63e74f5f49"
}
```

### 2.5 EntrySummaryDto (handler and secretary list views)
```json
{
  "entryId": "f3e0e855-6522-4d4b-8d9e-34e61f9a4a75",
  "trialId": "9d4a8d25-2c59-4f1f-8c79-6c63e74f5f49",
  "status": "Submitted",
  "submittedAtUtc": "2026-05-01T15:22:11Z",
  "handlerEmail": "handler@example.com",
  "dogCallName": "Ranger",
  "dogRegisteredName": "Optional",
  "pdfStatus": "Success",
  "emailStatus": "Success"
}
```

### 2.6 EntryDetailDto (full left-half form)
```json
{
  "entryId": "f3e0e855-6522-4d4b-8d9e-34e61f9a4a75",
  "trial": {
    "trialId": "9d4a8d25-2c59-4f1f-8c79-6c63e74f5f49",
    "name": "Spring Stockdog Trial",
    "hostClub": "Example Club",
    "startDate": "2026-05-02",
    "endDate": "2026-05-03",
    "secretaryEmail": "secretary@example.com"
  },
  "status": "Draft",
  "formTemplateVersion": "ASCA-2020-10-08",
  "dog": {
    "registrationOrTrackingNumber": "ASCA-12345",
    "breed": "Australian Shepherd",
    "registeredName": "Registered Name",
    "dob": "2021-04-10",
    "color": "Blue Merle",
    "callName": "Ranger",
    "sex": "Male",
    "sire": "Sire Name",
    "dam": "Dam Name",
    "breeders": "Breeder Name"
  },
  "contact": {
    "owners": "Owner One; Owner Two",
    "ownerAddress": {
      "street": "123 Main St",
      "city": "Bryan",
      "state": "TX",
      "zip": "77801"
    },
    "email": "handler@example.com",
    "phone": "555-555-5555",
    "handler": "Optional handler name",
    "membershipNumber": "Optional",
    "junior": {
      "dob": "2012-07-15",
      "memberId": "Optional"
    }
  },
  "fees": {
    "totalEntryFees": 25.0,
    "currency": "USD"
  },
  "emergencyContact": {
    "name": "Emergency Contact",
    "phoneOrNumber": "555-111-2222"
  },
  "selections": {
    "upper": [
      { "row": "Sheep", "col": "STD", "value": "X" },
      { "row": "Sheep", "col": "DATE1_TRIAL1", "value": "X" }
    ],
    "lower": [
      { "row": "Sheep", "col": "NOV", "value": "X" }
    ]
  },
  "terms": {
    "version": "v1",
    "acceptedAtUtc": null
  },
  "processing": {
    "pdfStatus": "Pending",
    "emailStatus": "Pending",
    "generatedPdf": {
      "blobUri": null,
      "downloadUrl": null
    },
    "lastError": null
  }
}
```

### 2.7 EntryUpdateRequestDto
All fields optional; only provided fields are updated.

```json
{
  "dog": {
    "registrationOrTrackingNumber": "ASCA-12345",
    "breed": "Australian Shepherd",
    "registeredName": "Registered Name",
    "dob": "2021-04-10",
    "color": "Blue Merle",
    "callName": "Ranger",
    "sex": "Male",
    "sire": "Sire Name",
    "dam": "Dam Name",
    "breeders": "Breeder Name"
  },
  "contact": {
    "owners": "Owner One; Owner Two",
    "ownerAddress": {
      "street": "123 Main St",
      "city": "Bryan",
      "state": "TX",
      "zip": "77801"
    },
    "email": "handler@example.com",
    "phone": "555-555-5555",
    "handler": "Optional handler name",
    "membershipNumber": "Optional",
    "junior": {
      "dob": "2012-07-15",
      "memberId": "Optional"
    }
  },
  "fees": { "totalEntryFees": 25.0 },
  "emergencyContact": { "name": "Emergency Contact", "phoneOrNumber": "555-111-2222" }
}
```

### 2.8 EntrySelectionsReplaceRequestDto
Replaces all selections for a grid.

```json
{
  "grid": "Upper",
  "items": [
    { "row": "Sheep", "col": "STD", "value": "X" },
    { "row": "Sheep", "col": "DATE1_TRIAL1", "value": "X" }
  ]
}
```

### 2.9 TermsDto
```json
{
  "version": "v1",
  "html": "<h1>Terms</h1><p>...</p>"
}
```

### 2.10 SubmitEntryRequestDto
```json
{
  "acceptTerms": true,
  "termsVersion": "v1"
}
```

### 2.11 ProcessingStatusDto (admin/test/secretary)
```json
{
  "entryId": "f3e0e855-6522-4d4b-8d9e-34e61f9a4a75",
  "pdfStatus": "Success",
  "emailStatus": "Success",
  "generatedPdfDownloadUrl": "https://...SAS...",
  "lastError": {
    "code": "PDF_STAMP_FAILED",
    "message": "Short message for UI; full stack in logs only."
  }
}
```

---

## 3) Endpoints

### 3.1 Health (public)
**GET** `/api/health`

**200**:
```json
{ "status": "ok", "utcNow": "2026-01-21T03:14:15Z", "version": "gitsha-or-semver" }
```

### 3.2 Trials (authenticated)
**GET** `/api/trials` (Handler or Secretary)

**200**: `TrialSummaryDto[]`

**GET** `/api/trials/{trialId}` (Handler or Secretary)

**200**: `TrialSummaryDto`

**Errors**
- 404 if not found

### 3.3 Entries (Handler)

**POST** `/api/entries` (Handler)
- Body: `EntryCreateRequestDto`

**201**:
```json
{ "entryId": "f3e0e855-6522-4d4b-8d9e-34e61f9a4a75", "status": "Draft" }
```

**GET** `/api/entries/{entryId}` (Handler; must own entry)
- Returns `EntryDetailDto`

**PUT** `/api/entries/{entryId}` (Handler; must own; only Draft)
- Body: `EntryUpdateRequestDto`
- Returns updated `EntryDetailDto`

**PUT** `/api/entries/{entryId}/selections` (Handler; must own; only Draft)
- Body: `EntrySelectionsReplaceRequestDto`
- Returns updated `EntryDetailDto` (or a smaller selections-only DTO if preferred)

**POST** `/api/entries/{entryId}/submit` (Handler; must own; only Draft)
- Body: `SubmitEntryRequestDto`
- Performs validation, stores terms acceptance, sets status Submitted, enqueues PDF + Email jobs.

**200**:
```json
{
  "entryId": "f3e0e855-6522-4d4b-8d9e-34e61f9a4a75",
  "status": "Submitted",
  "supportId": "4bf92f3577b34da6a3ce929d0e0e4736"
}
```

**Errors**
- 400 ProblemDetails with validation errors
- 409 if entry already submitted
- 403 if not owner

### 3.4 Terms
**GET** `/api/terms/current` (Handler or Secretary)

**200**: `TermsDto`

### 3.5 Secretary endpoints

**GET** `/api/secretary/entries?trialId={trialId}&status=Submitted&page=1&pageSize=50` (Secretary)

**200**:
```json
{
  "items": [ /* EntrySummaryDto[] */ ],
  "page": 1,
  "pageSize": 50,
  "total": 123
}
```

**GET** `/api/secretary/entries/{entryId}` (Secretary)
- Returns `EntryDetailDto`

**GET** `/api/secretary/entries/{entryId}/pdf` (Secretary)
- Returns a SAS download URL.

**200**:
```json
{ "downloadUrl": "https://...SAS..." }
```

### 3.6 Admin/test endpoints (MVP testability)

> If TestAuth mode is used, this section is required. Otherwise, omit.

**GET** `/api/admin/entries/{entryId}/processing-status` (Secretary or Test-only)
- Returns `ProcessingStatusDto`

**POST** `/api/testauth/token` (Test-only; gated)
- Returns a short-lived JWT for role-based testing.

---

## 4) Validation and error handling

### 4.1 ProblemDetails shape (RFC 7807)
All 400/401/403/404/409 errors use ProblemDetails.

**400 example (validation):**
```json
{
  "type": "https://example.invalid/problems/validation",
  "title": "One or more validation errors occurred.",
  "status": 400,
  "traceId": "4bf92f3577b34da6a3ce929d0e0e4736",
  "errors": {
    "dog.callName": ["Call Name is required."],
    "terms": ["You must accept the terms."]
  }
}
```

**Required behavior**
- Include `traceId` (support id) in body and `x-support-id` header.
- Use stable `errorCode` on non-validation errors:
  - e.g. `ENTRY_NOT_FOUND`, `ENTRY_FORBIDDEN`, `ENTRY_ALREADY_SUBMITTED`

### 4.2 Disabled grid cells
Server rejects any selection that targets disabled coordinates.

**Disabled cells (MVP defaults)**
- Upper grid: row=Mixed, cols in {STD, OPN, ADV, FTD_OPN, FTD_ADV}
- Lower grid: row=Ducks, cols in {POST_ADV, RTD}

Return 400 with:
- `errors.selections`: ["Selection targets a disabled cell."]

### 4.3 Email field constraint
Default MVP rule:
- `contact.email` must equal the authenticated user email.
Config override:
- `ALLOW_ENTRY_EMAIL_DIFFERENT_FROM_LOGIN=true` allows mismatch.

---

## 5) Processing and idempotency

### 5.1 PDF generation
- Deterministic blob name: `entries/{entryId}.pdf`
- If blob exists and PdfStatus=Success, do not regenerate.

### 5.2 Email sending
- Notification keys:
  - (EntryId, RecipientType=Handler)
  - (EntryId, RecipientType=Secretary)
- If already `Sent`, do not resend.

### 5.3 Status fields (recommended on Entries)
- `PdfStatus`: Pending|Success|Failed
- `EmailStatus`: Pending|Success|Failed
- `LastErrorCode`, `LastErrorAtUtc` (short, no PII)

---

## 6) Telemetry conventions (OpenTelemetry)

### 6.1 Activity/spans naming
- `Entry.CreateDraft`
- `Entry.Update`
- `Entry.UpdateSelections`
- `Entry.Submit`
- `Pdf.Generate`
- `Email.Send`

### 6.2 Required tags on key spans
- `trial.id` (GUID)
- `entry.id` (GUID)
- `entry.status` (Draft/Submitted)
- `entry.mode` (MVP: `direct`)
- `user.role` (Handler/Secretary)
- `pdf.status` (Pending/Success/Failed) on Pdf.Generate
- `email.status` (Pending/Success/Failed) on Email.Send

### 6.3 Log fields (structured)
Every log line in the above flows should include:
- `traceId`, `spanId`
- `entryId`, `trialId`
- `errorCode` (if applicable)

**PII rule**
- Never log raw email, phone, address, breeder names, etc.

---

## 7) Frontend expectations (Angular 22)

### 7.1 Correlation propagation
- Angular HttpInterceptor should attach `traceparent` if a trace context exists.
- On API error, display Support ID from:
  - `x-support-id` header OR ProblemDetails `traceId`.

### 7.2 Forms
- Must map 1:1 to DTOs and persist drafts via PUT.
- Submit uses `/submit` endpoint only when Terms accepted.

---

## 8) Acceptance criteria for this contract
- DTOs are implemented exactly or changes are documented and versioned.
- API returns ProblemDetails for all failures with traceId and stable codes.
- Playwright tests can rely on deterministic endpoints and status polling for async work.

