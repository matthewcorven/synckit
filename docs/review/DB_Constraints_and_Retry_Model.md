# Database constraints & retry model (MVP)

**Date:** 2026-01-21

This document makes the concurrency + reliability mechanics unambiguous and **database-enforced**. EF Core should generate these constraints via migrations, but **SQL Server is the source of truth** for integrity/uniqueness in this MVP.

Scope note: this document focuses on the **constraints/indexes/transaction model** required for correctness (counters, uniqueness, retries). It is not intended to enumerate every application column implied by the DTOs (dog/contact fields, trial display fields, etc.).

## Principles
- SQL Server enforces uniqueness, FK integrity, and concurrency safety.
- EF Core may validate in-process, but the system must still behave correctly if concurrent requests bypass app-level checks.
- Submit and allocation are transactional.

---

## Tables and constraints (recommended)

### Trials
Required columns:
- `TrialId` uniqueidentifier PK
- `OrganizerSlug` nvarchar(32) NOT NULL
- `EventSlug` nvarchar(64) NOT NULL  (event name + date portion)
- `TrackingSlug` AS (OrganizerSlug + '-' + EventSlug) PERSISTED  (optional computed persisted)
- `SecretaryEmail` nvarchar(320) NOT NULL
- `IsActive` bit NOT NULL

Constraints:
- `UX_Trials_OrganizerSlug_EventSlug` UNIQUE (`OrganizerSlug`, `EventSlug`)

Notes:
- Even if `TrackingSlug` is computed, it should be stable and deterministic.

### FormTemplates
Purpose: store form grid configuration and metadata per organization/sport/form/version.

Columns:
- `FormTemplateId` int PK IDENTITY
- `OrganizationCode` nvarchar(32) NOT NULL
- `SportCode` nvarchar(32) NOT NULL
- `FormCode` nvarchar(32) NOT NULL
- `Version` nvarchar(32) NOT NULL
- `GridConfigJson` nvarchar(max) NOT NULL  — JSON array of grid metadata

Constraints:
- `UX_FormTemplates_Key` UNIQUE (`OrganizationCode`, `SportCode`, `FormCode`, `Version`)

### TrialCounters
Purpose: allocate per-trial sequential numbers safely.

Columns:
- `TrialId` uniqueidentifier PK, FK → `Trials(TrialId)`
- `NextSequenceNumber` int NOT NULL  (starts at 1)

Constraints:
- `CK_TrialCounters_NextSequenceNumber_Positive` CHECK (`NextSequenceNumber` >= 1)

### Entries
Required columns:
- `EntryId` uniqueidentifier PK
- `TrialId` uniqueidentifier NOT NULL FK → `Trials(TrialId)`
- `Status` nvarchar(16) NOT NULL  (Draft/Submitted)
- `SequenceNumber` int NULL  (set on submit)
- `EntryNumber` nvarchar(128) NULL  (set on submit; derived from TrackingSlug + sequence, e.g., "EXCLUB-SPRING-2026-05-02-0001")
- `SubmittedAtUtc` datetime2 NULL
- `CreatedByUserId` uniqueidentifier NOT NULL
- `RowVersion` rowversion NOT NULL  — For optimistic concurrency (ETag)

Dog data columns (user-entered):
- `AscaRegistrationNumber` nvarchar(64) NULL  — User-entered ASCA dog registration (NOT the entry sequence)
- `Breed` nvarchar(64) NULL
- `RegisteredName` nvarchar(128) NULL
- `CallName` nvarchar(64) NULL
- `Dob` date NULL
- `Color` nvarchar(64) NULL
- `Sex` nvarchar(16) NULL  (Male/Female)
- `Sire` nvarchar(128) NULL
- `Dam` nvarchar(128) NULL
- `Breeders` nvarchar(256) NULL

Contact data columns (user-entered):
- `Owners` nvarchar(256) NULL
- `OwnerStreet` nvarchar(128) NULL
- `OwnerCity` nvarchar(64) NULL
- `OwnerState` nvarchar(32) NULL
- `OwnerZip` nvarchar(16) NULL
- `Email` nvarchar(320) NULL
- `Phone` nvarchar(32) NULL
- `Handler` nvarchar(128) NULL  — Handler name if different from owner
- `MembershipNumber` nvarchar(32) NULL
- `JuniorDob` date NULL
- `JuniorMemberId` nvarchar(32) NULL

