import { TestBed } from '@angular/core/testing';
import { FormBuilder, Validators } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { RegistrationLayoutComponent } from './registration-layout.component';
import { TrialSummaryDto } from '../../trials/trial.types';
import { TermsDto, TrialRegistrationMetadataDto } from '../registration.types';

const mockTrial: TrialSummaryDto = {
  trialId: 'trial-123',
  name: 'Mock Trial',
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

const mockRegistrationMetadata: TrialRegistrationMetadataDto = {
  trialId: mockTrial.trialId,
  formTemplate: mockTrial.formTemplate,
  formMetadata: {
    formTemplate: mockTrial.formTemplate,
    grids: [
      {
        grid: 'Upper',
        rows: ['Sheep', 'Cattle', 'Ducks', 'Mixed'],
        cols: ['STD', 'OPN', 'ADV', 'FTD_OPN', 'FTD_ADV', 'DATE1_TRIAL1', 'DATE1_TRIAL2'],
        disabledCells: []
      },
      {
        grid: 'Lower',
        rows: ['Sheep', 'Cattle', 'Ducks'],
        cols: ['NOV', 'WRK_JR_HNDLR', 'FEO', 'POST_ADV', 'RTD', 'DATE1_TRIAL1'],
        disabledCells: []
      }
    ]
  }
};

const mockTerms: TermsDto = {
  version: 'v1',
  html: '<h1>Terms</h1><p>Sample</p>'
};

describe('RegistrationLayoutComponent', () => {
  it('renders form sections in order', async () => {
    await TestBed.configureTestingModule({
      imports: [RegistrationLayoutComponent, NoopAnimationsModule]
    }).compileComponents();

    const formBuilder = TestBed.inject(FormBuilder);
    const form = formBuilder.group({
      entryNumber: [{ value: '', disabled: true }],
      dog: formBuilder.group({
        ascaRegistrationNumber: [''],
        breed: [''],
        registeredName: [''],
        callName: [''],
        dob: [null],
        color: [''],
        sex: [''],
        sire: [''],
        dam: [''],
        breeders: ['']
      }),
      contact: formBuilder.group({
        owners: [''],
        ownerAddress: formBuilder.group({
          street: [''],
          city: [''],
          state: [''],
          zip: ['']
        }),
        email: [''],
        phone: [''],
        handler: [''],
        membershipNumber: [''],
        junior: formBuilder.group({
          dob: [null],
          memberId: ['']
        })
      }),
      emergencyContact: formBuilder.group({
        name: [''],
        phoneOrNumber: ['']
      }),
      fees: formBuilder.group({
        totalEntryFees: [null],
        currency: ['USD']
      }),
      selections: formBuilder.group({
        upper: formBuilder.array([]),
        lower: formBuilder.array([])
      }),
      terms: formBuilder.group({
        version: [''],
        accepted: formBuilder.control({ value: false, disabled: true }, [
          Validators.requiredTrue
        ])
      })
    });

    const fixture = TestBed.createComponent(RegistrationLayoutComponent);
    fixture.componentInstance.form = form;
    fixture.componentInstance.trial = mockTrial;
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const sections = Array.from(element.querySelectorAll('app-dog-section, app-contact-section, app-emergency-fees-section, app-upper-grid-section, app-lower-grid-section'));
    const order = sections.map((section) => section.tagName.toLowerCase());

    expect(order).toEqual([
      'app-dog-section',
      'app-contact-section',
      'app-upper-grid-section',
      'app-lower-grid-section',
      'app-emergency-fees-section'
    ]);
  });

  it('shows the validation summary after review click', async () => {
    await TestBed.configureTestingModule({
      imports: [RegistrationLayoutComponent, NoopAnimationsModule]
    }).compileComponents();

    const formBuilder = TestBed.inject(FormBuilder);
    const form = formBuilder.group({
      entryNumber: [{ value: '', disabled: true }],
      dog: formBuilder.group({
        ascaRegistrationNumber: [''],
        breed: ['', Validators.required],
        registeredName: [''],
        callName: ['', Validators.required],
        dob: [null, Validators.required],
        color: [''],
        sex: ['', Validators.required],
        sire: [''],
        dam: [''],
        breeders: ['']
      }),
      contact: formBuilder.group({
        owners: ['', Validators.required],
        ownerAddress: formBuilder.group({
          street: [''],
          city: [''],
          state: [''],
          zip: ['']
        }),
        email: ['', Validators.required],
        phone: ['', Validators.required],
        handler: [''],
        membershipNumber: [''],
        junior: formBuilder.group({
          dob: [null],
          memberId: ['']
        })
      }),
      emergencyContact: formBuilder.group({
        name: ['', Validators.required],
        phoneOrNumber: ['', Validators.required]
      }),
      fees: formBuilder.group({
        totalEntryFees: [null, Validators.required],
        currency: ['USD']
      }),
      selections: formBuilder.group({
        upper: formBuilder.array([]),
        lower: formBuilder.array([])
      }),
      terms: formBuilder.group({
        version: [''],
        accepted: formBuilder.control({ value: false, disabled: true }, [
          Validators.requiredTrue
        ])
      })
    });

    const fixture = TestBed.createComponent(RegistrationLayoutComponent);
    fixture.componentInstance.form = form;
    fixture.componentInstance.trial = mockTrial;
    fixture.componentInstance.registrationMetadata = mockRegistrationMetadata;
    fixture.detectChanges();

    const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
    const reviewButton = buttons.find((button) =>
      button.textContent?.toLowerCase().includes('review for errors')
    );
    reviewButton?.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Validation summary');
  });

  it('enables terms checkbox and submit after acceptance', async () => {
    const dialogMock = {
      open: vi.fn(() => ({
        afterClosed: () => of(true)
      }))
    };

    await TestBed.configureTestingModule({
      imports: [RegistrationLayoutComponent, NoopAnimationsModule]
    }).compileComponents();

    const formBuilder = TestBed.inject(FormBuilder);
    const form = formBuilder.group({
      entryNumber: [{ value: '', disabled: true }],
      dog: formBuilder.group({
        ascaRegistrationNumber: [''],
        breed: [''],
        registeredName: [''],
        callName: [''],
        dob: [null],
        color: [''],
        sex: [''],
        sire: [''],
        dam: [''],
        breeders: ['']
      }),
      contact: formBuilder.group({
        owners: [''],
        ownerAddress: formBuilder.group({
          street: [''],
          city: [''],
          state: [''],
          zip: ['']
        }),
        email: [''],
        phone: [''],
        handler: [''],
        membershipNumber: [''],
        junior: formBuilder.group({
          dob: [null],
          memberId: ['']
        })
      }),
      emergencyContact: formBuilder.group({
        name: [''],
        phoneOrNumber: ['']
      }),
      fees: formBuilder.group({
        totalEntryFees: [null],
        currency: ['USD']
      }),
      selections: formBuilder.group({
        upper: formBuilder.array([]),
        lower: formBuilder.array([])
      }),
      terms: formBuilder.group({
        version: [''],
        accepted: formBuilder.control({ value: false, disabled: true }, [
          Validators.requiredTrue
        ])
      })
    });

    const fixture = TestBed.createComponent(RegistrationLayoutComponent);
    fixture.componentInstance.form = form;
    fixture.componentInstance.trial = mockTrial;
    fixture.componentInstance.terms = mockTerms;
    (fixture.componentInstance as unknown as { dialog: MatDialog }).dialog =
      dialogMock as unknown as MatDialog;
    fixture.detectChanges();

    const submitButtons = Array.from(
      fixture.nativeElement.querySelectorAll('button')
    ) as HTMLButtonElement[];
    const submitButton = submitButtons.find((button) =>
      button.textContent?.includes('Submit')
    );

    expect(submitButton?.disabled).toBeTruthy();

    fixture.componentInstance.openTermsDialog();
    fixture.detectChanges();
    await fixture.whenStable();

    const acceptedControl = fixture.componentInstance.form.get('terms.accepted');
    const versionControl = fixture.componentInstance.form.get('terms.version');
    expect(acceptedControl?.value).toBe(true);
    expect(versionControl?.value).toBe('v1');

    fixture.detectChanges();
    expect(submitButton?.disabled).toBeFalsy();
  });

  it('emits submit when form is valid and terms accepted', async () => {
    await TestBed.configureTestingModule({
      imports: [RegistrationLayoutComponent, NoopAnimationsModule]
    }).compileComponents();

    const formBuilder = TestBed.inject(FormBuilder);
    const form = formBuilder.group({
      entryNumber: [{ value: '', disabled: true }],
      dog: formBuilder.group({
        ascaRegistrationNumber: [''],
        breed: ['Australian Shepherd', Validators.required],
        registeredName: [''],
        callName: ['Ranger', Validators.required],
        dob: [new Date('2021-04-10'), Validators.required],
        color: [''],
        sex: ['Male', Validators.required],
        sire: [''],
        dam: [''],
        breeders: ['']
      }),
      contact: formBuilder.group({
        owners: ['Jane Handler', Validators.required],
        ownerAddress: formBuilder.group({
          street: [''],
          city: [''],
          state: [''],
          zip: ['']
        }),
        email: ['handler@example.com', Validators.required],
        phone: ['555-555-5555', Validators.required],
        handler: [''],
        membershipNumber: [''],
        junior: formBuilder.group({
          dob: [null],
          memberId: ['']
        })
      }),
      emergencyContact: formBuilder.group({
        name: ['Emergency Contact', Validators.required],
        phoneOrNumber: ['555-111-2222', Validators.required]
      }),
      fees: formBuilder.group({
        totalEntryFees: [25, Validators.required],
        currency: ['USD']
      }),
      selections: formBuilder.group({
        upper: formBuilder.array([formBuilder.group({ row: 'Sheep', col: 'STD', value: 'X' })]),
        lower: formBuilder.array([])
      }),
      terms: formBuilder.group({
        version: ['v1'],
        accepted: formBuilder.control({ value: true, disabled: false }, [
          Validators.requiredTrue
        ])
      })
    });

    const fixture = TestBed.createComponent(RegistrationLayoutComponent);
    const component = fixture.componentInstance;
    component.form = form;
    component.trial = mockTrial;
    component.terms = mockTerms;
    fixture.detectChanges();

    const spy = vi.fn();
    component.submitEntry.subscribe(spy);

    const submitButton = (
      Array.from(
        fixture.nativeElement.querySelectorAll('button')
      ) as HTMLButtonElement[]
    ).find((button) => button.textContent?.includes('Submit Entry'));

    submitButton?.click();
    fixture.detectChanges();

    expect(spy).toHaveBeenCalledTimes(1);
  });
});
