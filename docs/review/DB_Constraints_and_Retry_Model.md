# Database constraints & retry model (MVP)

**Date:** 2026-01-21

This document makes the concurrency + reliability mechanics unambiguous and **database-enforced**. EF Core should generate these constraints via migrations, but **SQL Server is the source of truth** for integrity/uniqueness in this MVP.

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
- `RegistrationOrTrackingNumber` nvarchar(128) NULL  (set on submit; derived from TrackingSlug + sequence)
- `SubmittedAtUtc` datetime2 NULL
- `CreatedByUserId` uniqueidentifier NOT NULL

Recommended processing columns:
- `PdfStatus` nvarchar(16) NOT NULL  (Queued/InProgress/Success/Failed)
- `PdfAttemptCount` int NOT NULL DEFAULT 0
- `PdfNextAttemptAtUtc` datetime2 NULL
- `PdfLastAttemptAtUtc` datetime2 NULL
- `PdfLastErrorCode` nvarchar(64) NULL

Constraints:
- `CK_Entries_SequenceNumber_Positive` CHECK (`SequenceNumber` IS NULL OR `SequenceNumber` >= 1)
- `UX_Entries_TrialId_SequenceNumber` UNIQUE (`TrialId`, `SequenceNumber`) WHERE `SequenceNumber` IS NOT NULL
- `UX_Entries_RegistrationOrTrackingNumber` UNIQUE (`RegistrationOrTrackingNumber`) WHERE `RegistrationOrTrackingNumber` IS NOT NULL

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
   - `RegistrationOrTrackingNumber = Trials.TrackingSlug + '-' + RIGHT('0000' + CAST(seq AS varchar), 4)` (or equivalent padding)
5) Transition Draft → Submitted and commit.

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
