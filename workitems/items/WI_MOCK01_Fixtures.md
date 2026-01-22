# WI-MOCK01: Mock Fixtures

**Owner:** Stream A (UI-first) — optional for Stream B  
**Status:** Proposed  
**Milestone:** M5 (optional)  
**Dependencies:** A01, A05  
**Artifacts folder (recommended):** `../artifacts/WI-MOCK01/`

## Goal
Create type-safe mock data fixtures for UI development and testing.

## Scope
### In
- `src/web/src/mocks/` folder structure
- TypeScript interfaces matching API DTOs
- Mock trial data
- Mock entry data (draft and submitted)
- Mock form metadata
- Mock user data
- Fixture factory functions
- MSW handlers (optional for API mocking)

### Out
- E2E test data (handled by TestAuth + DB seeding)
- Production data

## Implementation notes
- Types must match PRD API contract exactly
- Use factory functions for easy customization
- Include realistic test data
- Support both happy path and edge cases
- Consider MSW for development without API

## Acceptance criteria
- [ ] All API DTOs have corresponding TypeScript interfaces
- [ ] Mock trials available
- [ ] Mock entries available (multiple states)
- [ ] Mock form metadata matches PRD
- [ ] Factory functions work
- [ ] Documentation on usage

## Test Plan
### Unit tests (TDD)
**Artifact requirements**
- Types compile without errors
- Factory functions produce valid data

**Artifacts (add as relative links during work)**
- `../artifacts/WI-MOCK01/type-check.txt`

### Integration tests (BDD)
**Artifact requirements**
- N/A

**Artifacts (add as relative links during work)**
- N/A

### E2E (BDD, Playwright)
**Artifact requirements**
- N/A

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
- Keep in sync with API changes
- MSW setup complexity

## Folder Structure
```
src/web/src/mocks/
├── index.ts              # Main exports
├── types/
│   ├── index.ts          # Re-exports
│   ├── trial.ts          # Trial DTOs
│   ├── entry.ts          # Entry DTOs
│   ├── form-metadata.ts  # Form/grid DTOs
│   └── user.ts           # User/auth DTOs
├── fixtures/
│   ├── index.ts          # Re-exports
│   ├── trials.ts         # Mock trials
│   ├── entries.ts        # Mock entries
│   └── form-metadata.ts  # Mock form metadata
├── factories/
│   ├── index.ts          # Re-exports
│   ├── trial.factory.ts  # Trial factory
│   └── entry.factory.ts  # Entry factory
└── handlers/             # MSW handlers (optional)
    ├── index.ts
    ├── trials.ts
    └── entries.ts
```

## Type Definitions

### types/trial.ts
```typescript
export interface FormTemplateKey {
  organizationCode: string;
  sportCode: string;
  formCode: string;
  version: string;
}

export interface TrialSummaryDto {
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
```

