# WI-A06: Emergency & Fees

**Owner:** Agent A (UI-First)  
**Status:** Proposed  
**Milestone:** M2  
**Dependencies:** A03  
**Artifacts folder (recommended):** `../artifacts/WI-A06/`

## Goal
Implement the Emergency Contact section and Entry Fees display.

## Scope
### In
- Emergency Contact section:
  - Name (required)
  - Phone/Number (required)
- Fees section:
  - Total Entry Fees display
  - Currency indicator (USD)
- Field-level validation

### Out
- Form layout container (see A03)
- Other form sections (see A04-A05)
- Fee calculation logic (future: based on grid selections)

## Implementation notes
- Emergency contact fields are required for submit
- Fees section displays calculated total (MVP: manual entry or static)
- Currency is always USD for MVP
- Consider fee breakdown display (future enhancement)
- Validation rules:
  - `emergencyContact.name`: required
  - `emergencyContact.phoneOrNumber`: required
  - `fees.totalEntryFees`: required, positive number

## Acceptance criteria
- [ ] Emergency contact section displays name and phone fields
- [ ] Both emergency contact fields are required
- [ ] Fees section shows total with currency
- [ ] Required fields show asterisk indicator
- [ ] Form values bind to parent form group
- [ ] Validation errors show inline

## Test Plan
### Unit tests (TDD)
**Artifact requirements**
- EmergencyFeesComponent initializes all form controls
- Required validation triggers correctly
- Fee value formats properly

**Artifacts (add as relative links during work)**
- `../artifacts/WI-A06/unit-test-results.txt`

### Integration tests (BDD)
**Artifact requirements**
- Form group integration with parent form

**Artifacts (add as relative links during work)**
- `../artifacts/WI-A06/integration-test-results.txt`

### E2E (BDD, Playwright)
**Artifact requirements**
- Fill emergency contact, verify values persist
- Leave required field empty, verify error shows

**Artifacts (add as relative links during work)**
- `../artifacts/WI-A06/playwright/emergency-fees-trace.zip`

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
- Fee calculation rules (based on selections?) — MVP may be manual entry
- Payment integration (out of scope for MVP)

## DTO Reference (from PRD_MVP_API_Contract.md)
```typescript
interface EmergencyContactDto {
  name: string;           // Required
  phoneOrNumber: string;  // Required
}

interface FeesDto {
  totalEntryFees: number; // Required
  currency: string;       // Always "USD" for MVP
}
```

## Field Layout
```
┌─────────────────────────────────────────┐
│ EMERGENCY CONTACT                       │
├──────────────────┬──────────────────────┤
│ Name*            │ Phone/Number*        │
│ [___________]    │ [_______________]    │
└──────────────────┴──────────────────────┘

┌─────────────────────────────────────────┐
│ ENTRY FEES                              │
├─────────────────────────────────────────┤
│ Total Entry Fees*: $[_______] USD       │
│                                         │
│ (Payment details not collected here)    │
└─────────────────────────────────────────┘
```