Fees and emergency columns:
- `TotalEntryFees` decimal(10,2) NULL
- `EmergencyContactName` nvarchar(128) NULL
- `EmergencyContactPhone` nvarchar(32) NULL

Recommended processing columns:
- `PdfStatus` nvarchar(16) NOT NULL  (Queued/InProgress/Success/Failed)
- `PdfAttemptCount` int NOT NULL DEFAULT 0
- `PdfNextAttemptAtUtc` datetime2 NULL
- `PdfLastAttemptAtUtc` datetime2 NULL
- `PdfLastErrorCode` nvarchar(64) NULL

Constraints:
- `CK_Entries_SequenceNumber_Positive` CHECK (`SequenceNumber` IS NULL OR `SequenceNumber` >= 1)
- `UX_Entries_TrialId_SequenceNumber` UNIQUE (`TrialId`, `SequenceNumber`) WHERE `SequenceNumber` IS NOT NULL
- `UX_Entries_EntryNumber` UNIQUE (`EntryNumber`) WHERE `EntryNumber` IS NOT NULL
- `UX_Entries_TrialId_CreatedByUserId_Draft` UNIQUE (`TrialId`, `CreatedByUserId`) WHERE `Status` = 'Draft'  — **One draft per user per trial**

Indexes (for restart scans):
- `IX_Entries_Status_PdfStatus_PdfNextAttemptAtUtc` on (`Status`, `PdfStatus`, `PdfNextAttemptAtUtc`)

### Notifications
Purpose: per-recipient email delivery state.

Columns:
- `NotificationId` uniqueidentifier PK
- `EntryId` uniqueidentifier NOT NULL FK → `Entries(EntryId)`
- `RecipientType` nvarchar(16) NOT NULL  (Handler/Secretary)
- `Status` nvarchar(16) NOT NULL  (Queued/InProgress/Success/Failed)
- `AttemptCount` int NOT NULL DEFAULT 0
- `NextAttemptAtUtc` datetime2 NULL
- `LastAttemptAtUtc` datetime2 NULL
- `LastErrorCode` nvarchar(64) NULL
- `SentAtUtc` datetime2 NULL

Constraints:
- `UX_Notifications_EntryId_RecipientType` UNIQUE (`EntryId`, `RecipientType`)

Indexes (for restart scans):
- `IX_Notifications_Status_NextAttemptAtUtc` on (`Status`, `NextAttemptAtUtc`)

---

## Transactional allocation algorithm (server-side)
Inside `POST /api/entries/{entryId}/submit`:
1) Begin transaction.
2) Validate Draft + ownership + required fields.
3) Allocate sequence number:
   - Acquire row lock on `TrialCounters` for `TrialId` (Serializable isolation or `UPDLOCK, HOLDLOCK`).
   - `seq = NextSequenceNumber; NextSequenceNumber++`.
4) Set on Entry:
   - `SequenceNumber = seq`
   - `EntryNumber = Trials.TrackingSlug + '-' + RIGHT('0000' + CAST(seq AS varchar), 4)` (or equivalent padding)
5) Transition Draft → Submitted and commit.

Note: `AscaRegistrationNumber` is user-entered data and is NOT affected by the submit transaction.

Submit idempotency:
- If the entry is already Submitted, return 409 and do not allocate.

---

## Background processing restart scan (server-side)
MVP runs in-process Channels, but recovers after restarts.

### PDF scan query (conceptual)
Pick Submitted entries where PDF is not complete and retry is due:
- `Status = 'Submitted'`
- `PdfStatus IN ('Queued','InProgress','Failed')`
- `PdfNextAttemptAtUtc IS NULL OR PdfNextAttemptAtUtc <= utcNow`

### Notification scan query (conceptual)
Pick notifications not complete and retry is due:
- `Status IN ('Queued','InProgress','Failed')`
- `NextAttemptAtUtc IS NULL OR NextAttemptAtUtc <= utcNow`

### Retry/backoff (MVP defaults)
- `AttemptCount` increments per attempt.
- Exponential backoff with cap (example): 1m, 5m, 15m, 30m…
- Max attempts (example): 10

Terminal behavior:
- After max attempts, leave status `Failed` and stop retrying until manual intervention.
