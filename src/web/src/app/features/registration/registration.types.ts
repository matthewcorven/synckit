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
  formTemplate: {
    organizationCode: string;
    sportCode: string;
    formCode: string;
    version: string;
  };
  grids: GridMetadata[];
}

export interface TrialRegistrationMetadataDto {
  trialId: string;
  formTemplate: {
    organizationCode: string;
    sportCode: string;
    formCode: string;
    version: string;
  };
  formMetadata: FormMetadataDto;
}

export interface TermsDto {
  version: string;
  html: string;
}

export interface GridSelectionItem {
  row: string;
  col: string;
  value: string;
}

export interface SubmitEntryRequestDto {
  acceptTerms: boolean;
  termsVersion: string;
}

export interface SubmitEntryResponseDto {
  entryId: string;
  status: 'Submitted';
  supportId: string;
}

export interface SubmitEntryResult {
  entryId: string;
  status: 'Submitted';
  supportId: string;
}

export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  traceId?: string;
  errors?: Record<string, string[]>;
  errorCode?: string;
}

export interface SubmissionReceipt {
  entryId: string;
  trialId: string;
  supportId: string;
  submittedAtUtc: string;
}
