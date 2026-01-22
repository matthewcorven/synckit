# MVP vs MVP+ consistency review (living)

**Date started:** 2026-01-21

## MVP (must ship)
From the PRDs, MVP explicitly includes:
- AuthN/AuthZ (Handler + Secretary) via Microsoft Entra External ID.
- Trial list (seeded, static for MVP).
- Registration form (left-half only) + grid selections.
- Terms presented web-style and acceptance stored with version.
- Submit flow: validate, write to Azure SQL.
- PDF generation from official template stored in backend assets; blob storage with SAS download.
- Email notifications to handler + secretary via ACS Email.
- Secretary portal: list + detail + PDF download.
- Observability: OpenTelemetry traces/metrics/logs with correlation (Support ID).
- Testability: deterministic Playwright via TestAuth mode.

## MVP+ / Future ideas (explicitly out of MVP)
- Payments and fee calculation (beyond user-entered total).
- Wizard mode.
- PDF upload/extraction.
- SMS.
- Worker services beyond the API host.
- Anything like training content, forums, event directory, profiles, news, etc.

## Current inconsistencies / drift
1) Root README marketing copy lists broad features (forum, training resources, etc.).
   - Action: rewrite README to be MVP-aligned and add MVP+ roadmap section.

2) PDF template naming/location was inconsistent (now standardized as docs/assets/asca-entry-form.pdf).

## Open questions to resolve (blocking decisions)
- Q1: Do we need multi-trial-date support beyond what the grid columns imply (DATE1..DATE4)?

## Decisions captured
- Disabled grid-cell rules: API contract is authoritative for MVP.
- Terms v1 source: in-repo HTML file served by the API.
- Trial seed source: commit a JSON seed file for MVP.
- Handler entry email: must match authenticated email (default contract rule).

## Potential contract clarifications
- Confirm whether EntryUpdateRequestDto must allow updating `trialId` (recommend: no, draft fixed to chosen trial).
- Confirm whether handler email must match authenticated email (default yes per API contract).
