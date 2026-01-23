import { Component } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { InlineErrorDirective } from './inline-error.directive';

@Component({
  selector: 'app-inline-error-host',
  standalone: true,
  imports: [ReactiveFormsModule, InlineErrorDirective],
  template: `
    <span *appInlineError="control; errorKey: 'required'">Required message</span>
  `
})
class InlineErrorHostComponent {
  control = new FormControl('', { nonNullable: true, validators: [Validators.required] });
}

describe('InlineErrorDirective', () => {
  it('shows and hides content based on control validity and touch state', () => {
    const fixture = TestBed.configureTestingModule({
      imports: [InlineErrorHostComponent]
    }).createComponent(InlineErrorHostComponent);

    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain('Required message');

    fixture.componentInstance.control.markAsTouched();
    fixture.componentInstance.control.updateValueAndValidity();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Required message');

    fixture.componentInstance.control.setValue('Ranger');
    fixture.componentInstance.control.updateValueAndValidity();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Required message');
  });
});
