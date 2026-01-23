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

MVP identity mapping (authoritative)
- Use JWT `sub` (subject) as the stable external identifier.
- Maintain an internal `Users` table keyed by that external subject.
- Store internal `Users.UserId` (GUID) as `Entries.CreatedByUserId` and enforce entry ownership based on it.

### 1.4 Headers for correlation
**Response header**
- `x-support-id`: A trace identifier string used as a Support ID (map to OpenTelemetry trace id)

**Request header (optional but recommended)**
- `traceparent`: W3C trace context, if frontend provides it

---

## 2) DTOs (data contracts)

### 2.0 FormTemplateKey (organization/sport/form/version)
Registration forms are versioned by their issuing organization (e.g., ASCA). The canonical identity is:
- `organizationCode` (e.g., `ASCA`)
- `sportCode` (e.g., `StockDog`)
- `formCode` (e.g., `TrialEntry`)
- `version` (e.g., `2020-10-08`)

```json
{
  "organizationCode": "ASCA",
  "sportCode": "StockDog",
  "formCode": "TrialEntry",
  "version": "2020-10-08"
}
```

### 2.1 TrialSummaryDto
```json
{
  "trialId": "9d4a8d25-2c59-4f1f-8c79-6c63e74f5f49",
  "name": "Spring Stockdog Trial",
  "formTemplate": { "organizationCode": "ASCA", "sportCode": "StockDog", "formCode": "TrialEntry", "version": "2020-10-08" },
  "organizerSlug": "EXCLUB",
  "eventSlug": "SPRING-2026-05-02",
  "trackingSlug": "OLDKYASCASPRING-2026-05-02",
  "hostClub": "Old Fashioned KY ASCA Club",
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

### 2.2.1 ProcessingStatus enums
**PdfStatus**
- `Queued`
- `InProgress`
- `Success`
- `Failed`

**NotificationStatus**
- `Queued`
- `InProgress`
- `Success`
- `Failed`

**NotificationRecipientType**
- `Handler`
- `Secretary`

### 2.2.2 NotificationDto
Used to represent per-recipient email delivery state.

```json
{
  "recipientType": "Handler",
  "status": "Queued",
  "sentAtUtc": null,
  "lastError": null
}
```

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

> Note: Disabled cells are enforced by server validation (see 4.2).

### 2.3.1 FormMetadataDto
The API is the source of truth for the supported grid layout and disabled cells.
This metadata is scoped to a specific organization/sport/form/version.

```json
{
  "formTemplate": { "organizationCode": "ASCA", "sportCode": "StockDog", "formCode": "TrialEntry", "version": "2020-10-08" },
  "grids": [
    {
      "grid": "Upper",
      "rows": ["Sheep", "Cattle", "Ducks", "Mixed"],
      "cols": ["STD", "OPN", "ADV", "FTD_OPN", "FTD_ADV", "DATE1_TRIAL1"],
      "disabledCells": [
        { "row": "Mixed", "col": "STD" },
        { "row": "Mixed", "col": "OPN" },
        { "row": "Mixed", "col": "ADV" },
        { "row": "Mixed", "col": "FTD_OPN" },
        { "row": "Mixed", "col": "FTD_ADV" }
      ]
    },
    {
      "grid": "Lower",
      "rows": ["Sheep", "Cattle", "Ducks"],
      "cols": ["NOV", "WRK_JR_HNDLR", "FEO", "POST_ADV", "RTD", "DATE1_TRIAL1"],
      "disabledCells": [
        { "row": "Ducks", "col": "POST_ADV" },
        { "row": "Ducks", "col": "RTD" }
      ]
    }
  ]
}
```

### 2.3.2 TrialRegistrationMetadataDto
Trial-scoped registration metadata for a specific trial instance. This makes the trial the entry point, while still explicitly referencing the underlying organization/sport/form/version template.

```json
{
  "trialId": "9d4a8d25-2c59-4f1f-8c79-6c63e74f5f49",
  "formTemplate": { "organizationCode": "ASCA", "sportCode": "StockDog", "formCode": "TrialEntry", "version": "2020-10-08" },
  "formMetadata": {
    "formTemplate": { "organizationCode": "ASCA", "sportCode": "StockDog", "formCode": "TrialEntry", "version": "2020-10-08" },
    "grids": [
      {
        "grid": "Upper",
        "rows": ["Sheep", "Cattle", "Ducks", "Mixed"],
        "cols": ["STD", "OPN", "ADV", "FTD_OPN", "FTD_ADV", "DATE1_TRIAL1"],
        "disabledCells": [
          { "row": "Mixed", "col": "STD" },
          { "row": "Mixed", "col": "OPN" },
          { "row": "Mixed", "col": "ADV" },
          { "row": "Mixed", "col": "FTD_OPN" },
          { "row": "Mixed", "col": "FTD_ADV" }
        ]
      }
    ]
  }
}
```



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
  "pdfStatus": "Success"
}
```

