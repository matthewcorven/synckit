import { Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { ValidationSummaryComponent } from './validation-summary.component';

@Component({
  selector: 'app-validation-summary-host',
  standalone: true,
  imports: [ReactiveFormsModule, ValidationSummaryComponent],
  template: `
    <app-validation-summary [form]="form" [visible]="true"></app-validation-summary>
  `
})
class ValidationSummaryHostComponent {
  form: FormGroup;

  constructor(private readonly formBuilder: FormBuilder) {
    this.form = this.formBuilder.group({
      dog: this.formBuilder.group({
        callName: ['', Validators.required]
      }),
      fees: this.formBuilder.group({
        totalEntryFees: [null, Validators.min(0.01)]
      })
    });
  }
}

describe('ValidationSummaryComponent', () => {
  it('lists errors for touched invalid controls', () => {
    const fixture = TestBed.configureTestingModule({
      imports: [ValidationSummaryHostComponent]
    }).createComponent(ValidationSummaryHostComponent);

    const form = fixture.componentInstance.form;
    form.get('dog.callName')?.markAsTouched();
    form.updateValueAndValidity();

    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Call Name is required.');
  });
});
