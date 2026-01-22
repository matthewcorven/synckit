import { TestBed } from '@angular/core/testing';
import { FormBuilder, Validators } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ContactSectionComponent } from './contact-section.component';

describe('ContactSectionComponent', () => {
  it('renders required validation messages after touch', async () => {
    await TestBed.configureTestingModule({
      imports: [ContactSectionComponent, NoopAnimationsModule]
    }).compileComponents();

    const formBuilder = TestBed.inject(FormBuilder);
    const form = formBuilder.group({
      owners: ['', Validators.required],
      ownerAddress: formBuilder.group({
        street: [''],
        city: [''],
        state: [''],
        zip: ['']
      }),
      email: ['', [Validators.required, Validators.email]],
      phone: ['', Validators.required],
      handler: [''],
      membershipNumber: [''],
      junior: formBuilder.group({
        dob: [null],
        memberId: ['']
      })
    });

    const fixture = TestBed.createComponent(ContactSectionComponent);
    fixture.componentInstance.group = form;
    fixture.detectChanges();

    form.get('owners')?.markAsTouched();
    form.get('email')?.markAsTouched();
    form.get('phone')?.markAsTouched();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Owner(s) is required.');
    expect(element.textContent).toContain('Email is required.');
    expect(element.textContent).toContain('Phone is required.');
  });

  it('shows email format error for invalid email', async () => {
    await TestBed.configureTestingModule({
      imports: [ContactSectionComponent, NoopAnimationsModule]
    }).compileComponents();

    const formBuilder = TestBed.inject(FormBuilder);
    const form = formBuilder.group({
      owners: ['Owner'],
      ownerAddress: formBuilder.group({
        street: [''],
        city: [''],
        state: [''],
        zip: ['']
      }),
      email: ['not-an-email', [Validators.required, Validators.email]],
      phone: ['555-111-2222'],
      handler: [''],
      membershipNumber: [''],
      junior: formBuilder.group({
        dob: [null],
        memberId: ['']
      })
    });

    const fixture = TestBed.createComponent(ContactSectionComponent);
    fixture.componentInstance.group = form;
    fixture.detectChanges();

    form.get('email')?.markAsTouched();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Enter a valid email.');
  });
});
