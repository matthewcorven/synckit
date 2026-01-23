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
