import { TestBed } from '@angular/core/testing';
import { FormBuilder, Validators } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { EmergencyFeesSectionComponent } from './emergency-fees-section.component';

describe('EmergencyFeesSectionComponent', () => {
  it('renders required and min validation messages after touch', async () => {
    await TestBed.configureTestingModule({
      imports: [EmergencyFeesSectionComponent, NoopAnimationsModule]
    }).compileComponents();

    const formBuilder = TestBed.inject(FormBuilder);
    const emergencyGroup = formBuilder.group({
      name: ['', Validators.required],
      phoneOrNumber: ['', Validators.required]
    });
    const feesGroup = formBuilder.group({
      totalEntryFees: formBuilder.control<number | null>(null, [
        Validators.required,
        Validators.min(0.01)
      ]),
      currency: ['USD']
    });

    const fixture = TestBed.createComponent(EmergencyFeesSectionComponent);
    fixture.componentInstance.emergencyGroup = emergencyGroup;
    fixture.componentInstance.feesGroup = feesGroup;
    fixture.detectChanges();

    emergencyGroup.get('name')?.markAsTouched();
    emergencyGroup.get('phoneOrNumber')?.markAsTouched();
    feesGroup.get('totalEntryFees')?.setValue(0);
    feesGroup.get('totalEntryFees')?.markAsTouched();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Emergency contact name is required.');
    expect(element.textContent).toContain('Emergency contact number is required.');
    expect(element.textContent).toContain('Total entry fees must be greater than $0.00.');
  });

  it('formats fee values with currency', async () => {
    await TestBed.configureTestingModule({
      imports: [EmergencyFeesSectionComponent, NoopAnimationsModule]
    }).compileComponents();

    const fixture = TestBed.createComponent(EmergencyFeesSectionComponent);
    const component = fixture.componentInstance;

    expect(component.formatFee(12.5)).toBe('$12.50 USD');
  });
});
