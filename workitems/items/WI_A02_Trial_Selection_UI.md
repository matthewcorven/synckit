# WI-A02: Trial Selection UI

**Owner:** Agent A (UI-First)  
**Status:** Proposed  
**Milestone:** M1  
**Dependencies:** A01, MOCK01  
**Artifacts folder (recommended):** `../artifacts/WI-A02/`

## Goal
Build the trial selection page where handlers choose which trial to enter.

## Scope
### In
- Trial list page component
- Trial card component with summary info
- Trial service that calls `GET /api/trials` (or returns mock data)
- Loading and error states
- Navigation to registration form on trial selection

### Out
- Registration form (see A03-A08)
- Secretary views (see A12-A13)

## Implementation notes
- API contract: `GET /api/trials` returns `TrialSummaryDto[]`
- Use `useMocks` environment flag to switch between mock and live data
- Display fields from TrialSummaryDto:
  - `name`, `hostClub`, `startDate`, `endDate`, `location`
- Filter to show only `isActive: true` trials
- On card click, navigate to `/register/{trialId}`
- Follow Material design patterns for cards/list

## Acceptance criteria
- [ ] Trial list page displays at `/trials`
- [ ] Trials are fetched from mock fixture initially
- [ ] Each trial shows name, host club, dates
- [ ] Clicking a trial navigates to `/register/{trialId}`
- [ ] Loading spinner shown while fetching
- [ ] Error message shown if fetch fails
- [ ] Only active trials are displayed

## Test Plan
### Unit tests (TDD)
**Artifact requirements**
- TrialListComponent renders trials from service
- TrialService returns mock data when `useMocks=true`
- Navigation occurs on card click

**Artifacts (add as relative links during work)**
- [../artifacts/WI-A02/unit-test-results.txt](../artifacts/WI-A02/unit-test-results.txt)

### Integration tests (BDD)
**Artifact requirements**
- Mock service integration test

**Artifacts (add as relative links during work)**
- [../artifacts/WI-A02/integration-test-results.txt](../artifacts/WI-A02/integration-test-results.txt)

### E2E (BDD, Playwright)
**Artifact requirements**
- Navigate to /trials, verify trials display
- Click trial, verify navigation to /register/{id}

**Artifacts (add as relative links during work)**
- [../artifacts/WI-A02/playwright/trial-selection-trace.zip](../artifacts/WI-A02/playwright/trial-selection-trace.zip)

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
- Ensure trial card design matches PDF form branding expectations

## DTO Reference (from PRD_MVP_API_Contract.md)
```typescript
interface TrialSummaryDto {
  trialId: string;
  name: string;
  formTemplate: FormTemplateKey;
  organizerSlug: string;
  eventSlug: string;
  trackingSlug: string;
  hostClub: string;
  startDate: string; // ISO date
  endDate: string;   // ISO date
  location?: string;
  secretaryEmail: string;
  isActive: boolean;
}

interface FormTemplateKey {
  organizationCode: string;
  sportCode: string;
  formCode: string;
  version: string;
}
```
