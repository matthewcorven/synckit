# WI-A13: Secretary Detail

**Owner:** Agent A (UI-First)  
**Status:** Proposed  
**Milestone:** M5  
**Dependencies:** A12  
**Artifacts folder (recommended):** `../artifacts/WI-A13/`

## Goal
Implement the secretary entry detail view with PDF download capability.

## Scope
### In
- Entry detail page at `/secretary/entries/:entryId`
- Full entry display (read-only)
- PDF download button/link
- Processing status display
- Email notification status
- Back to list navigation
- Secretary role guard

### Out
- Entry list (see A12)
- Secretary endpoints (see B25)
- PDF generation (see B21-B22)

## Implementation notes
- API contract:
  - `GET /api/secretary/entries/{entryId}` returns `EntryDetailDto`
  - `GET /api/secretary/entries/{entryId}/pdf` returns `{ downloadUrl: string }`
- Display all entry fields read-only (same layout as form)
- Show processing status:
  - PDF status with download if available
  - Email notification status for both Handler and Secretary
- Download URL is SAS-signed, valid for limited time
- Consider: refresh status button for in-progress entries

## Acceptance criteria
- [x] Page displays at `/secretary/entries/{entryId}`
- [x] Route guarded for Secretary role
- [x] All entry fields displayed read-only
- [x] PDF download button works when PDF ready
- [x] PDF button disabled/hidden when PDF not ready
- [x] Processing status shown clearly
- [x] Email status shown for both recipients
- [x] Back navigation to list
- [x] **Retry PDF button shown when pdfStatus is Failed**
- [x] **Retry button calls POST /api/secretary/entries/{entryId}/pdf/retry**

## Test Plan
### Unit tests (TDD)
**Artifact requirements**
- SecretaryDetailComponent renders entry data
- PDF download triggers on button click
- Processing status displays correctly

**Artifacts (add as relative links during work)**
- [../artifacts/WI-A13/unit-test-results.txt](../artifacts/WI-A13/unit-test-results.txt)

### Integration tests (BDD)
**Artifact requirements**
- Service returns entry detail
- PDF URL fetch works

**Artifacts (add as relative links during work)**
- [../artifacts/WI-A13/integration-test-results.txt](../artifacts/WI-A13/integration-test-results.txt)

### E2E (BDD, Playwright)
**Artifact requirements**
- Login as Secretary, view entry detail
- Click PDF download, verify download starts
- Screenshot of detail view

**Artifacts (add as relative links during work)**
- [../artifacts/WI-A13/playwright/secretary-detail-trace.zip](../artifacts/WI-A13/playwright/secretary-detail-trace.zip)
- [../artifacts/WI-A13/playwright/secretary-detail-screenshot.png](../artifacts/WI-A13/playwright/secretary-detail-screenshot.png)

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
- SAS URL expiration handling (re-fetch if expired?)
- ~~Should secretary be able to trigger PDF regeneration on failure?~~ → **RESOLVED: Yes** - Add retry button for secretary

## DTO Reference (from PRD_MVP_API_Contract.md)
```typescript
// Entry detail
interface EntryDetailDto {
  entryId: string;
  trial: TrialSummaryDto;
  status: 'Draft' | 'Submitted';
  formTemplate: FormTemplateKey;
  dog: DogDto;
  contact: ContactDto;
  fees: FeesDto;
  emergencyContact: EmergencyContactDto;
  selections: {
    upper: SelectionItem[];
    lower: SelectionItem[];
  };
  terms: TermsAcceptanceDto;
  processing: ProcessingDto;
}

// Processing status
interface ProcessingDto {
  pdfStatus: 'Queued' | 'InProgress' | 'Success' | 'Failed';
  generatedPdf: {
    blobUri?: string;
    downloadUrl?: string;
  };
  emailNotifications: NotificationDto[];
  lastError?: {
    code: string;
    message: string;
  };
}

// PDF download response
interface PdfDownloadResponse {
  downloadUrl: string; // SAS URL
}
```

## Page Layout
```
┌─────────────────────────────────────────────────────────────┐
│ [← Back to List]                                            │
├─────────────────────────────────────────────────────────────┤
│ ENTRY DETAIL                                                │
│ Entry ID: f3e0e855-6522-4d4b-8d9e-34e61f9a4a75             │
│ Submitted: 2026-01-20 15:22:11 UTC                          │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ DOG INFORMATION                                         │ │
│ │ Breed: Australian Shepherd                              │ │
│ │ Call Name: Ranger                                       │ │
│ │ Reg #: OLDKYASCASPRING-2026-05-02-0001                   │ │
│ │ ...                                                     │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ CONTACT / EMERGENCY / FEES                              │ │
│ │ ...                                                     │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ CLASS SELECTIONS                                        │ │
│ │ [Grid display - read only]                              │ │
│ └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ PROCESSING STATUS                                           │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ PDF: ✓ Generated     [📥 Download PDF]                  │ │
│ │                                                         │ │
│ │ Email Notifications:                                    │ │
│ │   Handler: ✓ Sent 2026-01-20 15:22:30                  │ │
│ │   Secretary: ✓ Sent 2026-01-20 15:22:31                │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```