### types/entry.ts
```typescript
export type EntryStatus = 'Draft' | 'Submitted';
export type PdfStatus = 'Queued' | 'InProgress' | 'Success' | 'Failed';
export type NotificationStatus = 'Queued' | 'InProgress' | 'Success' | 'Failed';
export type RecipientType = 'Handler' | 'Secretary';

export interface EntrySummaryDto {
  entryId: string;
  trialId: string;
  status: EntryStatus;
  submittedAtUtc?: string;
  handlerEmail: string;
  dogCallName: string;
  dogRegisteredName?: string;
  pdfStatus: PdfStatus;
}

export interface DogDto {
  registrationOrTrackingNumber?: string;
  breed: string;
  registeredName?: string;
  dob?: string;
  color?: string;
  callName: string;
  sex?: string;
  sire?: string;
  dam?: string;
  breeders?: string;
}

export interface AddressDto {
  street: string;
  city: string;
  state: string;
  zip: string;
}

export interface JuniorDto {
  dob?: string;
  memberId?: string;
}

export interface ContactDto {
  owners: string;
  ownerAddress?: AddressDto;
  email: string;
  phone?: string;
  handler?: string;
  membershipNumber?: string;
  junior?: JuniorDto;
}

export interface FeesDto {
  totalEntryFees: number;
  currency: string;
}

export interface EmergencyContactDto {
  name: string;
  phoneOrNumber: string;
}

export interface GridSelectionDto {
  row: string;
  col: string;
  value: string;
}

export interface SelectionsDto {
  upper: GridSelectionDto[];
  lower: GridSelectionDto[];
}

export interface TermsAcceptanceDto {
  version: string;
  acceptedAtUtc?: string;
  acceptedByUserId?: string;
}

export interface NotificationDto {
  recipientType: RecipientType;
  status: NotificationStatus;
  sentAtUtc?: string;
  lastError?: string;
}

export interface ProcessingDto {
  pdfStatus: PdfStatus;
  generatedPdf?: {
    blobUri?: string;
    downloadUrl?: string;
  };
  emailNotifications: NotificationDto[];
  lastError?: {
    code: string;
    message: string;
  };
}

export interface EntryDetailDto {
  entryId: string;
  trial: TrialSummaryDto;
  status: EntryStatus;
  formTemplate: FormTemplateKey;
  dog?: DogDto;
  contact?: ContactDto;
  fees?: FeesDto;
  emergencyContact?: EmergencyContactDto;
  selections?: SelectionsDto;
  terms?: TermsAcceptanceDto;
  processing?: ProcessingDto;
}
```

### types/form-metadata.ts
```typescript
export type GridId = 'Upper' | 'Lower';

export interface DisabledCell {
  row: string;
  col: string;
}

export interface GridMetadata {
  grid: GridId;
  rows: string[];
  cols: string[];
  disabledCells: DisabledCell[];
}

export interface FormMetadataDto {
  formTemplate: FormTemplateKey;
  grids: GridMetadata[];
}

export interface TrialRegistrationMetadataDto {
  trialId: string;
  formTemplate: FormTemplateKey;
  formMetadata: FormMetadataDto;
}
```

## Mock Fixtures

### fixtures/trials.ts
```typescript
import { TrialSummaryDto } from '../types';

export const mockTrials: TrialSummaryDto[] = [
  {
    trialId: '9d4a8d25-2c59-4f1f-8c79-6c63e74f5f49',
    name: 'Spring Stockdog Trial 2026',
    formTemplate: {
      organizationCode: 'ASCA',
      sportCode: 'StockDog',
      formCode: 'TrialEntry',
      version: '2020-10-08'
    },
    organizerSlug: 'EXCLUB',
    eventSlug: 'SPRING-2026-05-02',
    trackingSlug: 'EXCLUB-SPRING-2026-05-02',
    hostClub: 'Example Stockdog Club',
    startDate: '2026-05-02',
    endDate: '2026-05-03',
    location: 'Example Ranch, Bryan, TX',
    secretaryEmail: 'secretary@example.com',
    isActive: true
  },
  {
    trialId: 'b7e4f123-8a91-4d2e-9c56-7f82a1b3c4d5',
    name: 'Fall Championship 2026',
    formTemplate: {
      organizationCode: 'ASCA',
      sportCode: 'StockDog',
      formCode: 'TrialEntry',
      version: '2020-10-08'
    },
    organizerSlug: 'CHAMPCLUB',
    eventSlug: 'FALL-2026-10-15',
    trackingSlug: 'CHAMPCLUB-FALL-2026-10-15',
    hostClub: 'Championship Club',
    startDate: '2026-10-15',
    endDate: '2026-10-17',
    location: 'State Fairgrounds',
    secretaryEmail: 'fallsecretary@example.com',
    isActive: true
  }
];
```

