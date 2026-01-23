import { Component, ElementRef, Input, ViewChild } from '@angular/core';
import { DatePipe, NgIf } from '@angular/common';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { TrialSummaryDto } from '../../trials/trial.types';
import { DogSectionComponent } from '../sections/dog-section.component';
import { ContactSectionComponent } from '../sections/contact-section.component';
import { EmergencyFeesSectionComponent } from '../sections/emergency-fees-section.component';
import { UpperGridSectionComponent } from '../sections/upper-grid-section.component';
import { LowerGridSectionComponent } from '../sections/lower-grid-section.component';
import { GridMetadata, TermsDto, TrialRegistrationMetadataDto } from '../registration.types';
import { ValidationSummaryComponent } from '../validation-summary/validation-summary.component';
import { TermsModalComponent } from '../terms-modal/terms-modal.component';

@Component({
  selector: 'app-registration-layout',
  standalone: true,
  imports: [
    DatePipe,
    NgIf,
    ReactiveFormsModule,
    MatCardModule,
    MatDividerModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    DogSectionComponent,
    ContactSectionComponent,
    EmergencyFeesSectionComponent,
    UpperGridSectionComponent,
    LowerGridSectionComponent,
    ValidationSummaryComponent
  ],
  template: `
    <mat-card class="registration-card">
      <section class="registration-header" *ngIf="trial">
        <div>
          <div class="registration-header__org">{{ trial.organizationName }}</div>
          <div class="registration-header__label">
            {{ trial.sportName }} {{ trial.formName }}
          </div>
          <h2 class="registration-header__title">{{ trial.name }}</h2>
          <div class="registration-header__meta">
            <div class="meta-row">
              <span class="meta-label">Host club</span>
              <span>{{ trial.hostClub }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">Trial dates</span>
              <span>
                {{ trial.startDate | date: 'MMM d, y' }}
                <ng-container *ngIf="trial.endDate !== trial.startDate">
                  – {{ trial.endDate | date: 'MMM d, y' }}
                </ng-container>
              </span>
            </div>
            <div class="meta-row" *ngIf="trial.location">
              <span class="meta-label">Location</span>
              <span>{{ trial.location }}</span>
            </div>
          </div>
        </div>
        <div class="registration-header__badge">
          <div class="badge-box">
            <div class="badge-box__label">Entry Number</div>
            <div class="badge-box__field">{{ trial.trackingSlug }}</div>
          </div>
        </div>
      </section>

      <mat-divider></mat-divider>

      <app-validation-summary
        [form]="form"
        [visible]="validationSummaryVisible"
        (errorSelected)="scrollToControl($event)"
      ></app-validation-summary>

      <form class="registration-form" [formGroup]="form">
        <app-dog-section [group]="dogGroup" [entryNumber]="entryNumber"></app-dog-section>
        <app-contact-section [group]="contactGroup"></app-contact-section>
        <section
          class="section-block"
          [class.section-block--error]="showSelectionsError"
          data-control-path="selections"
        >
          <div class="section-title">Class Selections</div>
          <app-upper-grid-section
            [trial]="trial"
            [gridMetadata]="upperGridMetadata"
            [selectionsControl]="upperSelections"
          ></app-upper-grid-section>
          <app-lower-grid-section
            [trial]="trial"
            [gridMetadata]="lowerGridMetadata"
            [selectionsControl]="lowerSelections"
          ></app-lower-grid-section>
          <div class="field-error" *ngIf="showSelectionsError">
            Select at least one class in either grid.
          </div>
        </section>

        <app-emergency-fees-section
          [emergencyGroup]="emergencyGroup"
          [feesGroup]="feesGroup"
        ></app-emergency-fees-section>

        <section
          class="section-block terms-block"
          [class.section-block--error]="showTermsError"
          data-control-path="terms.accepted"
        >
          <div class="section-title">Terms and Conditions</div>
          <div class="terms-copy">
            <mat-checkbox [formControl]="termsAcceptedControl">
              I have read and accept the terms.
            </mat-checkbox>
            <button
              mat-button
              class="terms-link"
              type="button"
              (click)="openTermsDialog()"
              [disabled]="!terms"
            >
              View Terms and Conditions
            </button>
            <span class="terms-version" *ngIf="termsVersion">({{ termsVersion }})</span>
          </div>
          <div class="field-error" *ngIf="showTermsError">
            You must accept the terms before submitting.
          </div>
          <div class="terms-actions">
            <button
              mat-stroked-button
              type="button"
              (click)="openTermsDialog()"
              [disabled]="!terms"
            >
              Review terms
            </button>
            <button
              mat-flat-button
              color="primary"
              type="button"
              [disabled]="!termsAccepted"
            >
              Submit
            </button>
          </div>
        </section>

        <div class="validation-actions">
          <button mat-flat-button color="primary" type="button" (click)="reviewForErrors()">
            Review for errors
          </button>
        </div>
      </form>
    </mat-card>
  `,
  styles: [
    `
      .registration-card {
        padding: 8px 20px 24px;
        max-width: 980px;
        margin: 0 auto;
        border: 1px solid var(--mat-sys-outline-variant);
        box-shadow: none;
      }

      .registration-header {
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
        justify-content: space-between;
        padding: 8px 8px 16px;
      }

      .registration-header__label {
        text-transform: uppercase;
        font-size: 12px;
        letter-spacing: 0.08em;
        color: var(--mat-sys-on-surface-variant);
      }

      .registration-header__org {
        font-weight: 600;
        font-size: 13px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--mat-sys-on-surface-variant);
      }

      .registration-header__title {
        margin: 4px 0 8px;
        font-size: 28px;
        font-weight: 600;
      }

      .registration-header__meta {
        display: grid;
        gap: 6px;
        color: var(--mat-sys-on-surface-variant);
      }

      .meta-row {
        display: flex;
        align-items: baseline;
        gap: 8px;
      }

      .meta-label {
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--mat-sys-on-surface-variant);
        min-width: 84px;
      }

      .dot {
        font-size: 10px;
      }

      .registration-header__badge {
        min-width: 140px;
        align-self: flex-start;
        text-align: right;
        background: transparent;
        color: var(--mat-sys-on-surface-variant);
        padding: 4px 0;
        border-radius: 0;
      }

      .badge-label {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .badge-value {
        font-weight: 600;
        margin-top: 2px;
      }

      .badge-box {
        display: flex;
        flex-direction: column;
        gap: 4px;
        border: 1px solid var(--mat-sys-outline-variant);
        border-radius: 4px;
        padding: 6px 8px;
        margin-bottom: 10px;
        min-width: 140px;
      }

      .badge-box__label {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--mat-sys-on-surface-variant);
      }

      .badge-box__field {
        height: 18px;
        border-radius: 4px;
        background: var(--mat-sys-surface-variant);
        opacity: 0.7;
      }

      .registration-form {
        display: flex;
        flex-direction: column;
        gap: 18px;
        margin-top: 16px;
      }

      .section-block {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .section-block--error {
        border: 1px solid rgba(211, 47, 47, 0.35);
        border-radius: 8px;
        padding: 12px;
        background: rgba(211, 47, 47, 0.04);
      }

      .section-title {
        font-size: 15px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        padding-bottom: 6px;
        border-bottom: 2px solid var(--mat-sys-outline-variant);
      }

      .field-error {
        font-size: 12px;
        color: var(--mat-sys-error);
        padding-left: 6px;
      }

      .validation-actions {
        display: flex;
        justify-content: flex-end;
        padding-top: 8px;
      }

      .terms-block {
        gap: 12px;
      }

      .terms-copy {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 8px;
      }

      .terms-link {
        padding: 0 4px;
      }

      .terms-version {
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--mat-sys-on-surface-variant);
      }

      .terms-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        justify-content: flex-end;
      }

      @media (max-width: 900px) {
        .registration-header__badge {
          text-align: left;
        }

        .registration-card {
          padding: 8px 12px 20px;
        }
      }
    `
  ]
})
export class RegistrationLayoutComponent {
  @Input({ required: true }) form!: FormGroup;
  @Input({ required: true }) trial!: TrialSummaryDto;
  @Input() registrationMetadata?: TrialRegistrationMetadataDto | null;
  @Input() terms?: TermsDto | null;
  @ViewChild(ValidationSummaryComponent) summary?: ValidationSummaryComponent;

