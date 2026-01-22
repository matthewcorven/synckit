import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
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
  hostClub: 'Example Club',
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
    expect(component.form.get('emergencyContact')).toBeTruthy();
    expect(component.form.get('fees')).toBeTruthy();
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
});
