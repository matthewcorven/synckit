import { AbstractControl, FormArray, FormGroup } from '@angular/forms';

export type ValidationErrorMap = Record<string, string[]>;

export function applyServerErrorsToForm(
  form: FormGroup,
  errors: ValidationErrorMap
): string[] {
  const unmapped: string[] = [];

  Object.entries(errors).forEach(([path, messages]) => {
    const control = getControlByPath(form, path);
    if (!control) {
      unmapped.push(...messages);
      return;
    }

    const existing = control.errors ?? {};
    control.setErrors({ ...existing, server: messages });
    control.markAsTouched();
  });

  if (unmapped.length > 0) {
    const existing = form.errors ?? {};
    form.setErrors({ ...existing, server: unmapped });
    form.markAsTouched();
  }

  return unmapped;
}

export function clearServerErrors(form: FormGroup): void {
  clearServerErrorsRecursive(form);
  form.updateValueAndValidity();
}

function getControlByPath(form: FormGroup, path: string): AbstractControl | null {
  if (!path) {
    return null;
  }

  const segments = path.split('.');
  let current: AbstractControl | null = form;

  for (const segment of segments) {
    if (!current || !(current instanceof FormGroup)) {
      return null;
    }

    current = current.get(segment);
  }

  return current;
}

function clearServerErrorsRecursive(control: AbstractControl): void {
  const errors = control.errors;
  if (errors && Object.prototype.hasOwnProperty.call(errors, 'server')) {
    const { server, ...remaining } = errors;
    control.setErrors(Object.keys(remaining).length > 0 ? remaining : null);
  }

  if (control instanceof FormGroup) {
    Object.values(control.controls).forEach((child) => clearServerErrorsRecursive(child));
  }

  if (control instanceof FormArray) {
    control.controls.forEach((child) => clearServerErrorsRecursive(child));
  }
}
