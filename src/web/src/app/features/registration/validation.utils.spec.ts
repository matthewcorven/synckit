import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { applyServerErrorsToForm } from './validation.utils';

describe('validation utils', () => {
  it('maps server errors to matching form controls', () => {
    const formBuilder = new FormBuilder();
    const form = formBuilder.group({
      dog: formBuilder.group({
        callName: ['', Validators.required]
      })
    });

    applyServerErrorsToForm(form, {
      'dog.callName': ['Call Name is required.']
    });

    const control = form.get('dog.callName');
    expect(control?.hasError('server')).toBeTruthy();
  });

  it('adds unmapped server errors to the form', () => {
    const formBuilder = new FormBuilder();
    const form = formBuilder.group({
      dog: formBuilder.group({
        callName: ['', Validators.required]
      })
    });

    applyServerErrorsToForm(form, {
      'unknown.field': ['Something went wrong.']
    });

    expect(form.hasError('server')).toBeTruthy();
  });
});
