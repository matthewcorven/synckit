# WI-A15: Mocks Folder

**Owner:** Agent A (UI-First)  
**Status:** Proposed  
**Milestone:** M1  
**Dependencies:** A01  
**Artifacts folder (recommended):** `../artifacts/WI-A15/`

## Goal
Create the mocks folder structure with typed fixtures matching API contract DTOs.

## Scope
### In
- `src/web/mocks/` folder structure
- Mock fixture files:
  - `trials.mock.json`
  - `formMetadata.mock.json`
  - `entry.mock.json`
  - `terms.mock.json`
- TypeScript interfaces matching DTOs
- `useMocks` environment flag integration
- Mock data loader service

### Out
- API integration (see B11, etc.)
- Actual form implementation (see A03-A08)

## Implementation notes
- Mock files should exactly match API contract DTOs
- Use realistic sample data (ASCA-like trial info)
- Types should be in `src/web/app/shared/models/`
- Mock service checks `environment.useMocks` flag
- Provide 2-3 sample trials for testing
- Include disabled cell configuration in formMetadata

## Acceptance criteria
- [ ] Mocks folder created at `src/web/mocks/`
- [ ] All mock files contain valid JSON matching DTOs
- [ ] TypeScript interfaces exist for all DTOs
- [ ] MockDataService loads fixtures when `useMocks=true`
- [ ] Sample data is realistic (ASCA stockdog)
- [ ] Form metadata includes disabled cells

## Test Plan
### Unit tests (TDD)
**Artifact requirements**
- Mock files parse without error
- MockDataService returns correct types
- Environment flag toggles behavior

**Artifacts (add as relative links during work)**
- `../artifacts/WI-A15/unit-test-results.txt`

### Integration tests (BDD)
**Artifact requirements**
- Services use mock data when configured

**Artifacts (add as relative links during work)**
- `../artifacts/WI-A15/integration-test-results.txt`

### E2E (BDD, Playwright)
**Artifact requirements**
- N/A — data verification only

**Artifacts (add as relative links during work)**
- N/A

### DB verification
**Artifact requirements**
- N/A

**Artifacts (add as relative links during work)**
- N/A

### Telemetry verification
- N/A

**Artifact requirements**
- N/A

**Artifacts (add as relative links during work)**
- N/A

## Risks / Questions
- Keep mocks in sync with API contract changes
- Consider JSON schema validation

## Folder Structure
```
src/web/
├── mocks/
│   ├── trials.mock.json
│   ├── formMetadata.mock.json
│   ├── entry.mock.json
│   └── terms.mock.json
└── src/app/
    └── shared/
        └── models/
            ├── trial.model.ts
            ├── entry.model.ts
            ├── form-metadata.model.ts
            └── terms.model.ts
```

## Mock File Contents

### trials.mock.json
```json
[
  {
    "trialId": "9d4a8d25-2c59-4f1f-8c79-6c63e74f5f49",
    "name": "Spring Stockdog Trial 2026",
    "formTemplate": {
      "organizationCode": "ASCA",
      "sportCode": "StockDog",
      "formCode": "TrialEntry",
      "version": "2020-10-08"
    },
    "organizerSlug": "EXCLUB",
    "eventSlug": "SPRING-2026-05-02",
    "trackingSlug": "EXCLUB-SPRING-2026-05-02",
    "hostClub": "Example Stockdog Club",
    "startDate": "2026-05-02",
    "endDate": "2026-05-03",
    "location": "Bryan, TX",
    "secretaryEmail": "secretary@exclub.org",
    "isActive": true
  },
  {
    "trialId": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
    "name": "Fall Championship 2026",
    "formTemplate": {
      "organizationCode": "ASCA",
      "sportCode": "StockDog",
      "formCode": "TrialEntry",
      "version": "2020-10-08"
    },
    "organizerSlug": "EXCLUB",
    "eventSlug": "FALL-2026-10-15",
    "trackingSlug": "EXCLUB-FALL-2026-10-15",
    "hostClub": "Example Stockdog Club",
    "startDate": "2026-10-15",
    "endDate": "2026-10-17",
    "location": "Austin, TX",
    "secretaryEmail": "secretary@exclub.org",
    "isActive": true
  }
]
```

