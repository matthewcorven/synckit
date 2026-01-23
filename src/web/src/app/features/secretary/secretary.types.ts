export type EntryStatus = 'Draft' | 'Submitted';

export type PdfStatus = 'Queued' | 'InProgress' | 'Success' | 'Failed';

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

export interface PaginatedEntrySummaryResponse {
  items: EntrySummaryDto[];
  page: number;
  pageSize: number;
  total: number;
}
