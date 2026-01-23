# PRD — Stock Dog Trial Registration Web App (MVP)

**Document status:** Draft for implementation  
**Target stack:** Angular 22 (Azure Static Web Apps) + .NET 10 Web API + EF Core (code-first) + Azure SQL + Azure Blob + ACS Email + OpenTelemetry  
**MVP scope:** login (handler + trial secretary), trial selection from static list, **left-half** entry form (pixel-perfect replica of the official ASCA form’s left-half), web-style terms acceptance, database insert, PDF generation into the official ASCA PDF template, email confirmations to handler + secretary.

---

## 1. Goals

### 1.1 Business goals
- Replace manual/paper entry workflow with online registration.
- Produce a **filled official ASCA PDF** per entry for secretary processing.
- Persist entries in a relational database for reporting and audit.

### 1.2 Engineering goals
- Ship a small, reliable MVP with strong runtime visibility: traces, metrics, logs, error correlation.
- Make iterative changes safe with **per-work-item Playwright E2E tests** and **database validation**.

---

## 2. Non-goals (explicitly out of MVP)
- No guided wizard mode, no PDF upload/extraction.
- No payments and no fee calculation beyond user entry of “Total Entry Fees”.
- No SMS (email only).
- No separate worker services (Functions/Service Bus/etc.). Background processing runs inside API host via .NET Channels.
- No MCP in application runtime. (AI agents may use Playwright via MCP externally for development automation.)

---

## 3. Personas and roles

### 3.1 Handler (entrant)
- Login
- Select trial
- Create and submit entry
- Receive confirmation email

### 3.2 Trial Secretary
- Login
- View submitted entries list + detail
- Download generated PDFs
- Receive submission notification email

---

## 4. User journeys

### 4.1 Handler
1) Login  
2) Select trial from list  
3) Fill entry on-screen matching **left half** of official form  
4) Review Terms (web-style) and check “I agree”  
5) Submit  
6) System writes entry to DB  
7) System generates official PDF and stores it  
8) System emails handler + secretary

### 4.2 Secretary
1) Login  
2) Select trial  
3) View submitted entries list  
4) View entry detail and download PDF

---

## 5. Functional requirements (FR)

### FR-1 Authentication and authorization
**FR-1.1 Identity**
- Use **Microsoft Entra External ID** supporting:
  - Microsoft
  - Google
  - Apple
  - Email-based login (OTP/magic-link per External ID configuration)

**FR-1.2 Roles**
- Server-enforced roles:
  - `Handler`
  - `Secretary`

**FR-1.3 Provisioning**
- On first authenticated API call, upsert internal user keyed by External ID subject.
- Role assignment:
  - default new user → `Handler`
  - if email matches configured allowlist → `Secretary`

Implementation notes (MVP decisions)
- Internal user identity:
  - Persist `Users(UserId GUID PK, ExternalSubject string UNIQUE, Email string, Role string, ...)`.
  - Map JWT `sub` → `Users.ExternalSubject` and use `Users.UserId` as the value stored in `Entries.CreatedByUserId`.
- Authenticated email claim:
  - Prefer `preferred_username`.
  - Fallback to `email`.
  - Fallback to first value in `emails` (if present).
- Parse `SECRETARY_EMAIL_ALLOWLIST` as comma/semicolon/newline-separated, case-insensitive.

**Acceptance criteria**
- Protected endpoints return 401 when unauthenticated.
- Handler cannot access `/api/secretary/*` (403).
- Secretary can access `/api/secretary/*`.

---

### FR-2 Trial list (static)
**FR-2.1 Data**
- Trials seeded into Azure SQL via EF Core migrations/seed.
- Each trial includes an `OrganizerSlug` + `EventSlug` used to form a `TrackingSlug` and generate sequential Registration/Tracking # values on submit.
- Each trial references an organization-scoped registration form template (organization/sport/form/version), e.g., ASCA StockDog TrialEntry 2020-10-08.

