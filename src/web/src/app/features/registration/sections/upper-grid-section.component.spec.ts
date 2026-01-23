import { TestBed } from '@angular/core/testing';
import { FormArray, FormGroup } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { UpperGridSectionComponent } from './upper-grid-section.component';
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

const mockUpperGrid: GridMetadata = {
  grid: 'Upper',
  rows: ['Sheep', 'Cattle', 'Ducks', 'Mixed'],
  cols: [
    'STD',
    'OPN',
    'ADV',
    'FTD_OPN',
    'FTD_ADV',
    'DATE1_TRIAL1',
    'DATE1_TRIAL2'
  ],
  disabledCells: [
    { row: 'Mixed', col: 'STD' },
    { row: 'Mixed', col: 'OPN' },
    { row: 'Mixed', col: 'ADV' },
    { row: 'Mixed', col: 'FTD_OPN' },
    { row: 'Mixed', col: 'FTD_ADV' }
  ]
};

describe('UpperGridSectionComponent', () => {
  it('renders rows and columns from metadata', async () => {
    await TestBed.configureTestingModule({
      imports: [UpperGridSectionComponent, NoopAnimationsModule]
    }).compileComponents();

    const fixture = TestBed.createComponent(UpperGridSectionComponent);
    fixture.componentInstance.trial = mockTrial;
    fixture.componentInstance.gridMetadata = mockUpperGrid;
    fixture.componentInstance.selectionsControl = new FormArray<FormGroup>([]);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const rowLabels = element.querySelectorAll('th.row-label');
    const headerCells = element.querySelectorAll('th.class-head');
    const firstRowCells = element.querySelectorAll('tbody tr:first-child td');

    expect(rowLabels.length).toBe(mockUpperGrid.rows.length);
    expect(headerCells.length).toBe(5);
    expect(firstRowCells.length).toBe(mockUpperGrid.cols.length);
  });

  it('marks disabled cells as non-interactive', async () => {
    await TestBed.configureTestingModule({
      imports: [UpperGridSectionComponent, NoopAnimationsModule]
    }).compileComponents();

    const fixture = TestBed.createComponent(UpperGridSectionComponent);
    fixture.componentInstance.trial = mockTrial;
    fixture.componentInstance.gridMetadata = mockUpperGrid;
    fixture.componentInstance.selectionsControl = new FormArray<FormGroup>([]);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const mixedStd = element.querySelector('button[aria-label="Mixed STD"]') as HTMLButtonElement;

    expect(mixedStd).toBeTruthy();
    expect(mixedStd.disabled).toBe(true);
  });

  it('toggles selection values in the form array', async () => {
    await TestBed.configureTestingModule({
      imports: [UpperGridSectionComponent, NoopAnimationsModule]
    }).compileComponents();

    const selections = new FormArray<FormGroup>([]);
    const fixture = TestBed.createComponent(UpperGridSectionComponent);
    fixture.componentInstance.trial = mockTrial;
    fixture.componentInstance.gridMetadata = mockUpperGrid;
    fixture.componentInstance.selectionsControl = selections;
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const sheepStd = element.querySelector('button[aria-label="Sheep STD"]') as HTMLButtonElement;

    sheepStd.click();
    fixture.detectChanges();

    expect(selections.value).toEqual([{ row: 'Sheep', col: 'STD', value: 'X' }]);

    sheepStd.click();
    fixture.detectChanges();

    expect(selections.length).toBe(0);
  });

  it('moves focus with arrow keys', async () => {
    await TestBed.configureTestingModule({
      imports: [UpperGridSectionComponent, NoopAnimationsModule]
    }).compileComponents();

    const fixture = TestBed.createComponent(UpperGridSectionComponent);
    fixture.componentInstance.trial = mockTrial;
    fixture.componentInstance.gridMetadata = mockUpperGrid;
    fixture.componentInstance.selectionsControl = new FormArray<FormGroup>([]);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const sheepStd = element.querySelector('button[aria-label="Sheep STD"]') as HTMLButtonElement;
    const sheepOpn = element.querySelector('button[aria-label="Sheep OPN"]') as HTMLButtonElement;

    sheepStd.focus();
    sheepStd.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    fixture.detectChanges();

    expect(document.activeElement).toBe(sheepOpn);
  });
});