### 2.6 EntryDetailDto (full left-half form)
```json
{
  "entryId": "f3e0e855-6522-4d4b-8d9e-34e61f9a4a75",
  "trial": {
    "trialId": "9d4a8d25-2c59-4f1f-8c79-6c63e74f5f49",
    "name": "Spring Stockdog Trial",
    "organizerSlug": "EXCLUB",
    "eventSlug": "SPRING-2026-05-02",
    "trackingSlug": "OLDKYASCASPRING-2026-05-02",
    "hostClub": "Old Fashioned KY ASCA Club",
    "startDate": "2026-05-02",
    "endDate": "2026-05-03",
    "secretaryEmail": "secretary@example.com"
  },
  "status": "Draft",
  "formTemplate": { "organizationCode": "ASCA", "sportCode": "StockDog", "formCode": "TrialEntry", "version": "2020-10-08" },
  "entryNumber": null,
  "dog": {
    "ascaRegistrationNumber": "E-12345",
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
    "acceptedAtUtc": null,
    "acceptedByUserId": null
  },
  "processing": {
    "pdfStatus": "Queued",
    "generatedPdf": {
      "blobUri": null,
      "downloadUrl": null
    },
    "emailNotifications": [
      { "recipientType": "Handler", "status": "Queued", "sentAtUtc": null, "lastError": null },
      { "recipientType": "Secretary", "status": "Queued", "sentAtUtc": null, "lastError": null }
    ],
    "lastError": null
  }
}
```

### 2.7 EntryUpdateRequestDto
All fields optional; only provided fields are updated.

Null handling (MVP decision)
- Explicit nulls are rejected; omit fields to leave them unchanged.

```json
{
  "dog": {
    "ascaRegistrationNumber": "E-12345",
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
  "generatedPdfDownloadUrl": "https://...SAS...",
  "emailNotifications": [
    { "recipientType": "Handler", "status": "Success", "sentAtUtc": "2026-05-01T15:22:30Z", "lastError": null },
    { "recipientType": "Secretary", "status": "Success", "sentAtUtc": "2026-05-01T15:22:31Z", "lastError": null }
  ],
  "lastError": {
    "code": "PDF_STAMP_FAILED",
    "message": "Short message for UI; full stack in logs only."
  }
}
```

Notes:
- `terms.acceptedByUserId` is intended for secretary/admin auditing and may be omitted for handler views.

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

### 3.2.1 Trial registration metadata (authenticated)
**GET** `/api/trials/{trialId}/registration/metadata` (Handler or Secretary)

**200**: `TrialRegistrationMetadataDto`

### 3.2.2 Form template metadata (authenticated)
**GET** `/api/form-templates/{organizationCode}/{sportCode}/{formCode}/{version}/metadata` (Handler or Secretary)

**200**: `FormMetadataDto`

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

This section is **required for MVP** to enable deterministic Playwright automation without relying on external identity providers.

**GET** `/api/admin/entries/{entryId}/processing-status` (Secretary or Test-only)
- Returns `ProcessingStatusDto`

**POST** `/api/testauth/token` (Test-only; gated)
- Purpose: return a short-lived JWT for role-based testing.
- Required headers:
  - `X-Test-Auth-Secret: <secret>`
  - `X-Test-Role: Handler|Secretary`
- Response **200**:
```json
{ "accessToken": "<jwt>", "expiresInSeconds": 900, "role": "Handler" }
```
- When disabled, return **404** (preferred) or **403**.

---

## 4) Validation and error handling

### 4.1 ProblemDetails shape (RFC 7807)
All 400/401/403/404/409 errors use ProblemDetails.

This API also uses extension properties on ProblemDetails:
- `errors` (validation errors map; standard ASP.NET Core convention)
- `errorCode` (stable string for non-validation errors)

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

MVP decision: authenticated email claim
- Prefer `preferred_username`.
- Fallback to `email`.
- Fallback to first value in `emails` (if present).

MVP decision: secretary allowlist parsing
- Parse `SECRETARY_EMAIL_ALLOWLIST` as comma/semicolon/newline-separated, case-insensitive.

### 4.4 Entry Number generation
MVP rule:
- `entryNumber` is generated by the server on successful submit.
- Format: `trackingSlug-0001` (zero-padded sequence), sequence resets per trial.
- Clients must treat this field as read-only.
- **Note:** `dog.ascaRegistrationNumber` is user-entered (the dog's ASCA registration) and is separate from `entryNumber`.

Concurrency + idempotency requirements:
- Allocation must be concurrency-safe (no duplicate numbers for a trial).
- Allocation must occur at most once per entry (submit retries must not burn extra numbers).
- Recommended implementation: allocate within the same DB transaction that transitions Draft → Submitted, and enforce uniqueness with a DB constraint.

Database-first enforcement note (MVP)
- Prefer SQL Server constraints and transactional locks as the primary guardrails; EF Core should model these, but should not be relied on as the sole protection.

---

## 5) Processing and idempotency

### 5.1 PDF generation
- Container: `pdf`
- Deterministic blob name: `entries/{entryId}.pdf`
- If blob exists and PdfStatus=Success, do not regenerate.

Retry-on-restart (MVP decision)
- The API may retry incomplete PDF generation on startup; operations must be idempotent.

SAS TTL (MVP decision)
- UI-minted download links: 15 minutes.
- Email links: 24 hours.

### 5.2 Email sending
- Notification keys:
  - (EntryId, RecipientType=Handler)
  - (EntryId, RecipientType=Secretary)
- If already `Success`, do not resend.

Retry-on-restart (MVP decision)
- The API may retry incomplete notifications on startup; operations must be idempotent.

### 5.3 Status fields (recommended on Entries)
- `PdfStatus`: Queued|InProgress|Success|Failed
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
- `pdf.status` (Queued/InProgress/Success/Failed) on Pdf.Generate
- `email.status` (Queued/InProgress/Success/Failed) on Email.Send
- `email.recipientType` (Handler/Secretary) on Email.Send

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

