# WI-A04: Dog Fields

**Owner:** Agent A (UI-First)  
**Status:** Proposed  
**Milestone:** M2  
**Dependencies:** A03  
**Artifacts folder (recommended):** `../artifacts/WI-A04/`

## Goal
Implement the Dog Information section of the registration form with all required fields.

## Scope
### In
- Dog section reactive form group
- All dog fields from PDF/API contract:
  - Breed (required)
  - Registered Name
  - Call Name (required)
  - Date of Birth (required)
  - Color
  - Sex (required: Male/Female)
  - Sire
  - Dam
  - Breeders
- Field-level validation
- Material form field styling
- Registration/Tracking Number display (read-only, populated after submit)

### Out
- Form layout container (see A03)
- Other form sections (see A05-A06)
- Submit logic (see A11)

## Implementation notes
- Use Angular Material form fields
- Sex field should be radio buttons or select
- DOB should use Material datepicker
- Registration/Tracking Number is read-only and only shown after submit
- Validation rules:
  - `breed`: required
  - `callName`: required
  - `dob`: required, must be valid date
  - `sex`: required
- Other fields are optional

## Acceptance criteria
- [ ] Dog section displays all fields from API contract
- [ ] Required fields show asterisk indicator
- [ ] Date picker works for DOB field
- [ ] Sex field uses radio buttons or dropdown
- [ ] Form values bind to parent form group
- [ ] Field-level validation shows inline errors
- [ ] Registration Number field is read-only

## Test Plan
### Unit tests (TDD)
**Artifact requirements**
- DogFieldsComponent initializes all form controls
- Required validation triggers on blur
- Form values propagate to parent

**Artifacts (add as relative links during work)**
- `../artifacts/WI-A04/unit-test-results.txt`

### Integration tests (BDD)
**Artifact requirements**
- Form group integration with parent form

**Artifacts (add as relative links during work)**
- `../artifacts/WI-A04/integration-test-results.txt`

### E2E (BDD, Playwright)
**Artifact requirements**
- Fill all dog fields, verify values persist
- Leave required field empty, verify error shows

**Artifacts (add as relative links during work)**
- `../artifacts/WI-A04/playwright/dog-fields-trace.zip`

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
- Confirm breed should be free text vs. dropdown with known breeds

## DTO Reference (from PRD_MVP_API_Contract.md)
```typescript
interface DogDto {
  registrationOrTrackingNumber?: string; // Read-only, set by server
  breed: string;                          // Required
  registeredName?: string;
  dob: string;                            // Required, ISO date
  color?: string;
  callName: string;                       // Required
  sex: 'Male' | 'Female';                 // Required
  sire?: string;
  dam?: string;
  breeders?: string;
}
```

## Field Layout
```
┌─────────────────────────────────────────┐
│ DOG INFORMATION                         │
├─────────────────────────────────────────┤
│ Reg/Tracking #: [readonly display]      │
├──────────────────┬──────────────────────┤
│ Breed*           │ Registered Name      │
│ [___________]    │ [_______________]    │
├──────────────────┼──────────────────────┤
│ Call Name*       │ Date of Birth*       │
│ [___________]    │ [📅 ___________]    │
├──────────────────┼──────────────────────┤
│ Color            │ Sex*                 │
│ [___________]    │ ○ Male ○ Female      │
├──────────────────┼──────────────────────┤
│ Sire             │ Dam                  │
│ [___________]    │ [_______________]    │
├─────────────────────────────────────────┤
│ Breeders                                │
│ [_____________________________________] │
└─────────────────────────────────────────┘
```
