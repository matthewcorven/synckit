import { FormTemplateKey } from './trial.model';

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
