import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { FormGroup } from '@angular/forms';
import { of } from 'rxjs';
import { RegistrationPageComponent } from './registration.page';
import { TrialService } from '../trials/trial.service';
import { TrialSummaryDto } from '../trials/trial.types';

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

describe('RegistrationPageComponent', () => {
  it('initializes the registration form group', async () => {
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
  });

  it('loads trial data using the route param trialId', async () => {
    const getTrial = vi.fn(() => of(mockTrial));

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
        }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(RegistrationPageComponent);
    fixture.detectChanges();

    expect(getTrial).toHaveBeenCalledWith(mockTrial.trialId);
  });

  it('requires complete address when any address field is provided', async () => {
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
});