**FR-2.2 UI**
- Handler sees active trials only.
- Secretary may see all if needed (optional).

**Acceptance criteria**
- `GET /api/trials` returns active trials.
- UI displays trials and allows selection.

---

### FR-3 Entry form (left-half only)
**FR-3.1 Lifecycle**
- Entry states: `Draft`, `Submitted`.
- Handler can edit drafts; submitted entries are read-only to handler.

**FR-3.2 Fields captured**
Pixel-perfect requirement (MVP)
- The on-screen form must be a pixel-perfect replica of the **left-half** of the official ASCA Stock Dog Trial Entry PDF (excluding the right-half terms).
- Canonical template for design reference: [docs/assets/asca-entry-form.pdf](../assets/asca-entry-form.pdf).

Event (read-only from trial):
- Host Club
- Trial Dates

Dog:
- ASCA Registration # (user-entered dog registration number)
- Breed
- Registered Name
- DOB
- Color
- Call Name
- Sex (Male/Female)
- Sire
- Dam
- Breeder(s)

Entry Number (system-generated on submit):
- Format: `trackingSlug-0001` (zero-padded sequence per trial)
- Read-only; displayed after successful submit

Owner/handler:
- Owner(s)
- Owner Address (street)
- City / State / Zip
- Email
- Phone
- Handler (if other than owner)
- Membership Number
- Junior DOB (optional)
- Junior Member ID# (optional)

Entry grids (stored normalized):
- Upper rows: Sheep, Cattle, Ducks, Mixed
- Lower rows: Sheep, Cattle, Ducks
- Columns: exact template columns for the supported form version (see TR)

Grid metadata source of truth (MVP decision)
- Registration forms are versioned by the issuing organization (organization/sport/form/version scoped).
- UI should call `GET /api/trials/{trialId}/registration/metadata` and render rows/columns/disabled cells from the returned metadata.

Fees & emergency:
- Total Entry Fees (decimal)
- Emergency Contact Name
- Emergency Contact Number

**FR-3.3 Validation on submit**
Required on submit:
- Trial selected
- Call Name
- Sex
- Owner(s)
- Address street/city/state/zip
- Email
- Phone
- Emergency contact name + number
- At least one grid selection (required on submit; no UI preselect for MVP)
- Terms accepted

Grid rules:
- Disabled cells cannot be selected.

Registration/Tracking # generation (MVP decisions)
- **Entry Number** (e.g., `OLDKYASCASPRING-2026-05-02-0001`) is generated by the system on **successful submit**.
- Format: `trackingSlug-0001` (zero-padded sequence), where the sequence resets per trial.
- No override/edit in MVP.
- Drafts may show this field as blank or "Assigned on submit".
- **Note:** The ASCA dog registration number (`dog.ascaRegistrationNumber`) is user-entered and separate from the entry number.

Database enforcement (MVP)
- Uniqueness and allocation are enforced by SQL Server constraints/transactions (not only by application logic).

**Acceptance criteria**
- Save draft persists fields; reload restores.
- Submit returns ProblemDetails with field errors for invalid input.

---

### FR-4 Terms acceptance (web-style)
**FR-4.1 UX**
- Terms displayed as a normal web page/modal.
- Submit button gated by “I agree” checkbox.

**FR-4.2 Versioning**
- Server exposes current `{ version, html }`.
- Submission stores `TermsVersion`, `TermsAcceptedAtUtc`, `TermsAcceptedByUserId`.

**Acceptance criteria**
- Submission blocked without acceptance.
- Stored version matches current server version.

---

### FR-5 PDF generation (official template)
**FR-5.1 Template**
- The official ASCA Stock Dog Trial Entry PDF in [docs/assets/asca-entry-form.pdf](../assets/asca-entry-form.pdf) is the canonical template for MVP.
- PDF generation must use this file as the **base/template** and produce a filled owner/handler copy after successful submission (post-validation).
- At runtime, the API must package and load the **exact** template file bytes (the publish/deploy process must include it).
- Coordinate map per form template (organization/sport/form/version) stamps fields and grid marks.

