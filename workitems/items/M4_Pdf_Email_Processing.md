# M4: PDF + Email processing

**Owner:** Agent B  
**Status:** Proposed  
**Dependencies:** M3

## Goal
Generate a filled official PDF and send emails to handler and secretary.

## Scope
- PDF template loading + stamping by coordinates
- Blob storage write with deterministic naming
- SAS download link endpoint(s)
- ACS Email integration + idempotency
- Processing status endpoint for tests

## Acceptance criteria
- Submit eventually yields `pdfStatus=Success`.
- Submit eventually yields two per-recipient notifications with `status=Success` (Handler + Secretary).
- Secretary can retrieve a download URL.
