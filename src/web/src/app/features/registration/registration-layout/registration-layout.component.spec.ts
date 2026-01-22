import { TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RegistrationLayoutComponent } from './registration-layout.component';
import { TrialSummaryDto } from '../../trials/trial.types';

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
      emergencyContact: formBuilder.group({}),
      fees: formBuilder.group({}),
      selections: formBuilder.group({
        upper: formBuilder.array([]),
        lower: formBuilder.array([])
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
});
