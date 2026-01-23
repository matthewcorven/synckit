import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { FormArray, FormControl, FormGroup } from '@angular/forms';
import { RegistrationPageComponent } from './registration.page';
import { TrialService } from '../trials/trial.service';
import { TrialSummaryDto } from '../trials/trial.types';
import { RegistrationMetadataService } from './registration-metadata.service';
import { TermsDto, TrialRegistrationMetadataDto } from './registration.types';
import { TermsService } from './terms.service';
import { RegistrationSubmitService } from './registration-submit.service';
import { RegistrationSubmissionStore } from './registration-submission.store';
import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { of, throwError } from 'rxjs';

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
        disabledCells: [
          { row: 'Mixed', col: 'STD' },
          { row: 'Mixed', col: 'OPN' },
          { row: 'Mixed', col: 'ADV' },
          { row: 'Mixed', col: 'FTD_OPN' },
          { row: 'Mixed', col: 'FTD_ADV' }
        ]
      }
    ]
  }
};

const mockTerms: TermsDto = {
  version: 'v1',
  html: '<h1>Terms</h1><p>Sample</p>'
};

describe('RegistrationPageComponent', () => {
  it('initializes the registration form group', async () => {
    const submitEntry = vi.fn(() => of({ entryId: 'entry-1', status: 'Submitted', supportId: 'support' }));
    await TestBed.configureTestingModule({
      imports: [RegistrationPageComponent, NoopAnimationsModule],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ trialId: mockTrial.trialId })
            }
          }
        },
        {
          provide: TrialService,
          useValue: {
            getTrial: () => of(mockTrial)
          }
        },
        {
          provide: RegistrationMetadataService,
          useValue: {
            getRegistrationMetadata: () => of(mockRegistrationMetadata)
          }
        },
        {
          provide: TermsService,
          useValue: {
            getCurrentTerms: () => of(mockTerms)
          }
        },
        {
          provide: RegistrationSubmitService,
          useValue: { submitEntry }
        },
        {
          provide: RegistrationSubmissionStore,
          useValue: { save: vi.fn() }
        },
        {
          provide: Router,
          useValue: { navigate: vi.fn() }
        }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(RegistrationPageComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    expect(component.form.get('entryNumber')).toBeTruthy();
    expect(component.form.get('dog')).toBeTruthy();
    expect(component.form.get('contact')).toBeTruthy();
    expect(component.form.get('contact.owners')).toBeTruthy();
    expect(component.form.get('contact.ownerAddress.street')).toBeTruthy();
    expect(component.form.get('contact.ownerAddress.city')).toBeTruthy();
    expect(component.form.get('contact.ownerAddress.state')).toBeTruthy();
    expect(component.form.get('contact.ownerAddress.zip')).toBeTruthy();
    expect(component.form.get('contact.email')).toBeTruthy();
    expect(component.form.get('contact.phone')).toBeTruthy();
    expect(component.form.get('contact.handler')).toBeTruthy();
    expect(component.form.get('contact.membershipNumber')).toBeTruthy();
    expect(component.form.get('contact.junior.dob')).toBeTruthy();
    expect(component.form.get('contact.junior.memberId')).toBeTruthy();
    expect(component.form.get('emergencyContact')).toBeTruthy();
    expect(component.form.get('emergencyContact.name')).toBeTruthy();
    expect(component.form.get('emergencyContact.phoneOrNumber')).toBeTruthy();
    expect(component.form.get('fees')).toBeTruthy();
    expect(component.form.get('fees.totalEntryFees')).toBeTruthy();
    expect(component.form.get('fees.currency')).toBeTruthy();
    expect(component.form.get('selections')).toBeTruthy();
    expect(component.form.get('terms')).toBeTruthy();
    expect(component.form.get('terms.version')).toBeTruthy();
    expect(component.form.get('terms.accepted')).toBeTruthy();
  });

  it('loads trial data using the route param trialId', async () => {
    const getTrial = vi.fn(() => of(mockTrial));
    const getCurrentTerms = vi.fn(() => of(mockTerms));
    const submitEntry = vi.fn(() => of({ entryId: 'entry-1', status: 'Submitted', supportId: 'support' }));

    await TestBed.configureTestingModule({
      imports: [RegistrationPageComponent, NoopAnimationsModule],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ trialId: mockTrial.trialId })
            }
          }
        },
        {
          provide: TrialService,
          useValue: { getTrial }
        },
        {
          provide: RegistrationMetadataService,
          useValue: {
            getRegistrationMetadata: () => of(mockRegistrationMetadata)
          }
        },
        {
          provide: TermsService,
          useValue: {
            getCurrentTerms
          }
        },
        {
          provide: RegistrationSubmitService,
          useValue: { submitEntry }
        },
        {
          provide: RegistrationSubmissionStore,
          useValue: { save: vi.fn() }
        },
        {
          provide: Router,
          useValue: { navigate: vi.fn() }
        }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(RegistrationPageComponent);
    fixture.detectChanges();

    expect(getTrial).toHaveBeenCalledWith(mockTrial.trialId);
    expect(getCurrentTerms).toHaveBeenCalled();
  });

  it('requires complete address when any address field is provided', async () => {
    const submitEntry = vi.fn(() => of({ entryId: 'entry-1', status: 'Submitted', supportId: 'support' }));
    await TestBed.configureTestingModule({
      imports: [RegistrationPageComponent, NoopAnimationsModule],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ trialId: mockTrial.trialId })
            }
          }
        },
        {
          provide: TrialService,
          useValue: { getTrial: () => of(mockTrial) }
        },
        {
          provide: RegistrationMetadataService,
          useValue: {
            getRegistrationMetadata: () => of(mockRegistrationMetadata)
          }
        },
        {
          provide: TermsService,
          useValue: {
            getCurrentTerms: () => of(mockTerms)
          }
        },
        {
          provide: RegistrationSubmitService,
          useValue: { submitEntry }
        },
        {
          provide: RegistrationSubmissionStore,
          useValue: { save: vi.fn() }
        },
        {
          provide: Router,
          useValue: { navigate: vi.fn() }
        }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(RegistrationPageComponent);
    fixture.detectChanges();

    const addressGroup = fixture.componentInstance.form.get('contact.ownerAddress') as FormGroup;
    addressGroup.get('street')?.setValue('123 Main St');
    addressGroup.updateValueAndValidity();

    expect(addressGroup.get('city')?.hasError('required')).toBeTruthy();
    expect(addressGroup.get('state')?.hasError('required')).toBeTruthy();
    expect(addressGroup.get('zip')?.hasError('required')).toBeTruthy();

    addressGroup.setValue({
      street: '123 Main St',
      city: 'Bryan',
      state: 'TX',
      zip: '77801'
    });
    addressGroup.updateValueAndValidity();

    expect(addressGroup.errors).toBeNull();
  });

  it('maps server validation errors onto matching controls', async () => {
    const submitEntry = vi.fn(() => of({ entryId: 'entry-1', status: 'Submitted', supportId: 'support' }));
    await TestBed.configureTestingModule({
      imports: [RegistrationPageComponent, NoopAnimationsModule],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ trialId: mockTrial.trialId })
            }
          }
        },
        {
          provide: TrialService,
          useValue: { getTrial: () => of(mockTrial) }
        },
        {
          provide: RegistrationMetadataService,
          useValue: {
            getRegistrationMetadata: () => of(mockRegistrationMetadata)
          }
        },
        {
          provide: TermsService,
          useValue: {
            getCurrentTerms: () => of(mockTerms)
          }
        },
        {
          provide: RegistrationSubmitService,
          useValue: { submitEntry }
        },
        {
          provide: RegistrationSubmissionStore,
          useValue: { save: vi.fn() }
        },
        {
          provide: Router,
          useValue: { navigate: vi.fn() }
        }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(RegistrationPageComponent);
    fixture.detectChanges();

    fixture.componentInstance.applyServerValidationErrors({
      'dog.callName': ['Call Name is required.']
    });

    const control = fixture.componentInstance.form.get('dog.callName');
    expect(control?.hasError('server')).toBeTruthy();
  });

  it('submits and navigates to confirmation on success', async () => {
    const submitEntry = vi.fn(() =>
      of({ entryId: 'entry-999', status: 'Submitted', supportId: 'support-123' })
    );
    const navigate = vi.fn();
    const save = vi.fn();

    await TestBed.configureTestingModule({
      imports: [RegistrationPageComponent, NoopAnimationsModule],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ trialId: mockTrial.trialId })
            }
          }
        },
        {
          provide: TrialService,
          useValue: { getTrial: () => of(mockTrial) }
        },
        {
          provide: RegistrationMetadataService,
          useValue: { getRegistrationMetadata: () => of(mockRegistrationMetadata) }
        },
        {
          provide: TermsService,
          useValue: { getCurrentTerms: () => of(mockTerms) }
        },
        {
          provide: RegistrationSubmitService,
          useValue: { submitEntry }
        },
        {
          provide: RegistrationSubmissionStore,
          useValue: { save }
        },
        {
          provide: Router,
          useValue: { navigate }
        }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(RegistrationPageComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    sessionStorage.setItem(`draft-entry:${mockTrial.trialId}`, 'entry-123');
    component.form.get('dog')?.patchValue({
      breed: 'Australian Shepherd',
      callName: 'Ranger',
      dob: new Date('2021-04-10'),
      sex: 'Male'
    });
    component.form.get('contact')?.patchValue({
      owners: 'Jane Handler',
      email: 'handler@example.com',
      phone: '555-555-5555'
    });
    component.form.get('emergencyContact')?.patchValue({
      name: 'Emergency',
      phoneOrNumber: '555-111-2222'
    });
    component.form.get('fees')?.patchValue({ totalEntryFees: 25 });
    const upperSelections = component.form.get('selections.upper');
    if (upperSelections instanceof FormArray) {
      upperSelections.push(
        new FormGroup({
          row: new FormControl('Sheep'),
          col: new FormControl('STD'),
          value: new FormControl('X')
        })
      );
    }
    component.form.get('terms.accepted')?.enable();
    component.form.get('terms.accepted')?.setValue(true);
    component.form.get('terms.version')?.setValue('v1');

    component.submitEntry();
    expect(submitEntry).toHaveBeenCalledWith('entry-123', {
      acceptTerms: true,
      termsVersion: 'v1'
    });
    expect(save).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith([
      '/register',
      mockTrial.trialId,
      'confirmation'
    ]);
  });

  it('shows support ID and applies server errors on submit failure', async () => {
    const errorBody = {
      title: 'Submission failed',
      traceId: 'trace-abc',
      errors: { 'dog.callName': ['Call Name is required.'] }
    };
    const submitEntry = vi.fn(() =>
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: errorBody,
            headers: new HttpHeaders({ 'x-support-id': 'support-xyz' })
          })
      )
    );

    await TestBed.configureTestingModule({
      imports: [RegistrationPageComponent, NoopAnimationsModule],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ trialId: mockTrial.trialId })
            }
          }
        },
        {
          provide: TrialService,
          useValue: { getTrial: () => of(mockTrial) }
        },
        {
          provide: RegistrationMetadataService,
          useValue: { getRegistrationMetadata: () => of(mockRegistrationMetadata) }
        },
        {
          provide: TermsService,
          useValue: { getCurrentTerms: () => of(mockTerms) }
        },
        {
          provide: RegistrationSubmitService,
          useValue: { submitEntry }
        },
        {
          provide: RegistrationSubmissionStore,
          useValue: { save: vi.fn() }
        },
        {
          provide: Router,
          useValue: { navigate: vi.fn() }
        }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(RegistrationPageComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.form.get('dog')?.patchValue({
      breed: 'Australian Shepherd',
      callName: 'Ranger',
      dob: new Date('2021-04-10'),
      sex: 'Male'
    });
    component.form.get('contact')?.patchValue({
      owners: 'Jane Handler',
      email: 'handler@example.com',
      phone: '555-555-5555'
    });
    component.form.get('emergencyContact')?.patchValue({
      name: 'Emergency',
      phoneOrNumber: '555-111-2222'
    });
    component.form.get('fees')?.patchValue({ totalEntryFees: 25 });
    const upperSelections = component.form.get('selections.upper');
    if (upperSelections instanceof FormArray) {
      upperSelections.push(
        new FormGroup({
          row: new FormControl('Sheep'),
          col: new FormControl('STD'),
          value: new FormControl('X')
        })
      );
    }
    component.form.get('terms.accepted')?.enable();
    component.form.get('terms.accepted')?.setValue(true);
    component.form.get('terms.version')?.setValue('v1');

    component.submitEntry();

    expect(component.submitSupportId).toBe('support-xyz');
    expect(component.submitErrorMessage).toBe('Submission failed');
    expect(component.form.get('dog.callName')?.hasError('server')).toBeTruthy();
  });
});