  validationSummaryVisible = false;

  constructor(
    private readonly host: ElementRef<HTMLElement>,
    private readonly dialog: MatDialog
  ) {}

  get dogGroup(): FormGroup {
    return this.form.get('dog') as FormGroup;
  }

  get contactGroup(): FormGroup {
    return this.form.get('contact') as FormGroup;
  }

  get entryNumber(): string | null {
    const control = this.form.get('entryNumber');
    if (!control) {
      return null;
    }
    const value = control.value as string | null;
    return value && value.trim().length > 0 ? value : null;
  }

  get emergencyGroup(): FormGroup {
    return this.form.get('emergencyContact') as FormGroup;
  }

  get feesGroup(): FormGroup {
    return this.form.get('fees') as FormGroup;
  }

  get upperSelections(): FormArray {
    return this.form.get('selections.upper') as FormArray;
  }

  get lowerSelections(): FormArray {
    return this.form.get('selections.lower') as FormArray;
  }

  get selectionsGroup(): FormGroup {
    return this.form.get('selections') as FormGroup;
  }

  get termsGroup(): FormGroup {
    return this.form.get('terms') as FormGroup;
  }

  get termsAcceptedControl(): FormControl {
    return this.termsGroup.get('accepted') as FormControl;
  }

  get termsAccepted(): boolean {
    return this.termsAcceptedControl?.value === true;
  }

