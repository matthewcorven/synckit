import { EntrySummaryDto } from './secretary.types';

export const SECRETARY_ENTRY_SUMMARY_MOCK_DATA: EntrySummaryDto[] = [
  {
    entryId: 'd7b99d91-2c6a-4fd0-9d4f-7c49d88c7b10',
    trialId: '9d4a8d25-2c59-4f1f-8c79-6c63e74f5f49',
    status: 'Submitted',
    submittedAtUtc: '2026-01-20T16:12:00Z',
    handlerEmail: 'jane@email.com',
    dogCallName: 'Ranger',
    dogRegisteredName: 'Ranger Blue Sky',
    pdfStatus: 'Success'
  },
  {
    entryId: 'b1a5f3a4-f135-4c89-9e6c-10a8e53b21fd',
    trialId: '9d4a8d25-2c59-4f1f-8c79-6c63e74f5f49',
    status: 'Submitted',
    submittedAtUtc: '2026-01-19T14:45:00Z',
    handlerEmail: 'bob@email.com',
    dogCallName: 'Scout',
    dogRegisteredName: 'Scout Riverbend',
    pdfStatus: 'InProgress'
  },
  {
    entryId: '3f3d9c9c-8f62-4cc4-a5a1-45e284f5f8a8',
    trialId: '9d4a8d25-2c59-4f1f-8c79-6c63e74f5f49',
    status: 'Submitted',
    submittedAtUtc: '2026-01-19T11:20:00Z',
    handlerEmail: 'mary@email.com',
    dogCallName: 'Duke',
    dogRegisteredName: 'Duke of Meadow',
    pdfStatus: 'Failed'
  },
  {
    entryId: '971c7bdb-2b3d-4cdf-9f1e-9b1f2c0b9a8f',
    trialId: 'a1b2c3d4-5678-90ab-cdef-1234567890ab',
    status: 'Submitted',
    submittedAtUtc: '2026-01-18T09:12:00Z',
    handlerEmail: 'kai@email.com',
    dogCallName: 'Echo',
    dogRegisteredName: 'Echo Summerset',
    pdfStatus: 'Queued'
  }
];
