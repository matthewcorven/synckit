import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output } from '@angular/core';
import { AbstractControl, FormArray, FormGroup } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { merge, Subscription } from 'rxjs';

export interface ValidationSummaryItem {
  path: string;
  message: string;
}

@Component({
  selector: 'app-validation-summary',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <section class="validation-summary" *ngIf="visible && errors.length">
      <div class="validation-summary__header">
        <mat-icon aria-hidden="true">error</mat-icon>
        <div>
          <div class="validation-summary__title">Validation summary</div>
          <div class="validation-summary__subtitle">Please fix the following errors:</div>
        </div>
      </div>
      <ul class="validation-summary__list">
        <li *ngFor="let item of errors">
          <button type="button" (click)="selectError(item.path)">
            <span class="bullet">•</span>
            <span>{{ item.message }}</span>
            <mat-icon aria-hidden="true">arrow_downward</mat-icon>
          </button>
        </li>
      </ul>
    </section>
  `,
  styles: [
    `
      .validation-summary {
        position: sticky;
        top: 12px;
        z-index: 10;
        padding: 12px 16px;
        border-radius: 8px;
        border: 1px solid rgba(211, 47, 47, 0.35);
        background: rgba(211, 47, 47, 0.08);
        color: var(--mat-sys-on-surface);
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.08);
        margin-bottom: 12px;
      }

      .validation-summary__header {
        display: flex;
        gap: 12px;
        align-items: flex-start;
      }

      .validation-summary__header mat-icon {
        color: var(--mat-sys-error);
      }

      .validation-summary__title {
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        font-size: 12px;
      }

      .validation-summary__subtitle {
        font-size: 13px;
        color: var(--mat-sys-on-surface-variant);
        margin-top: 2px;
      }

      .validation-summary__list {
        margin: 8px 0 0;
        padding: 0;
        list-style: none;
        display: grid;
        gap: 6px;
      }

      .validation-summary__list button {
        border: none;
        background: none;
        padding: 0;
        display: flex;
        gap: 8px;
        align-items: center;
        color: inherit;
        cursor: pointer;
        text-align: left;
      }

      .validation-summary__list mat-icon {
        font-size: 18px;
        color: var(--mat-sys-error);
      }

      .bullet {
        color: var(--mat-sys-error);
        font-weight: 700;
      }
    `
  ]
})
export class ValidationSummaryComponent implements OnChanges, OnDestroy {
  @Input() form?: FormGroup | null;
  @Input() visible = false;
  @Output() errorSelected = new EventEmitter<string>();

  errors: ValidationSummaryItem[] = [];
  private subscription: Subscription | null = null;

  ngOnChanges(): void {
    this.subscription?.unsubscribe();
    this.subscription = null;

    if (this.form) {
      this.subscription = merge(this.form.statusChanges, this.form.valueChanges).subscribe(() => {
        this.refreshErrors();
      });
    }

    this.refreshErrors();
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  selectError(path: string): void {
    this.errorSelected.emit(path);
  }

  private refreshErrors(): void {
    if (!this.form) {
      this.errors = [];
      return;
    }

    this.errors = collectErrors(this.form);
  }
}

const fieldLabels: Record<string, string> = {
  'dog.breed': 'Breed',
  'dog.callName': 'Call Name',
  'dog.dob': 'Date of Birth',
  'dog.sex': 'Sex',
  'contact.owners': 'Owner(s)',
  'contact.ownerAddress.street': 'Street',
  'contact.ownerAddress.city': 'City',
  'contact.ownerAddress.state': 'State',
  'contact.ownerAddress.zip': 'ZIP',
  'contact.email': 'Email',
  'contact.phone': 'Phone',
  'emergencyContact.name': 'Emergency contact name',
  'emergencyContact.phoneOrNumber': 'Emergency contact number',
  'fees.totalEntryFees': 'Total entry fees',
  selections: 'Class selections'
};

function collectErrors(control: AbstractControl, path = ''): ValidationSummaryItem[] {
  const errors: ValidationSummaryItem[] = [];

  if (control instanceof FormGroup) {
    if (control.errors && (control.touched || control.dirty)) {
      errors.push(...buildErrors(path, control.errors));
    }

    Object.entries(control.controls).forEach(([key, child]) => {
      const childPath = path ? `${path}.${key}` : key;
      errors.push(...collectErrors(child, childPath));
    });

    return errors;
  }

  if (control instanceof FormArray) {
    if (control.errors && (control.touched || control.dirty)) {
      errors.push(...buildErrors(path, control.errors));
    }

    return errors;
  }

  if (control.errors && (control.touched || control.dirty)) {
    errors.push(...buildErrors(path, control.errors));
  }

  return errors;
}

function buildErrors(path: string, errors: Record<string, unknown>): ValidationSummaryItem[] {
  return Object.entries(errors)
    .flatMap(([key, value]) => buildErrorMessage(path, key, value))
    .filter((message): message is string => !!message)
    .map((message) => ({ path, message }));
}

function buildErrorMessage(path: string, errorKey: string, errorValue: unknown): string | null {
  if (errorKey === 'server') {
    if (typeof errorValue === 'string') {
      return errorValue;
    }

    if (Array.isArray(errorValue)) {
      return errorValue.filter((item): item is string => typeof item === 'string').join(' ');
    }
  }

  const label = fieldLabels[path] ?? 'This field';

  switch (errorKey) {
    case 'required':
      if (path.startsWith('contact.ownerAddress.')) {
        return `${label} is required when providing an address.`;
      }
      return `${label} is required.`;
    case 'email':
      return 'Enter a valid email.';
    case 'pattern':
      if (path === 'contact.ownerAddress.zip') {
        return 'Enter a valid ZIP code.';
      }
      return `${label} has an invalid format.`;
    case 'min':
      if (path === 'fees.totalEntryFees') {
        return 'Total entry fees must be greater than $0.00.';
      }
      return `${label} is too low.`;
    case 'minSelections':
      return 'Select at least one class in either grid.';
    default:
      return `${label} is invalid.`;
  }
}