  get termsVersion(): string | null {
    const value = this.termsGroup.get('version')?.value as string | null;
    return value && value.trim().length > 0 ? value : this.terms?.version ?? null;
  }

  get showSelectionsError(): boolean {
    const control = this.selectionsGroup;
    return control.hasError('minSelections') && (control.touched || control.dirty);
  }

  get showTermsError(): boolean {
    const control = this.termsAcceptedControl;
    return control.invalid && (control.touched || control.dirty);
  }

  get upperGridMetadata(): GridMetadata | null {
    if (!this.registrationMetadata) {
      return null;
    }

    return (
      this.registrationMetadata.formMetadata.grids.find(
        (grid) => grid.grid === 'Upper'
      ) ?? null
    );
  }

  get lowerGridMetadata(): GridMetadata | null {
    if (!this.registrationMetadata) {
      return null;
    }

    return (
      this.registrationMetadata.formMetadata.grids.find(
        (grid) => grid.grid === 'Lower'
      ) ?? null
    );
  }

  reviewForErrors(): void {
    this.validationSummaryVisible = true;
    this.form.markAllAsTouched();
    this.form.updateValueAndValidity();

    queueMicrotask(() => {
      const first = this.summary?.errors[0];
      if (first) {
        this.scrollToControl(first.path);
      }
    });
  }

  scrollToControl(path: string): void {
    const selector = `[data-control-path="${path}"]`;
    const element = this.host.nativeElement.querySelector(selector) as HTMLElement | null;
    if (!element) {
      return;
    }

    if (typeof element.scrollIntoView === 'function') {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    if (typeof element.focus === 'function') {
      element.focus({ preventScroll: true });
    }
  }

  openTermsDialog(): void {
    if (!this.terms) {
      return;
    }

    const dialogRef = this.dialog.open(TermsModalComponent, {
      data: this.terms,
      autoFocus: true,
      restoreFocus: true
    });

    dialogRef.afterClosed().subscribe((accepted: boolean | undefined) => {
      if (!accepted) {
        return;
      }

      if (this.termsAcceptedControl.disabled) {
        this.termsAcceptedControl.enable();
      }
      this.termsAcceptedControl.setValue(true);
      this.termsGroup.get('version')?.setValue(this.terms?.version ?? '');
      this.termsGroup.markAsDirty();
      this.termsGroup.updateValueAndValidity();
    });
  }
}
