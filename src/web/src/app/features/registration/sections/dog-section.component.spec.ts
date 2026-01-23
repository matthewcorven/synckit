import { TestBed } from '@angular/core/testing';
import { FormBuilder, Validators } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { DogSectionComponent } from './dog-section.component';

describe('DogSectionComponent', () => {
  it('renders required validation messages after touch', async () => {
    await TestBed.configureTestingModule({
      imports: [DogSectionComponent, NoopAnimationsModule]
    }).compileComponents();

    const formBuilder = TestBed.inject(FormBuilder);
    const form = formBuilder.group({
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
    });

    const fixture = TestBed.createComponent(DogSectionComponent);
    fixture.componentInstance.group = form;
    fixture.detectChanges();

    form.get('breed')?.markAsTouched();
    form.get('callName')?.markAsTouched();
    form.get('dob')?.markAsTouched();
    form.get('sex')?.markAsTouched();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Breed is required.');
    expect(element.textContent).toContain('Call Name is required.');
    expect(element.textContent).toContain('Date of Birth is required.');
    expect(element.textContent).toContain('Sex is required.');
  });

  it('shows entry number when provided', async () => {
    await TestBed.configureTestingModule({
      imports: [DogSectionComponent, NoopAnimationsModule]
    }).compileComponents();

    const formBuilder = TestBed.inject(FormBuilder);
    const form = formBuilder.group({
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
    });

    const fixture = TestBed.createComponent(DogSectionComponent);
    fixture.componentInstance.group = form;
    fixture.componentInstance.entryNumber = 'OLDKYASCASPRING-2026-05-02-0001';
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const entryField = element.querySelector('input[readonly]') as HTMLInputElement | null;

    expect(entryField).toBeTruthy();
    expect(entryField?.value).toContain('OLDKYASCASPRING-2026-05-02-0001');
  });
});
