# WI-A09: Validation UX

**Owner:** Agent A (UI-First)  
**Status:** Proposed  
**Milestone:** M3  
**Dependencies:** A04, A05, A06, A07, A08  
**Artifacts folder (recommended):** `../artifacts/WI-A09/`

## Goal
Implement comprehensive validation UX with inline errors and a validation summary.

## Scope
### In
- Inline validation errors for all form fields
- Validation summary component (shows all errors)
- Error styling (red borders, error icons)
- Touch/blur triggers for validation display
- Server-side validation error display (ProblemDetails `errors` map)
- Scroll-to-error functionality

### Out
- Field implementations (see A04-A08)
- Submit logic (see A11)
- Terms modal (see A10)

## Implementation notes
- Show inline errors after field is touched/blurred
- Validation summary appears:
  - On submit attempt with errors
  - Above submit button or as sticky banner
- Map server `errors` object keys to form control paths
- ProblemDetails format: `{ errors: { "dog.callName": ["Call Name is required."] } }`
- Scroll to first error when summary is shown
- Required field indicators (*) already on fields
- Error messages should be user-friendly

## Acceptance criteria
- [ ] Inline errors show after field blur when invalid
- [ ] Validation summary shows all current errors
- [ ] Summary appears on submit attempt with errors
- [ ] Clicking summary error scrolls to field
- [ ] Server validation errors display correctly
- [ ] Error styling is consistent (Material error state)
- [ ] Error messages are readable and actionable

## Test Plan
### Unit tests (TDD)
**Artifact requirements**
- ValidationSummaryComponent lists all errors
- Inline error directive shows/hides correctly
- Server error mapping works

**Artifacts (add as relative links during work)**
- `../artifacts/WI-A09/unit-test-results.txt`

### Integration tests (BDD)
**Artifact requirements**
- Full form validation flow
- Server error response handling

**Artifacts (add as relative links during work)**
- `../artifacts/WI-A09/integration-test-results.txt`

### E2E (BDD, Playwright)
**Artifact requirements**
- Submit empty form, verify summary appears
- Click error in summary, verify scroll to field
- Fix error, verify it disappears from summary
- Screenshot of validation state

**Artifacts (add as relative links during work)**
- `../artifacts/WI-A09/playwright/validation-summary-trace.zip`
- `../artifacts/WI-A09/playwright/validation-error-state.png`

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
- UX decision: sticky vs inline summary
- Error message wording (should match server messages)

## Validation Rules Reference
```typescript
// Client-side validation rules
const validationRules = {
  'dog.breed': { required: true },
  'dog.callName': { required: true },
  'dog.dob': { required: true },
  'dog.sex': { required: true },
  'contact.owners': { required: true },
  'contact.email': { required: true, email: true },
  'contact.phone': { required: true },
  'emergencyContact.name': { required: true },
  'emergencyContact.phoneOrNumber': { required: true },
  'fees.totalEntryFees': { required: true, min: 0 },
  'selections': { minSelections: 1 }, // At least one selection required
  'terms': { required: true } // Handled in A10
};

// Server ProblemDetails error format
interface ValidationProblemDetails {
  type: string;
  title: string;
  status: 400;
  traceId: string;
  errors: {
    [fieldPath: string]: string[];
  };
}
```

## Component Structure
```
┌─────────────────────────────────────────┐
│ VALIDATION SUMMARY                      │
│ Please fix the following errors:        │
│ • Call Name is required          [→]    │
│ • Email format is invalid        [→]    │
│ • Emergency contact required     [→]    │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Call Name*                              │
│ [                              ] ⚠️      │
│ ↳ Call Name is required                 │
└─────────────────────────────────────────┘
```
