# WI-A03: Form Layout

**Owner:** Agent A (UI-First)  
**Status:** Proposed  
**Milestone:** M2  
**Dependencies:** A02  
**Artifacts folder (recommended):** `../artifacts/WI-A03/`

## Goal
Create the registration form layout that matches the left-half of the official ASCA Stock Dog Trial Entry Form PDF.

## Scope
### In
- Form container component with proper spacing/layout
- Section headers matching PDF structure
- Placeholder slots for each form section (Dog, Contact, Emergency, Fees)
- Placeholder slots for grid sections (Upper, Lower)
- Responsive layout for desktop/tablet
- Form state management setup (reactive forms)

### Out
- Individual field implementations (see A04-A08)
- Grid implementations (see A07-A08)
- Validation logic (see A09)
- Terms/submit (see A10-A11)

## Implementation notes
- Reference the official ASCA form for layout accuracy
- Use Angular Reactive Forms for form state
- Create form sections as child components
- Form sections from PDF left-half:
  1. Dog Information
  2. Owner/Handler Contact
  3. Emergency Contact
  4. Entry Fees
  5. Upper Grid (Class selections)
  6. Lower Grid (Class selections)
- Use CSS Grid or Flexbox for layout matching
- Consider print-friendly styling (future)

## Acceptance criteria
- [ ] Form displays at `/register/{trialId}`
- [ ] Layout matches PDF structure (sections in correct order and styled with near-perfect accuracy versus official form, as observed by AI agent review of Playwright screenshots versus official PDF)
- [ ] Form fetches trial info from API/mock on load
- [ ] Reactive form group is initialized
- [ ] Section headers are visible and properly styled
- [ ] Layout is responsive (min 768px width)

## Test Plan
### Unit tests (TDD)
**Artifact requirements**
- FormLayoutComponent initializes form group
- Trial ID is extracted from route params
- Form sections render in correct order

**Artifacts (add as relative links during work)**
- `../artifacts/WI-A03/unit-test-results.txt`

### Integration tests (BDD)
**Artifact requirements**
- Form loads trial data from mock service

**Artifacts (add as relative links during work)**
- `../artifacts/WI-A03/integration-test-results.txt`

### E2E (BDD, Playwright)
**Artifact requirements**
- Navigate to /register/{trialId}, verify form layout renders
- Screenshot comparison with expected layout

**Artifacts (add as relative links during work)**
- `../artifacts/WI-A03/playwright/form-layout-screenshot.png`
- `../artifacts/WI-A03/playwright/form-layout-trace.zip`

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
- Need access to official ASCA PDF for pixel-matching (../../docs/assets/asca-entry-form.pdf)
- Mobile layout may require separate design decisions

## Form Structure Reference
```typescript
interface RegistrationForm {
  dog: DogFormGroup;
  contact: ContactFormGroup;
  emergencyContact: EmergencyContactFormGroup;
  fees: FeesFormGroup;
  selections: {
    upper: SelectionItem[];
    lower: SelectionItem[];
  };
}
```

## Layout Sketch
```
┌─────────────────────────────────────┐
│ Trial: {name}                       │
│ Dates: {startDate} - {endDate}      │
├─────────────────────────────────────┤
│ DOG INFORMATION                     │
│ ┌─────────────────────────────────┐ │
│ │ [A04 Dog Fields Component]      │ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│ OWNER/HANDLER INFORMATION           │
│ ┌─────────────────────────────────┐ │
│ │ [A05 Contact Fields Component]  │ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│ EMERGENCY CONTACT / FEES            │
│ ┌─────────────────────────────────┐ │
│ │ [A06 Emergency/Fees Component]  │ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│ CLASS SELECTIONS                    │
│ ┌─────────────────────────────────┐ │
│ │ [A07 Upper Grid Component]      │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ [A08 Lower Grid Component]      │ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│ [Terms Checkbox] [Submit Button]    │
└─────────────────────────────────────┘
```
