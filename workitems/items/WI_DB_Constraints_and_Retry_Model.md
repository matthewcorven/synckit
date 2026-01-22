# WI-DB1: DB constraints + counters + retry fields

**Owner:** Agent B  
**Status:** Proposed  
**Dependencies:** M0

## Goal
Implement the database-enforced constraints and retry bookkeeping described in [docs/review/DB_Constraints_and_Retry_Model.md](../../docs/review/DB_Constraints_and_Retry_Model.md), so concurrency safety and background recovery are guaranteed by SQL Server.

## Scope
### In
- EF Core entities + migrations for:
  - `Trials` (`OrganizerSlug`, `EventSlug`, optional computed persisted `TrackingSlug`)
  - `TrialCounters` (`TrialId` PK/FK, `NextSequenceNumber`)
  - `Entries` (submit allocation fields + PDF processing fields)
  - `Notifications` (per-recipient delivery state + retry fields)
- SQL Server constraints created via migrations:
  - `UX_Trials_OrganizerSlug_EventSlug`
  - `CK_TrialCounters_NextSequenceNumber_Positive`
  - `CK_Entries_SequenceNumber_Positive`
  - `UX_Entries_TrialId_SequenceNumber` (filtered where `SequenceNumber IS NOT NULL`)
  - `UX_Entries_RegistrationOrTrackingNumber` (filtered where `RegistrationOrTrackingNumber IS NOT NULL`)
  - `UX_Notifications_EntryId_RecipientType`
- Restart-scan performance indexes:
  - `IX_Entries_Status_PdfStatus_PdfNextAttemptAtUtc`
  - `IX_Notifications_Status_NextAttemptAtUtc`

### Out
- Any queueing infrastructure beyond in-process Channels (MVP+).
- “Perfectly gap-free” sequences (gaps acceptable; uniqueness required).

## Implementation notes
- Keep SQL Server as the source of truth (unique constraints / filtered indexes / transactions).
- Ensure `TrackingSlug` is deterministic; if implemented as computed persisted, keep the expression stable and avoid collation surprises.
- Use filtered unique indexes for nullable uniqueness constraints.
- Favor server-side defaults for attempt counts.

## Acceptance criteria
- Migrations create all tables + constraints listed above on SQL Server.
- It is impossible to persist two Submitted entries for the same trial with the same `(TrialId, SequenceNumber)`.
- It is impossible to persist two notifications for the same entry/recipient type.
- Queries for “retry due” can be executed with the intended indexes.

## Tests
### Playwright
- N/A for this work item (schema-only).

### DB validation
- Add an integration test that:
  - applies migrations to a test DB,
  - inserts two `Entries` with the same `(TrialId, SequenceNumber)` and asserts a unique constraint violation,
  - inserts two `Notifications` with the same `(EntryId, RecipientType)` and asserts a unique constraint violation.

## Telemetry
- N/A for this work item.

## Risks / Questions
- Confirm max lengths for `OrganizerSlug`/`EventSlug` and final padding width for the formatted tracking number.
