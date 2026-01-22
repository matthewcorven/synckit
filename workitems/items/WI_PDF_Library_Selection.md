# WI-PDF0: Pick permissive OSS PDF stamping library

**Owner:** Agent B  
**Status:** Proposed  
**Dependencies:** M0

## Goal
Select and document a **permissive OSS** PDF stamping approach suitable for Azure App Service and coordinate-based stamping against the official template.

## Scope
### In
- Choose a permissive OSS library and document:
  - license
  - capabilities/limitations
  - any font embedding considerations
- Add a tiny spike that loads the template and stamps 1-2 fields.

### Out
- Commercial/AGPL-only dependency (not desired for MVP).

## Acceptance criteria
- A chosen library is recorded in docs (or README).
- A minimal proof works locally and in Azure.

## Tests
### Playwright
- N/A.

### DB validation
- N/A.

## Telemetry
- Span `Pdf.Generate` includes `pdf.library` attribute (string).

## Risks / Questions
- Template may or may not have AcroForm fields; coordinate stamping should work regardless.