### fixtures/form-metadata.ts
```typescript
import { FormMetadataDto, TrialRegistrationMetadataDto } from '../types';

export const mockFormMetadata: FormMetadataDto = {
  formTemplate: {
    organizationCode: 'ASCA',
    sportCode: 'StockDog',
    formCode: 'TrialEntry',
    version: '2020-10-08'
  },
  grids: [
    {
      grid: 'Upper',
      rows: ['Sheep', 'Cattle', 'Ducks', 'Mixed'],
      cols: ['STD', 'OPN', 'ADV', 'FTD_OPN', 'FTD_ADV', 'DATE1_TRIAL1', 'DATE1_TRIAL2'],
      disabledCells: [
        { row: 'Mixed', col: 'STD' },
        { row: 'Mixed', col: 'OPN' },
        { row: 'Mixed', col: 'ADV' },
        { row: 'Mixed', col: 'FTD_OPN' },
        { row: 'Mixed', col: 'FTD_ADV' }
      ]
    },
    {
      grid: 'Lower',
      rows: ['Sheep', 'Cattle', 'Ducks'],
      cols: ['NOV', 'WRK_JR_HNDLR', 'FEO', 'POST_ADV', 'RTD', 'DATE1_TRIAL1', 'DATE1_TRIAL2'],
      disabledCells: [
        { row: 'Ducks', col: 'POST_ADV' },
        { row: 'Ducks', col: 'RTD' }
      ]
    }
  ]
};
```

## Factory Functions

### factories/entry.factory.ts
```typescript
import { EntryDetailDto, EntryStatus, PdfStatus } from '../types';
import { mockTrials } from '../fixtures/trials';

let entryCounter = 0;

export function createMockEntry(overrides: Partial<EntryDetailDto> = {}): EntryDetailDto {
  entryCounter++;
  const entryId = overrides.entryId ?? crypto.randomUUID();
  const status: EntryStatus = overrides.status ?? 'Draft';
  
  return {
    entryId,
    trial: overrides.trial ?? mockTrials[0],
    status,
    formTemplate: {
      organizationCode: 'ASCA',
      sportCode: 'StockDog',
      formCode: 'TrialEntry',
      version: '2020-10-08'
    },
    dog: overrides.dog ?? {
      breed: 'Australian Shepherd',
      callName: `TestDog${entryCounter}`,
      registeredName: `Test's Amazing Dog ${entryCounter}`,
      dob: '2021-04-10',
      color: 'Blue Merle',
      sex: 'Male'
    },
    contact: overrides.contact ?? {
      owners: 'Test Owner',
      email: 'handler@test.com',
      phone: '555-555-5555',
      ownerAddress: {
        street: '123 Test St',
        city: 'Bryan',
        state: 'TX',
        zip: '77801'
      }
    },
    selections: overrides.selections ?? {
      upper: [{ row: 'Sheep', col: 'STD', value: 'X' }],
      lower: []
    },
    processing: status === 'Submitted' ? {
      pdfStatus: 'Queued' as PdfStatus,
      emailNotifications: [
        { recipientType: 'Handler', status: 'Queued' },
        { recipientType: 'Secretary', status: 'Queued' }
      ]
    } : undefined,
    ...overrides
  };
}

export function createSubmittedEntry(overrides: Partial<EntryDetailDto> = {}): EntryDetailDto {
  return createMockEntry({
    status: 'Submitted',
    dog: {
      ...createMockEntry().dog!,
      registrationOrTrackingNumber: `EXCLUB-SPRING-2026-05-02-${String(entryCounter).padStart(4, '0')}`
    },
    terms: {
      version: 'v1',
      acceptedAtUtc: new Date().toISOString()
    },
    processing: {
      pdfStatus: 'Success',
      generatedPdf: {
        downloadUrl: 'https://example.com/mock-pdf'
      },
      emailNotifications: [
        { recipientType: 'Handler', status: 'Success', sentAtUtc: new Date().toISOString() },
        { recipientType: 'Secretary', status: 'Success', sentAtUtc: new Date().toISOString() }
      ]
    },
    ...overrides
  });
}
```

## Usage Example
```typescript
import { mockTrials, createMockEntry, createSubmittedEntry } from '@/mocks';

// In component or test
const trial = mockTrials[0];
const draftEntry = createMockEntry({ trial });
const submittedEntry = createSubmittedEntry({ trial });
```
