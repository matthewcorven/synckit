# WI-A08: Lower Grid

**Owner:** Agent A (UI-First)  
**Status:** Proposed  
**Milestone:** M2  
**Dependencies:** A07  
**Artifacts folder (recommended):** `../artifacts/WI-A08/`

## Goal
Implement the Lower Grid component for additional class selections (NOV, WRK, FEO, etc.).

## Scope
### In
- Lower grid component with:
  - Rows: Sheep, Cattle, Ducks
  - Columns: NOV, WRK_JR_HNDLR, FEO, POST_ADV, RTD, DATE1_TRIAL1, etc.
- Disabled cell enforcement (Ducks row restrictions)
- Cell selection toggling (X or empty)
- Grid metadata from API/mock
- Shared grid cell component with Upper Grid

### Out
- Upper grid (see A07)
- Form layout container (see A03)
- Submit logic (see A11)

## Implementation notes
- API contract: Fetch grid structure from `GET /api/trials/{id}/registration/metadata`
- Disabled cells (from FormMetadataDto):
  - Row=Ducks, cols: POST_ADV, RTD
- Reuse grid cell component from A07
- Same keyboard navigation and accessibility patterns
- Store selections as array of `{ row, col, value }` objects
- Consider extracting shared `SelectionGridComponent` base

## Acceptance criteria
- [ ] Lower grid displays correct rows and columns
- [ ] Cells can be clicked to toggle selection
- [ ] Disabled cells cannot be selected (Ducks + POST_ADV/RTD)
- [ ] Disabled cells are visually distinct
- [ ] Selections bind to parent form
- [ ] Grid structure comes from metadata (API or mock)
- [ ] Keyboard navigation works

## Test Plan
### Unit tests (TDD)
**Artifact requirements**
- LowerGridComponent renders correct row/column structure
- Disabled cells are not interactive
- Selection toggle updates form value
- Shared cell component works correctly

**Artifacts (add as relative links during work)**
- `../artifacts/WI-A08/unit-test-results.txt`

### Integration tests (BDD)
**Artifact requirements**
- Grid loads metadata from service
- Selections persist in form state

**Artifacts (add as relative links during work)**
- `../artifacts/WI-A08/integration-test-results.txt`

### E2E (BDD, Playwright)
**Artifact requirements**
- Click cells to select, verify X appears
- Verify disabled cells cannot be clicked
- Both grids work together

**Artifacts (add as relative links during work)**
- `../artifacts/WI-A08/playwright/lower-grid-trace.zip`
- `../artifacts/WI-A08/playwright/lower-grid-screenshot.png`

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
- Ensure both grids can coexist in form without conflicts
- Column alignment between upper and lower grids?

## DTO Reference (from PRD_MVP_API_Contract.md)
```typescript
// Grid metadata from API
interface GridMetadataDto {
  grid: 'Upper' | 'Lower';
  rows: string[];
  cols: string[];
  disabledCells: { row: string; col: string }[];
}

// Selection item
interface SelectionItem {
  row: string;
  col: string;
  value: string; // "X" or ""
}

// Lower Grid specifics
// Rows: ["Sheep", "Cattle", "Ducks"]
// Cols: ["NOV", "WRK_JR_HNDLR", "FEO", "POST_ADV", "RTD", "DATE1_TRIAL1", ...]
// Disabled: Ducks + {POST_ADV, RTD}
```

## Grid Layout
```
┌─────────────────────────────────────────────────────────────────┐
│ LOWER GRID - Additional Classes                                 │
├────────┬─────┬────────┬─────┬────────┬─────┬────────┬────────┬──┤
│        │ NOV │WRK/JR  │ FEO │POST_ADV│ RTD │ Day 1  │ Day 1  │  │
│        │     │HNDLR   │     │        │     │ Trial 1│ Trial 2│  │
├────────┼─────┼────────┼─────┼────────┼─────┼────────┼────────┼──┤
│ Sheep  │ [ ] │ [ ]    │ [ ] │ [ ]    │ [ ] │ [ ]    │ [ ]    │  │
├────────┼─────┼────────┼─────┼────────┼─────┼────────┼────────┼──┤
│ Cattle │ [ ] │ [ ]    │ [ ] │ [ ]    │ [ ] │ [ ]    │ [ ]    │  │
├────────┼─────┼────────┼─────┼────────┼─────┼────────┼────────┼──┤
│ Ducks  │ [ ] │ [ ]    │ [ ] │ ░░░    │ ░░░ │ [ ]    │ [ ]    │  │
└────────┴─────┴────────┴─────┴────────┴─────┴────────┴────────┴──┘

Legend: [ ] = selectable cell, ░░░ = disabled cell
```
