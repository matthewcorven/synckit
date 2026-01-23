import { TestBed } from '@angular/core/testing';
import { FormArray, FormGroup } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { LowerGridSectionComponent } from './lower-grid-section.component';
import { TrialSummaryDto } from '../../trials/trial.types';
import { GridMetadata } from '../registration.types';

const mockTrial: TrialSummaryDto = {
  trialId: 'trial-123',
  name: 'Mock Trial',
  organizationName: 'Australian Shepherd Club of America',
  sportName: 'Stock Dog',
  formName: 'Trial Entry Form',
  formTemplate: {
    organizationCode: 'ASCA',
    sportCode: 'StockDog',
    formCode: 'TrialEntry',
    version: '2020-10-08'
  },
  organizerSlug: 'ORG',
  eventSlug: 'EVENT',
  trackingSlug: 'ORG-EVENT',
  hostClub: 'Old Fashioned KY ASCA Club',
  startDate: '2026-05-02',
  endDate: '2026-05-03',
  location: 'Bryan, TX',
  secretaryEmail: 'secretary@example.com',
  isActive: true
};

const mockLowerGrid: GridMetadata = {
  grid: 'Lower',
  rows: ['Sheep', 'Cattle', 'Ducks'],
  cols: [
    'NOV',
    'WRK_JR_HNDLR',
    'FEO',
    'POST_ADV',
    'RTD',
    'DATE1_TRIAL1',
    'DATE1_TRIAL2'
  ],
  disabledCells: [
    { row: 'Ducks', col: 'POST_ADV' },
    { row: 'Ducks', col: 'RTD' }
  ]
};

describe('LowerGridSectionComponent', () => {
  it('renders rows and columns from metadata', async () => {
    await TestBed.configureTestingModule({
      imports: [LowerGridSectionComponent, NoopAnimationsModule]
    }).compileComponents();

    const fixture = TestBed.createComponent(LowerGridSectionComponent);
    fixture.componentInstance.trial = mockTrial;
    fixture.componentInstance.gridMetadata = mockLowerGrid;
    fixture.componentInstance.selectionsControl = new FormArray<FormGroup>([]);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const rowLabels = element.querySelectorAll('th.row-label');
    const headerCells = element.querySelectorAll('th.class-head');
    const firstRowCells = element.querySelectorAll('tbody tr:first-child td');

    expect(rowLabels.length).toBe(mockLowerGrid.rows.length);
    expect(headerCells.length).toBe(5);
    expect(firstRowCells.length).toBe(mockLowerGrid.cols.length);
  });

  it('marks disabled cells as non-interactive', async () => {
    await TestBed.configureTestingModule({
      imports: [LowerGridSectionComponent, NoopAnimationsModule]
    }).compileComponents();

    const fixture = TestBed.createComponent(LowerGridSectionComponent);
    fixture.componentInstance.trial = mockTrial;
    fixture.componentInstance.gridMetadata = mockLowerGrid;
    fixture.componentInstance.selectionsControl = new FormArray<FormGroup>([]);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const ducksPost = element.querySelector(
      'button[aria-label="Ducks POST ADV"]'
    ) as HTMLButtonElement;

    expect(ducksPost).toBeTruthy();
    expect(ducksPost.disabled).toBe(true);
  });

  it('toggles selection values in the form array', async () => {
    await TestBed.configureTestingModule({
      imports: [LowerGridSectionComponent, NoopAnimationsModule]
    }).compileComponents();

    const selections = new FormArray<FormGroup>([]);
    const fixture = TestBed.createComponent(LowerGridSectionComponent);
    fixture.componentInstance.trial = mockTrial;
    fixture.componentInstance.gridMetadata = mockLowerGrid;
    fixture.componentInstance.selectionsControl = selections;
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const sheepNov = element.querySelector(
      'button[aria-label="Sheep NOV"]'
    ) as HTMLButtonElement;

    sheepNov.click();
    fixture.detectChanges();

    expect(selections.value).toEqual([{ row: 'Sheep', col: 'NOV', value: 'X' }]);

    sheepNov.click();
    fixture.detectChanges();

    expect(selections.length).toBe(0);
  });

  it('moves focus with arrow keys', async () => {
    await TestBed.configureTestingModule({
      imports: [LowerGridSectionComponent, NoopAnimationsModule]
    }).compileComponents();

    const fixture = TestBed.createComponent(LowerGridSectionComponent);
    fixture.componentInstance.trial = mockTrial;
    fixture.componentInstance.gridMetadata = mockLowerGrid;
    fixture.componentInstance.selectionsControl = new FormArray<FormGroup>([]);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const sheepNov = element.querySelector(
      'button[aria-label="Sheep NOV"]'
    ) as HTMLButtonElement;
    const sheepWrk = element.querySelector(
      'button[aria-label="Sheep WRK JR HNDLR"]'
    ) as HTMLButtonElement;

    sheepNov.focus();
    sheepNov.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    fixture.detectChanges();

    expect(document.activeElement).toBe(sheepWrk);
  });
});