**FR-5.2 Flow**
- On submit:
  - Entry saved to DB, status set to Submitted
  - PDF generation enqueued to Channel
  - Generated PDF stored in Azure Blob with deterministic name by EntryId
  - Entry updated with `GeneratedPdfBlobUri` + `PdfStatus`

**Acceptance criteria**
- Generated PDF exists in blob and is downloadable.
- Grid marks in PDF match EntrySelections.

---

### FR-6 Email confirmations
- Email sent to handler and trial secretary.
- Includes Trial, EntryId, Dog Call Name, and a PDF download link (preferred).

Provider:
- Azure Communication Services Email.

**Acceptance criteria**
- Both emails sent and recorded in notifications table/logs.

---

### FR-7 Secretary portal (MVP)
List view:
- Filter by trial; show submitted entries.
- Columns: SubmittedAt, HandlerEmail, DogCallName, Status, PdfStatus

Detail view:
- Read-only entry fields
- PDF download link

**Acceptance criteria**
- Secretary can view list and detail.
- Secretary can download PDF.

---

## 6. Non-functional requirements (NFR)

### NFR-1 Security
- HTTPS only.
- JWT validation strict.
- RBAC enforced server-side.
- Blob container private; PDFs served via short-lived SAS.
- No PII in logs.

### NFR-2 Reliability
- Entry write committed before background work begins.
- Channel-driven background processing for PDF/email.
- Status fields expose failures (PdfStatus + per-recipient NotificationStatus + error code).

### NFR-3 Performance
- Submit endpoint returns quickly (<2s server time) by enqueueing background work.
- Secretary list paged.

### NFR-4 Observability (must-have)
- OpenTelemetry traces/metrics/logs in backend:
  - ASP.NET Core + EF Core + HttpClient + Azure SDK
  - Custom spans: Entry.Submit, Pdf.Generate, Email.Send
  - Metrics: request duration, error counts, queue length, pdf/email success/fail
- Frontend:
  - global error handler
  - HTTP interceptor for error capture + correlation header
- Support correlation:
  - show Support ID (traceId) in error UI

### NFR-5 Maintainability
- UI abstraction to reduce Angular Material lock-in.
- Form template versioning (organization/sport/form/version) supports future ASCA form updates.

---

## 7. Technical requirements (TR)

### TR-1 Azure hosting
- Frontend: Azure Static Web Apps
- API: Azure App Service (.NET 10)

### TR-2 Data
- EF Core code-first migrations.
- Seed trials via migration/seed.

### TR-3 Background work
- Use bounded `Channel<TWorkItem>`.
- Idempotency:
  - PDF blob name deterministic by EntryId
  - Notification records keyed by (EntryId, RecipientType)

MVP decisions (durability + retries)
- Background work runs in-process (no durable queue for MVP).
- On API startup, the service should attempt to resume any incomplete work by scanning for Submitted entries where:
  - PdfStatus != Success OR
  - any required NotificationStatus != Success
- Work items must be idempotent and safe to retry.

### TR-5 PDF stamping library (MVP constraint)
- Use a **permissive OSS** library for stamping/filling the official template.
- Avoid AGPL-only or commercial-only dependencies for MVP.

### TR-4 Testing gate
- Every work item must include:
  - Playwright E2E updates/additions AND/OR DB validation assertions
- Tests must run against deployed URL.

---

## 8. MVP release acceptance criteria
- Handler: login → select trial → fill form → accept terms → submit.
- Entry and selections stored in Azure SQL.
- Official PDF generated and accessible.
- Emails sent to handler + secretary.
- Secretary: login → list entries → detail → download PDF.
- Telemetry correlates submit → pdf/email with traceId and entryId.

