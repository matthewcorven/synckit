import { EntryDetailDto, NotificationDto } from './secretary.types';

const notifications: NotificationDto[] = [
  {
    recipientType: 'Handler',
    status: 'Success',
    sentAtUtc: '2026-01-20T15:22:30Z',
    lastError: null
  },
  {
    recipientType: 'Secretary',
    status: 'Success',
    sentAtUtc: '2026-01-20T15:22:31Z',
    lastError: null
  }
];

export const SECRETARY_ENTRY_DETAIL_MOCKS: EntryDetailDto[] = [
  {
    entryId: 'd7b99d91-2c6a-4fd0-9d4f-7c49d88c7b10',
    entryNumber: 'OLDKYASCASPRING-2026-05-02-0001',
    submittedAtUtc: '2026-01-20T15:22:11Z',
    trial: {
      trialId: '9d4a8d25-2c59-4f1f-8c79-6c63e74f5f49',
      name: 'Spring Stockdog Trial',
      organizationName: 'Australian Shepherd Club of America',
      sportName: 'Stock Dog',
      formName: 'Trial Entry Form',
      formTemplate: {
        organizationCode: 'ASCA',
        sportCode: 'StockDog',
        formCode: 'TrialEntry',
        version: '2020-10-08'
      },
      organizerSlug: 'EXCLUB',
      eventSlug: 'SPRING-2026-05-02',
      trackingSlug: 'OLDKYASCASPRING-2026-05-02',
      hostClub: 'Old Fashioned KY ASCA Club',
      startDate: '2026-05-02',
      endDate: '2026-05-04',
      location: 'Horse Cave, KY',
      secretaryEmail: 'secretary@example.com',
      isActive: true
    },
    status: 'Submitted',
    formTemplate: {
      organizationCode: 'ASCA',
      sportCode: 'StockDog',
      formCode: 'TrialEntry',
      version: '2020-10-08'
    },
    dog: {
      ascaRegistrationNumber: 'E-12345',
      breed: 'Australian Shepherd',
      registeredName: 'Ranger Blue Sky',
      dob: '2021-04-10',
      color: 'Blue Merle',
      callName: 'Ranger',
      sex: 'Male',
      sire: 'Sire Name',
      dam: 'Dam Name',
      breeders: 'Breeder Name'
    },
    contact: {
      owners: 'Owner One; Owner Two',
      ownerAddress: {
        street: '123 Main St',
        city: 'Bryan',
        state: 'TX',
        zip: '77801'
      },
      email: 'handler@example.com',
      phone: '555-555-5555',
      handler: 'Handler Name',
      membershipNumber: 'ASCA-1234',
      junior: {
        dob: '2012-07-15',
        memberId: 'JR-445'
      }
    },
    fees: {
      totalEntryFees: 25.0,
      currency: 'USD'
    },
    emergencyContact: {
      name: 'Emergency Contact',
      phoneOrNumber: '555-111-2222'
    },
    selections: {
      upper: [
        { row: 'Sheep', col: 'STD', value: 'X' },
        { row: 'Sheep', col: 'DATE1_TRIAL1', value: 'X' }
      ],
      lower: [{ row: 'Sheep', col: 'NOV', value: 'X' }]
    },
    terms: {
      version: 'v1',
      acceptedAtUtc: '2026-01-20T15:20:00Z',
      acceptedByUserId: '5b2b6af8-9e2f-4b35-9d3f-6f7b1a9c2e3f'
    },
    processing: {
      pdfStatus: 'Success',
      generatedPdf: {
        blobUri: 'https://storage.example.com/entries/d7b99d91-2c6a-4fd0-9d4f-7c49d88c7b10.pdf',
        downloadUrl: 'data:application/pdf;base64,JVBERi0xLjQKJcTl8uXrp/Og0MTGCjEgMCBvYmoKPDwvVHlwZS9DYXRhbG9nL1BhZ2VzIDIgMCBSPj4KZW5kb2JqCjIgMCBvYmoKPDwvVHlwZS9QYWdlcy9Db3VudCAxL0tpZHNbMyAwIFJdPj4KZW5kb2JqCjMgMCBvYmoKPDwvVHlwZS9QYWdlL1BhcmVudCAyIDAgUi9NZWRpYUJveFswIDAgMjAwIDIwMF0vQ29udGVudHMgNCAwIFI+PgplbmRvYmoKNCAwIG9iago8PC9MZW5ndGggNDQ+PnN0cmVhbQpCVCAvRjEgMTIgVGYgNzIgMTQ0IFRkIChQREYpIFRqIEVUCmVuZHN0cmVhbQplbmRvYmoKeHJlZgowIDUKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDEwIDAwMDAwIG4gCjAwMDAwMDAwNTcgMDAwMDAgbiAKMDAwMDAwMDEwNCAwMDAwMCBuIAowMDAwMDAwMTkzIDAwMDAwIG4gCnRyYWlsZXIKPDwvUm9vdCAxIDAgUi9TaXplIDU+PgpzdGFydHhyZWYKMjUwCiUlRU9G'
      },
      emailNotifications: notifications,
      lastError: null
    }
  },
  {
    entryId: '3f3d9c9c-8f62-4cc4-a5a1-45e284f5f8a8',
    entryNumber: 'OLDKYASCASPRING-2026-05-02-0003',
    submittedAtUtc: '2026-01-19T11:20:00Z',
    trial: {
      trialId: '9d4a8d25-2c59-4f1f-8c79-6c63e74f5f49',
      name: 'Spring Stockdog Trial',
      organizationName: 'Australian Shepherd Club of America',
      sportName: 'Stock Dog',
      formName: 'Trial Entry Form',
      formTemplate: {
        organizationCode: 'ASCA',
        sportCode: 'StockDog',
        formCode: 'TrialEntry',
        version: '2020-10-08'
      },
      organizerSlug: 'EXCLUB',
      eventSlug: 'SPRING-2026-05-02',
      trackingSlug: 'OLDKYASCASPRING-2026-05-02',
      hostClub: 'Old Fashioned KY ASCA Club',
      startDate: '2026-05-02',
      endDate: '2026-05-04',
      location: 'Horse Cave, KY',
      secretaryEmail: 'secretary@example.com',
      isActive: true
    },
    status: 'Submitted',
    formTemplate: {
      organizationCode: 'ASCA',
      sportCode: 'StockDog',
      formCode: 'TrialEntry',
      version: '2020-10-08'
    },
    dog: {
      ascaRegistrationNumber: 'E-98765',
      breed: 'Australian Shepherd',
      registeredName: 'Duke of Meadow',
      dob: '2020-10-12',
      color: 'Red Merle',
      callName: 'Duke',
      sex: 'Male',
      sire: 'Sire Name',
      dam: 'Dam Name',
      breeders: 'Breeder Name'
    },
    contact: {
      owners: 'Mary Owner',
      ownerAddress: {
        street: '456 Oak Ave',
        city: 'Nashville',
        state: 'TN',
        zip: '37209'
      },
      email: 'mary@email.com',
      phone: '555-555-1212',
      handler: 'Mary Owner',
      membershipNumber: 'ASCA-8844',
      junior: null
    },
    fees: {
      totalEntryFees: 25.0,
      currency: 'USD'
    },
    emergencyContact: {
      name: 'Emergency Contact',
      phoneOrNumber: '555-111-3333'
    },
    selections: {
      upper: [{ row: 'Sheep', col: 'OPN', value: 'X' }],
      lower: [{ row: 'Sheep', col: 'NOV', value: 'X' }]
    },
    terms: {
      version: 'v1',
      acceptedAtUtc: '2026-01-19T11:18:00Z',
      acceptedByUserId: 'b0b2f6ac-1234-4c2a-8b6d-7c8c9d0e1f2a'
    },
    processing: {
      pdfStatus: 'Failed',
      generatedPdf: null,
      emailNotifications: [
        {
          recipientType: 'Handler',
          status: 'Failed',
          sentAtUtc: null,
          lastError: 'EMAIL_FAILED'
        },
        {
          recipientType: 'Secretary',
          status: 'Queued',
          sentAtUtc: null,
          lastError: null
        }
      ],
      lastError: {
        code: 'PDF_STAMP_FAILED',
        message: 'PDF generation failed; retry required.'
      }
    }
  }
];

export function findSecretaryEntryDetail(entryId: string): EntryDetailDto | null {
  return SECRETARY_ENTRY_DETAIL_MOCKS.find((entry) => entry.entryId === entryId) ?? null;
}
