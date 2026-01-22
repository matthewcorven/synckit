# WI-GRID1: Form/grid metadata endpoint

**Owner:** Agent B (API) + Agent A (UI)  
**Status:** Proposed  
**Dependencies:** M0

## Goal
Prevent UI/server drift by serving grid metadata (rows/cols + disabled cells) from the API.

## Scope
### In
- Add `GET /api/trials/{trialId}/registration/metadata` returning:
  - `trialId`
  - `formTemplate` (organization/sport/form/version)
  - `formMetadata` (grid definitions + disabled cells)
- Update UI to render grid using this metadata.

### Out
- Per-trial grid customization (MVP+).

## Acceptance criteria
- UI can render both grids using API metadata.
- Server validation rejects disabled selections; UI disables them consistently.

## Tests
### Playwright
- One disabled cell appears disabled and cannot be selected.

### DB validation
- Attempt to submit a disabled selection yields 400 validation error.

## Telemetry
- Span: `FormMetadata.Get` (optional).

## Risks / Questions
- None (all trials use the same template in MVP).
