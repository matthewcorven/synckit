import { GridSelectionItem } from '../registration/registration.types';
import { FormTemplateKey, TrialSummaryDto } from '../trials/trial.types';

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

export interface EntryDetailDto {
  entryId: string;
  trial: TrialSummaryDto;
  status: EntryStatus;
  formTemplate: FormTemplateKey;
  entryNumber?: string | null;
  submittedAtUtc?: string | null;
  dog: DogDto;
  contact: ContactDto;
  fees: FeesDto;
  emergencyContact: EmergencyContactDto;
  selections: {
    upper: GridSelectionItem[];
    lower: GridSelectionItem[];
  };
  terms: TermsAcceptanceDto;
  processing: ProcessingDto;
}

export interface DogDto {
  ascaRegistrationNumber?: string | null;
  breed?: string | null;
  registeredName?: string | null;
  dob?: string | null;
  color?: string | null;
  callName?: string | null;
  sex?: string | null;
  sire?: string | null;
  dam?: string | null;
  breeders?: string | null;
}

export interface ContactDto {
  owners?: string | null;
  ownerAddress?: OwnerAddressDto | null;
  email?: string | null;
  phone?: string | null;
  handler?: string | null;
  membershipNumber?: string | null;
  junior?: JuniorDto | null;
}

export interface OwnerAddressDto {
  street?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}

export interface JuniorDto {
  dob?: string | null;
  memberId?: string | null;
}

export interface FeesDto {
  totalEntryFees?: number | null;
  currency?: string | null;
}

export interface EmergencyContactDto {
  name?: string | null;
  phoneOrNumber?: string | null;
}

export interface TermsAcceptanceDto {
  version?: string | null;
  acceptedAtUtc?: string | null;
  acceptedByUserId?: string | null;
}

export type NotificationStatus = 'Queued' | 'InProgress' | 'Success' | 'Failed';
export type NotificationRecipientType = 'Handler' | 'Secretary';

export interface NotificationDto {
  recipientType: NotificationRecipientType;
  status: NotificationStatus;
  sentAtUtc?: string | null;
  lastError?: string | null;
}

export interface ProcessingDto {
  pdfStatus: PdfStatus;
  generatedPdf?: {
    blobUri?: string | null;
    downloadUrl?: string | null;
  } | null;
  emailNotifications: NotificationDto[];
  lastError?: {
    code: string;
    message: string;
  } | null;
}

export interface PdfDownloadResponse {
  downloadUrl: string;
}
