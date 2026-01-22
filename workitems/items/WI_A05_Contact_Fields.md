# WI-A05: Contact Fields

**Owner:** Agent A (UI-First)  
**Status:** Proposed  
**Milestone:** M2  
**Dependencies:** A03  
**Artifacts folder (recommended):** `../artifacts/WI-A05/`

## Goal
Implement the Owner/Handler Contact section with address sub-form and junior handler fields.

## Scope
### In
- Contact section reactive form group
- Owner fields:
  - Owners (required)
  - Owner Address (street, city, state, zip)
- Handler fields:
  - Email (required)
  - Phone (required)
  - Handler name (optional, if different from owner)
  - Membership Number
- Junior Handler sub-section:
  - Junior DOB
  - Junior Member ID
- Field-level validation

### Out
- Form layout container (see A03)
- Other form sections (see A04, A06)
- Email constraint logic (server-side, see B14)

## Implementation notes
- Email field should use email input type
- Phone field should accept various formats
- Address is a nested form group
- Junior handler section may be collapsible or conditional
- MVP rule: `contact.email` must match authenticated user email (enforced server-side)
- Validation rules:
  - `owners`: required
  - `email`: required, valid email format
  - `phone`: required
  - Address fields: all optional but if any provided, validate format

## Acceptance criteria
- [ ] Contact section displays all fields from API contract
- [ ] Address fields are grouped visually
- [ ] Junior handler section is clearly labeled
- [ ] Email validation shows format errors
- [ ] Phone accepts various formats
- [ ] Required fields show asterisk indicator
- [ ] Form values bind to parent form group

## Test Plan
### Unit tests (TDD)
**Artifact requirements**
- ContactFieldsComponent initializes all form controls
- Address sub-form validates correctly
- Email format validation works

**Artifacts (add as relative links during work)**
- `../artifacts/WI-A05/unit-test-results.txt`

### Integration tests (BDD)
**Artifact requirements**
- Form group integration with parent form

**Artifacts (add as relative links during work)**
- `../artifacts/WI-A05/integration-test-results.txt`

### E2E (BDD, Playwright)
**Artifact requirements**
- Fill all contact fields, verify values persist
- Enter invalid email, verify error shows

**Artifacts (add as relative links during work)**
- `../artifacts/WI-A05/playwright/contact-fields-trace.zip`

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
- Confirm state field should be dropdown vs free text
- International address format considerations (MVP: US only?)

## DTO Reference (from PRD_MVP_API_Contract.md)
```typescript
interface ContactDto {
  owners: string;                  // Required
  ownerAddress: AddressDto;
  email: string;                   // Required
  phone: string;                   // Required
  handler?: string;                // Optional, if different from owner
  membershipNumber?: string;
  junior?: JuniorDto;
}

interface AddressDto {
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
}

interface JuniorDto {
  dob?: string;     // ISO date
  memberId?: string;
}
```

## Field Layout
```
┌─────────────────────────────────────────┐
│ OWNER/HANDLER INFORMATION               │
├─────────────────────────────────────────┤
│ Owners*                                 │
│ [_____________________________________] │
├─────────────────────────────────────────┤
│ Owner Address                           │
│ Street: [_____________________________] │
│ City: [__________] State: [__] Zip:[__] │
├──────────────────┬──────────────────────┤
│ Email*           │ Phone*               │
│ [___________]    │ [_______________]    │
├──────────────────┼──────────────────────┤
│ Handler          │ Membership #         │
│ [___________]    │ [_______________]    │
├─────────────────────────────────────────┤
│ JUNIOR HANDLER (if applicable)          │
│ DOB: [📅 _______] Member ID: [________] │
└─────────────────────────────────────────┘
```
