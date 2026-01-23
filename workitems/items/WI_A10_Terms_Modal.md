# WI-A10: Terms Modal

**Owner:** Agent A (UI-First)  
**Status:** Proposed  
**Milestone:** M3  
**Dependencies:** A09  
**Artifacts folder (recommended):** `../artifacts/WI-A10/`

## Goal
Implement the terms and conditions modal with acceptance checkbox that gates form submission.

## Scope
### In
- Terms modal dialog component
- Terms content display (HTML from API)
- "I accept" checkbox
- Scroll-to-bottom encouragement (optional: require scroll)
- Terms version tracking
- Terms link/button to open modal
- Acceptance state in form

### Out
- Submit logic (see A11)
- Terms HTML content (backend provides, see B18)

## Implementation notes
- API contract: `GET /api/terms/current` returns `TermsDto`
- Terms include version string for audit
- Modal should:
  - Display HTML content safely (sanitized)
  - Have clear Accept/Decline buttons
  - Show version being accepted
- Checkbox on form gates submit button
- Store acceptance in form state:
  - `terms.version`: string
  - `terms.accepted`: boolean
- Consider: require scrolling through terms before checkbox enabled

## Acceptance criteria
- [ ] Terms link opens modal dialog
- [ ] Modal displays terms HTML content
- [ ] Modal has Accept and Decline buttons
- [ ] Accept enables checkbox on form
- [ ] Checkbox must be checked to submit
- [ ] Terms version is captured
- [ ] Modal is accessible (focus trap, ESC to close)

## Test Plan
### Unit tests (TDD)
**Artifact requirements**
- TermsModalComponent renders terms HTML
- Accept button sets form value
- Checkbox state gates submit

**Artifacts (add as relative links during work)**
- [../artifacts/WI-A10/unit-test-results.txt](../../artifacts/WI-A10/unit-test-results.txt)

### Integration tests (BDD)
**Artifact requirements**
- Terms fetched from service
- Acceptance flow end-to-end

**Artifacts (add as relative links during work)**
- [../artifacts/WI-A10/integration-test-results.txt](../../artifacts/WI-A10/integration-test-results.txt)

### E2E (BDD, Playwright)
**Artifact requirements**
- Open terms modal, verify content displays
- Accept terms, verify checkbox enabled
- Try submit without acceptance, verify blocked
- Screenshot of terms modal

**Artifacts (add as relative links during work)**
- [../artifacts/WI-A10/playwright/terms-modal-trace.zip](../../artifacts/WI-A10/playwright/terms-modal-trace.zip)
- [../artifacts/WI-A10/playwright/terms-modal-screenshot.png](../../artifacts/WI-A10/playwright/terms-modal-screenshot.png)

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
- Terms content length (scrollable area sizing)
- Legal review of terms wording (content provided externally)

## DTO Reference (from PRD_MVP_API_Contract.md)
```typescript
interface TermsDto {
  version: string;  // e.g., "v1"
  html: string;     // Sanitized HTML content
}

// Form state for terms acceptance
interface TermsFormValue {
  version: string;
  acceptedAtUtc: string | null;    // Set on accept
  acceptedByUserId: string | null; // Set by server
}
```

## Modal Layout
```
┌─────────────────────────────────────────┐
│ Terms and Conditions            [X]     │
├─────────────────────────────────────────┤
│                                         │
│  ┌───────────────────────────────────┐  │
│  │                                   │  │
│  │  <HTML Terms Content>             │  │
│  │                                   │  │
│  │  1. Agreement to Rules            │  │
│  │  2. Liability Waiver              │  │
│  │  3. Photo/Video Release           │  │
│  │  ...                              │  │
│  │                                   │  │
│  └───────────────────────────────────┘  │
│                                         │
│  Version: v1                            │
│                                         │
├─────────────────────────────────────────┤
│        [Decline]    [Accept]            │
└─────────────────────────────────────────┘

Form checkbox after acceptance:
┌─────────────────────────────────────────┐
│ ☑ I have read and accept the            │
│   [Terms and Conditions] (v1)           │
└─────────────────────────────────────────┘
```
