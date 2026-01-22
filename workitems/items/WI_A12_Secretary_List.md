# WI-A12: Secretary List

**Owner:** Agent A (UI-First)  
**Status:** Proposed  
**Milestone:** M5  
**Dependencies:** A11  
**Artifacts folder (recommended):** `../artifacts/WI-A12/`

## Goal
Implement the secretary portal entry list page for viewing submitted entries.

## Scope
### In
- Secretary entry list page at `/secretary`
- Trial filter/selector
- Entry table with:
  - Handler email
  - Dog call name
  - Submission date
  - Status (PDF status)
  - View action
- Pagination
- Loading and empty states
- Secretary role guard

### Out
- Entry detail view (see A13)
- Secretary endpoints (see B25)
- Role/auth setup (see B08)

## Implementation notes
- API contract: `GET /api/secretary/entries?trialId={id}&status=Submitted&page=1&pageSize=50`
- Returns paginated `EntrySummaryDto[]`
- Secretary role required (guard on route)
- Display columns:
  - Handler Email
  - Dog Call Name
  - Submitted At
  - PDF Status (with icon)
  - Actions (View)
- Trial filter dropdown to switch between trials
- Sort by submission date (newest first default)

## Acceptance criteria
- [ ] Page displays at `/secretary`
- [ ] Route guarded for Secretary role
- [ ] Trial filter works
- [ ] Entry table shows correct columns
- [ ] Pagination works
- [ ] Click View navigates to detail
- [ ] Loading state shown during fetch
- [ ] Empty state when no entries

## Test Plan
### Unit tests (TDD)
**Artifact requirements**
- SecretaryListComponent renders table
- Pagination changes trigger reload
- Trial filter updates query

**Artifacts (add as relative links during work)**
- `../artifacts/WI-A12/unit-test-results.txt`

### Integration tests (BDD)
**Artifact requirements**
- Service returns paginated data
- Role guard prevents unauthorized access

**Artifacts (add as relative links during work)**
- `../artifacts/WI-A12/integration-test-results.txt`

### E2E (BDD, Playwright)
**Artifact requirements**
- Login as Secretary, view entry list
- Filter by trial, verify list updates
- Navigate to entry detail
- Screenshot of list view

**Artifacts (add as relative links during work)**
- `../artifacts/WI-A12/playwright/secretary-list-trace.zip`
- `../artifacts/WI-A12/playwright/secretary-list-screenshot.png`

### DB verification
**Artifact requirements**
- N/A — UI only

**Artifacts (add as relative links during work)**
- N/A

### Telemetry verification
- N/A for UI component

**Artifact requirements**
- N/A

**Artifacts (add as relative links during work)**
- N/A

## Risks / Questions
- Confirm pagination UX (page numbers vs infinite scroll)
- Should status column show all processing statuses or just PDF?

## DTO Reference (from PRD_MVP_API_Contract.md)
```typescript
// List response
interface PaginatedEntrySummaryResponse {
  items: EntrySummaryDto[];
  page: number;
  pageSize: number;
  total: number;
}

interface EntrySummaryDto {
  entryId: string;
  trialId: string;
  status: 'Draft' | 'Submitted';
  submittedAtUtc?: string;
  handlerEmail: string;
  dogCallName: string;
  dogRegisteredName?: string;
  pdfStatus: 'Queued' | 'InProgress' | 'Success' | 'Failed';
}
```

## Page Layout
```
┌─────────────────────────────────────────────────────────────┐
│ SECRETARY PORTAL                                            │
├─────────────────────────────────────────────────────────────┤
│ Trial: [Spring Stockdog Trial 2026     ▼]                   │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Handler        │ Dog      │ Submitted  │ PDF  │ Action  │ │
│ ├────────────────┼──────────┼────────────┼──────┼─────────┤ │
│ │ jane@email.com │ Ranger   │ 2026-01-20 │ ✓    │ [View]  │ │
│ │ bob@email.com  │ Scout    │ 2026-01-19 │ ⏳   │ [View]  │ │
│ │ mary@email.com │ Duke     │ 2026-01-19 │ ✗    │ [View]  │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ Showing 1-3 of 45 entries    [< Prev] [1] [2] ... [Next >]  │
└─────────────────────────────────────────────────────────────┘

PDF Status icons:
✓ = Success
⏳ = Queued/InProgress
✗ = Failed
```