### formMetadata.mock.json
```json
{
  "formTemplate": {
    "organizationCode": "ASCA",
    "sportCode": "StockDog",
    "formCode": "TrialEntry",
    "version": "2020-10-08"
  },
  "grids": [
    {
      "grid": "Upper",
      "rows": ["Sheep", "Cattle", "Ducks", "Mixed"],
      "cols": ["STD", "OPN", "ADV", "FTD_OPN", "FTD_ADV", "DATE1_TRIAL1", "DATE1_TRIAL2"],
      "disabledCells": [
        { "row": "Mixed", "col": "STD" },
        { "row": "Mixed", "col": "OPN" },
        { "row": "Mixed", "col": "ADV" },
        { "row": "Mixed", "col": "FTD_OPN" },
        { "row": "Mixed", "col": "FTD_ADV" }
      ]
    },
    {
      "grid": "Lower",
      "rows": ["Sheep", "Cattle", "Ducks"],
      "cols": ["NOV", "WRK_JR_HNDLR", "FEO", "POST_ADV", "RTD", "DATE1_TRIAL1", "DATE1_TRIAL2"],
      "disabledCells": [
        { "row": "Ducks", "col": "POST_ADV" },
        { "row": "Ducks", "col": "RTD" }
      ]
    }
  ]
}
```

### entry.mock.json
```json
{
  "entryId": "f3e0e855-6522-4d4b-8d9e-34e61f9a4a75",
  "trial": {
    "trialId": "9d4a8d25-2c59-4f1f-8c79-6c63e74f5f49",
    "name": "Spring Stockdog Trial 2026",
    "organizerSlug": "EXCLUB",
    "eventSlug": "SPRING-2026-05-02",
    "trackingSlug": "EXCLUB-SPRING-2026-05-02",
    "hostClub": "Example Stockdog Club",
    "startDate": "2026-05-02",
    "endDate": "2026-05-03",
    "secretaryEmail": "secretary@exclub.org"
  },
  "status": "Draft",
  "formTemplate": {
    "organizationCode": "ASCA",
    "sportCode": "StockDog",
    "formCode": "TrialEntry",
    "version": "2020-10-08"
  },
  "dog": {
    "registrationOrTrackingNumber": null,
    "breed": "Australian Shepherd",
    "registeredName": "Example's Blue Lightning",
    "dob": "2021-04-10",
    "color": "Blue Merle",
    "callName": "Ranger",
    "sex": "Male",
    "sire": "Champion Sire Name",
    "dam": "Champion Dam Name",
    "breeders": "Example Breeders"
  },
  "contact": {
    "owners": "Jane Handler",
    "ownerAddress": {
      "street": "123 Main St",
      "city": "Bryan",
      "state": "TX",
      "zip": "77801"
    },
    "email": "jane@example.com",
    "phone": "555-555-5555",
    "handler": null,
    "membershipNumber": "12345",
    "junior": null
  },
  "fees": {
    "totalEntryFees": 75.00,
    "currency": "USD"
  },
  "emergencyContact": {
    "name": "John Emergency",
    "phoneOrNumber": "555-111-2222"
  },
  "selections": {
    "upper": [
      { "row": "Sheep", "col": "STD", "value": "X" },
      { "row": "Sheep", "col": "DATE1_TRIAL1", "value": "X" }
    ],
    "lower": [
      { "row": "Sheep", "col": "NOV", "value": "X" }
    ]
  },
  "terms": {
    "version": "v1",
    "acceptedAtUtc": null,
    "acceptedByUserId": null
  },
  "processing": {
    "pdfStatus": "Queued",
    "generatedPdf": {
      "blobUri": null,
      "downloadUrl": null
    },
    "emailNotifications": [],
    "lastError": null
  }
}
```

### terms.mock.json
```json
{
  "version": "v1",
  "html": "<h1>Terms and Conditions</h1><p>By submitting this entry, I agree to the following terms...</p><h2>1. Agreement to Rules</h2><p>I agree to abide by all ASCA rules and regulations.</p><h2>2. Liability Waiver</h2><p>I understand that participation involves inherent risks...</p><h2>3. Photo/Video Release</h2><p>I grant permission for photos and videos taken during the event...</p>"
}
```
