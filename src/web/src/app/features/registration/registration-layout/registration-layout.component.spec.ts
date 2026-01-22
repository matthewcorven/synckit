import { TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RegistrationLayoutComponent } from './registration-layout.component';
import { TrialSummaryDto } from '../../trials/trial.types';

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
      dog: formBuilder.group({}),
      contact: formBuilder.group({
        ownerAddress: formBuilder.group({}),
        junior: formBuilder.group({})
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
      'app-emergency-fees-section',
      'app-upper-grid-section',
      'app-lower-grid-section'
    ]);
  });
});
