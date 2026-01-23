# WI-A11: Submit Flow UI

**Owner:** Agent A (UI-First)  
**Status:** Completed  
**Milestone:** M3  
**Dependencies:** A10  
**Artifacts folder (recommended):** `../artifacts/WI-A11/`

## Goal
Implement the submit flow with confirmation, Support ID display, and error handling.

## Scope
### In
- Submit button (gated by terms acceptance)
- Loading state during submission
- Success confirmation screen/dialog
- Support ID display on success
- Error handling with Support ID
- Navigation after success

### Out
- Form fields (see A04-A08)
- Validation (see A09)
- Terms modal (see A10)
- Backend submit logic (see B19)

## Implementation notes
- Submit calls `POST /api/entries/{entryId}/submit`
- Request body: `{ acceptTerms: true, termsVersion: "v1" }`
- Success response includes `supportId` for tracking
- Error responses use ProblemDetails with `traceId` as Support ID
- On success:
  - Show confirmation with Support ID
  - Display message about PDF/email being processed
  - Option to view entry or return to trials
- On error:
  - Display error message
  - Show Support ID for support contact
  - Keep form state for retry

## Acceptance criteria
- [ ] Submit button disabled until terms accepted
- [ ] Loading indicator during submission
- [ ] Success shows confirmation with Support ID
- [ ] Error shows message with Support ID
- [ ] Form state preserved on error for retry
- [ ] Navigation options after success
- [ ] Support ID is clearly visible and copyable

## Test Plan
### Unit tests (TDD)
**Artifact requirements**
- Submit button state based on form validity
- Service call made with correct payload
- Success/error states handled

**Artifacts (add as relative links during work)**
- [../artifacts/WI-A11/unit-test-results.txt](../artifacts/WI-A11/unit-test-results.txt)

### Integration tests (BDD)
**Artifact requirements**
- Submit service integration
- Error response handling

**Artifacts (add as relative links during work)**
- [../artifacts/WI-A11/integration-test-results.txt](../artifacts/WI-A11/integration-test-results.txt)

### E2E (BDD, Playwright)
**Artifact requirements**
- Complete form and submit, verify success screen
- Verify Support ID displayed
- Submit with error, verify error display
- Screenshot of confirmation screen

**Artifacts (add as relative links during work)**
- [../artifacts/WI-A11/playwright/submit-success-trace.zip](../artifacts/WI-A11/playwright/submit-success-trace.zip)
- [../artifacts/WI-A11/playwright/submit-confirmation.png](../artifacts/WI-A11/playwright/submit-confirmation.png)
- [../artifacts/WI-A11/playwright/submit-error.png](../artifacts/WI-A11/playwright/submit-error.png)

### DB verification
**Artifact requirements**
- N/A — UI only (DB verification in B19)

**Artifacts (add as relative links during work)**
- N/A

### Telemetry verification
- Verify `x-support-id` header is captured
- Verify it matches displayed Support ID

**Artifact requirements**
- Screenshot showing Support ID match

**Artifacts (add as relative links during work)**
- [../artifacts/WI-A11/telemetry/support-id-verification.png](../artifacts/WI-A11/telemetry/support-id-verification.png)

## Risks / Questions
- ~~Confirmation screen vs modal decision~~ → **RESOLVED: Separate confirmation page** - Navigate to dedicated route
- What happens if user navigates away during submission?

## API Reference (from PRD_MVP_API_Contract.md)
```typescript
// Submit request
interface SubmitEntryRequestDto {
  acceptTerms: boolean;
  termsVersion: string;
}

// Success response
interface SubmitEntryResponseDto {
  entryId: string;
  status: 'Submitted';
  supportId: string;
}

// Error response (ProblemDetails)
interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  traceId: string;  // Use as Support ID
  errors?: { [key: string]: string[] };
  errorCode?: string;
}
```

## UI Flow
```
┌─────────────────────────────────────────┐
│ [Submit Entry]  ← disabled until valid  │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│         Submitting...                   │
│         [=========    ]                 │
└─────────────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
┌───────────────────┐  ┌───────────────────┐
│ SUCCESS           │  │ ERROR             │
│                   │  │                   │
│ ✓ Entry Submitted │  │ ✗ Submission      │
│                   │  │   Failed          │
│ Your entry has    │  │                   │
│ been received.    │  │ {error message}   │
│                   │  │                   │
│ Support ID:       │  │ Support ID:       │
│ [abc123...] 📋    │  │ [abc123...] 📋    │
│                   │  │                   │
│ PDF and email     │  │ Please try again  │
│ confirmation      │  │ or contact        │
│ are on the way.   │  │ support.          │
│                   │  │                   │
│ [View Entry]      │  │ [Try Again]       │
│ [Back to Trials]  │  │                   │
└───────────────────┘  └───────────────────┘
```
