# WI-A07: Upper Grid

**Owner:** Agent A (UI-First)  
**Status:** Proposed  
**Milestone:** M2  
**Dependencies:** A03  
**Artifacts folder (recommended):** `../artifacts/WI-A07/`

## Goal
Implement the Upper Grid component for class selections (STD, OPN, ADV, FTD classes).

## Scope
### In
- Upper grid component with:
  - Rows: Sheep, Cattle, Ducks, Mixed
  - Columns: STD, OPN, ADV, FTD_OPN, FTD_ADV, DATE1_TRIAL1, DATE1_TRIAL2, etc.
- Disabled cell enforcement (Mixed row restrictions)
- Cell selection toggling (X or empty)
- Grid metadata from API/mock
- Accessibility (keyboard navigation, ARIA)

### Out
- Lower grid (see A08)
- Form layout container (see A03)
- Submit logic (see A11)

## Implementation notes
- API contract: Fetch grid structure from `GET /api/trials/{id}/registration/metadata`
- Disabled cells (from FormMetadataDto):
  - Row=Mixed, cols: STD, OPN, ADV, FTD_OPN, FTD_ADV
- Cell value is "X" when selected, empty when not
- Use CSS grid for layout
- Visual indication for disabled cells (grayed out, no interaction)
- Keyboard navigation: arrow keys, space/enter to toggle
- Store selections as array of `{ row, col, value }` objects

## Acceptance criteria
- [ ] Upper grid displays correct rows and columns
- [ ] Cells can be clicked to toggle selection
- [ ] Disabled cells cannot be selected
- [ ] Disabled cells are visually distinct
- [ ] Selections bind to parent form
- [ ] Grid structure comes from metadata (API or mock)
- [ ] Keyboard navigation works

## Test Plan
### Unit tests (TDD)
**Artifact requirements**
- UpperGridComponent renders correct row/column structure
- Disabled cells are not interactive
- Selection toggle updates form value
- Keyboard navigation changes focus

**Artifacts (add as relative links during work)**
- `../artifacts/WI-A07/unit-test-results.txt`

### Integration tests (BDD)
**Artifact requirements**
- Grid loads metadata from service
- Selections persist in form state

**Artifacts (add as relative links during work)**
- `../artifacts/WI-A07/integration-test-results.txt`

### E2E (BDD, Playwright)
**Artifact requirements**
- Click cells to select, verify X appears
- Verify disabled cells cannot be clicked
- Keyboard navigation test

**Artifacts (add as relative links during work)**
- `../artifacts/WI-A07/playwright/upper-grid-trace.zip`
- `../artifacts/WI-A07/playwright/upper-grid-screenshot.png`

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
- Confirm grid structure matches official PDF exactly
- ~~Dynamic columns based on trial dates?~~ → **RESOLVED: Fixed columns** - Same columns for all trials (STD, OPN, ADV, etc.)

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

// Upper Grid specifics
// Rows: ["Sheep", "Cattle", "Ducks", "Mixed"]
// Cols: ["STD", "OPN", "ADV", "FTD_OPN", "FTD_ADV", "DATE1_TRIAL1", ...]
// Disabled: Mixed + {STD, OPN, ADV, FTD_OPN, FTD_ADV}
```

## Grid Layout
```
┌─────────────────────────────────────────────────────────────────┐
│ UPPER GRID - Class Selections                                   │
├────────┬─────┬─────┬─────┬───────┬───────┬────────┬────────┬───┤
│        │ STD │ OPN │ ADV │FTD_OPN│FTD_ADV│ Day 1  │ Day 1  │...│
│        │     │     │     │       │       │ Trial 1│ Trial 2│   │
├────────┼─────┼─────┼─────┼───────┼───────┼────────┼────────┼───┤
│ Sheep  │ [ ] │ [ ] │ [ ] │ [ ]   │ [ ]   │ [ ]    │ [ ]    │   │
├────────┼─────┼─────┼─────┼───────┼───────┼────────┼────────┼───┤
│ Cattle │ [ ] │ [ ] │ [ ] │ [ ]   │ [ ]   │ [ ]    │ [ ]    │   │
├────────┼─────┼─────┼─────┼───────┼───────┼────────┼────────┼───┤
│ Ducks  │ [ ] │ [ ] │ [ ] │ [ ]   │ [ ]   │ [ ]    │ [ ]    │   │
├────────┼─────┼─────┼─────┼───────┼───────┼────────┼────────┼───┤
│ Mixed  │ ░░░ │ ░░░ │ ░░░ │ ░░░   │ ░░░   │ [ ]    │ [ ]    │   │
└────────┴─────┴─────┴─────┴───────┴───────┴────────┴────────┴───┘

Legend: [ ] = selectable cell, ░░░ = disabled cell
```
