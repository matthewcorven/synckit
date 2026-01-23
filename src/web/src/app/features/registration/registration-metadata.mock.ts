import { FormMetadataDto, TrialRegistrationMetadataDto } from './registration.types';

const FORM_METADATA_MOCK: FormMetadataDto = {
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
      cols: [
        'STD',
        'OPN',
        'ADV',
        'FTD_OPN',
        'FTD_ADV',
        'DATE1_TRIAL1',
        'DATE1_TRIAL2',
        'DATE2_TRIAL1',
        'DATE2_TRIAL2',
        'DATE3_TRIAL1',
        'DATE3_TRIAL2'
      ],
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
      cols: [
        'NOV',
        'WRK_JR_HNDLR',
        'FEO',
        'POST_ADV',
        'RTD',
        'DATE1_TRIAL1',
        'DATE1_TRIAL2',
        'DATE2_TRIAL1',
        'DATE2_TRIAL2',
        'DATE3_TRIAL1',
        'DATE3_TRIAL2'
      ],
      disabledCells: [
        { row: 'Ducks', col: 'POST_ADV' },
        { row: 'Ducks', col: 'RTD' }
      ]
    }
  ]
};

export const buildRegistrationMetadataMock = (
  trialId: string
): TrialRegistrationMetadataDto => ({
  trialId,
  formTemplate: FORM_METADATA_MOCK.formTemplate,
  formMetadata: FORM_METADATA_MOCK
});
