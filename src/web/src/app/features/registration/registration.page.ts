import { Component, OnInit } from '@angular/core';
import { NgIf } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  AbstractControl,
  FormBuilder,
  FormArray,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators
} from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { HttpErrorResponse } from '@angular/common/http';
import { forkJoin } from 'rxjs';
import { RegistrationLayoutComponent } from './registration-layout/registration-layout.component';
import { TrialService } from '../trials/trial.service';
import { TrialSummaryDto } from '../trials/trial.types';
import { RegistrationMetadataService } from './registration-metadata.service';
import {
  ProblemDetails,
  SubmitEntryRequestDto,
  TermsDto,
  TrialRegistrationMetadataDto
} from './registration.types';
import { applyServerErrorsToForm, clearServerErrors, ValidationErrorMap } from './validation.utils';
import { TermsService } from './terms.service';
import { RegistrationSubmitService } from './registration-submit.service';
import { RegistrationSubmissionStore } from './registration-submission.store';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-registration-page',
  standalone: true,
  imports: [
    NgIf,
    MatCardModule,
    MatProgressSpinnerModule,
    ReactiveFormsModule,
    RegistrationLayoutComponent
  ],
  template: `
    <section class="registration-page">
      <div class="registration-status" *ngIf="isLoading">
        <mat-progress-spinner diameter="36" mode="indeterminate"></mat-progress-spinner>
        <span>Loading registration form…</span>
      </div>

      <div class="registration-status" *ngIf="errorMessage">
        <mat-card>
          <mat-card-title>Unable to load trial</mat-card-title>
          <mat-card-content>{{ errorMessage }}</mat-card-content>
        </mat-card>
      </div>

      <app-registration-layout
        *ngIf="!isLoading && !errorMessage && trial"
        [trial]="trial"
        [form]="form"
        [registrationMetadata]="registrationMetadata"
        [terms]="terms"
        [isSubmitting]="isSubmitting"
        [submitErrorMessage]="submitErrorMessage"
        [submitSupportId]="submitSupportId"
        (submitEntry)="submitEntry()"
      ></app-registration-layout>
    </section>
  `
})
export class RegistrationPageComponent implements OnInit {
  form: FormGroup;
  trial: TrialSummaryDto | null = null;
  registrationMetadata: TrialRegistrationMetadataDto | null = null;
  terms: TermsDto | null = null;
  isLoading = true;
  errorMessage = '';
  isSubmitting = false;
  submitErrorMessage = '';
  submitSupportId = '';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly trialService: TrialService,
    private readonly metadataService: RegistrationMetadataService,
    private readonly termsService: TermsService,
    private readonly submitService: RegistrationSubmitService,
    private readonly submissionStore: RegistrationSubmissionStore,
    private readonly router: Router,
    private readonly formBuilder: FormBuilder
  ) {
    this.form = this.formBuilder.group({
      entryNumber: [{ value: '', disabled: true }],
      dog: this.formBuilder.group({
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
      }),
      contact: this.formBuilder.group({
        owners: ['', Validators.required],
        ownerAddress: this.createAddressGroup(),
        email: ['', [Validators.required, Validators.email]],
        phone: ['', Validators.required],
        handler: [''],
        membershipNumber: [''],
        junior: this.formBuilder.group({
          dob: [null],
          memberId: ['']
        })
      }),
      emergencyContact: this.formBuilder.group({
        name: ['', Validators.required],
        phoneOrNumber: ['', Validators.required]
      }),
      fees: this.formBuilder.group({
        totalEntryFees: this.formBuilder.control<number | null>(null, [
          Validators.required,
          Validators.min(0.01)
        ]),
        currency: ['USD']
      }),
      selections: this.formBuilder.group(
        {
          upper: this.formBuilder.array([]),
          lower: this.formBuilder.array([])
        },
        { validators: [this.minSelectionsValidator()] }
      ),
      terms: this.formBuilder.group({
        version: [''],
        accepted: this.formBuilder.control({ value: false, disabled: true }, [
          Validators.requiredTrue
        ])
      })
    });
  }

  ngOnInit(): void {
    const trialId = this.route.snapshot.paramMap.get('trialId');

    if (!trialId) {
      this.errorMessage = 'Missing trial identifier.';
      this.isLoading = false;
      return;
    }

    this.trialService.getTrial(trialId).subscribe({
      next: (trial) => {
        this.trial = trial;
        forkJoin({
          metadata: this.metadataService.getRegistrationMetadata(trialId),
          terms: this.termsService.getCurrentTerms()
        }).subscribe({
          next: ({ metadata, terms }) => {
            this.registrationMetadata = metadata;
            this.terms = terms;
            this.isLoading = false;
          },
          error: () => {
            this.errorMessage = 'Unable to load registration metadata. Please try again.';
            this.isLoading = false;
          }
        });
      },
      error: () => {
        this.errorMessage = 'Unable to load trial details. Please try again.';
        this.isLoading = false;
      }
    });
  }

  private createAddressGroup(): FormGroup {
    const group = this.formBuilder.group(
      {
        street: [''],
        city: [''],
        state: [''],
        zip: ['', Validators.pattern(/^\d{5}(-\d{4})?$/)]
      },
      { validators: [this.addressCompletenessValidator()] }
    );

    return group;
  }

  private addressCompletenessValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const group = control as FormGroup;
      const fields = ['street', 'city', 'state', 'zip'];
      const values = fields.map((field) => group.get(field)?.value as string | null);
      const hasAnyValue = values.some((value) => !!value && value.toString().trim().length > 0);

      fields.forEach((field) => {
        const fieldControl = group.get(field);
        if (!fieldControl) {
          return;
        }
        const rawValue = fieldControl.value as string | null;
        const hasValue = !!rawValue && rawValue.toString().trim().length > 0;
        if (hasAnyValue && !hasValue) {
          const existingErrors = fieldControl.errors ?? {};
          if (!existingErrors['required']) {
            fieldControl.setErrors({ ...existingErrors, required: true });
          }
        } else if (fieldControl.hasError('required')) {
          const { required, ...remaining } = fieldControl.errors ?? {};
          fieldControl.setErrors(Object.keys(remaining).length > 0 ? remaining : null);
        }
      });

      if (!hasAnyValue) {
        return null;
      }

      const isComplete = fields.every((field) => {
        const value = group.get(field)?.value as string | null;
        return !!value && value.toString().trim().length > 0;
      });

      return isComplete ? null : { addressIncomplete: true };
    };
  }

  private minSelectionsValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const group = control as FormGroup;
      const upper = group.get('upper');
      const lower = group.get('lower');

      const total =
        (upper instanceof FormArray ? upper.length : 0) +
        (lower instanceof FormArray ? lower.length : 0);

      return total > 0 ? null : { minSelections: true };
    };
  }

  applyServerValidationErrors(errors: ValidationErrorMap): void {
    clearServerErrors(this.form);
    applyServerErrorsToForm(this.form, errors);
  }

  submitEntry(): void {
    if (this.isSubmitting || !this.trial) {
      return;
    }

    clearServerErrors(this.form);
    this.submitErrorMessage = '';
    this.submitSupportId = '';

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.form.updateValueAndValidity();
      return;
    }

    const entryId = this.getOrCreateEntryId(this.trial.trialId);
    if (!entryId) {
      this.submitErrorMessage = 'Unable to locate a draft entry to submit.';
      return;
    }

    const termsVersion =
      (this.form.get('terms.version')?.value as string | null) ||
      this.terms?.version ||
      '';

    const payload: SubmitEntryRequestDto = {
      acceptTerms: true,
      termsVersion
    };

    this.isSubmitting = true;
    this.submitService.submitEntry(entryId, payload).subscribe({
      next: (response) => {
        this.isSubmitting = false;
        this.submissionStore.save(this.trial!.trialId, {
          entryId: response.entryId,
          trialId: this.trial!.trialId,
          supportId: response.supportId,
          submittedAtUtc: new Date().toISOString()
        });
        this.router.navigate(['/register', this.trial!.trialId, 'confirmation']);
      },
      error: (error: HttpErrorResponse) => {
        this.isSubmitting = false;
        this.handleSubmitError(error);
      }
    });
  }

  private handleSubmitError(error: HttpErrorResponse): void {
    const supportId =
      error.headers?.get('x-support-id') ||
      (error.error as ProblemDetails | undefined)?.traceId ||
      '';
    this.submitSupportId = supportId;

    const problem = error.error as ProblemDetails | null;
    if (problem?.errors) {
      this.applyServerValidationErrors(problem.errors);
    }

    this.submitErrorMessage =
      problem?.title || 'Unable to submit entry. Please try again.';
  }

  private getOrCreateEntryId(trialId: string): string | null {
    const key = `draft-entry:${trialId}`;
    const existing = sessionStorage.getItem(key);
    if (existing) {
      return existing;
    }

    if (!environment.useMocks) {
      return null;
    }

    const created = this.createUuid();
    sessionStorage.setItem(key, created);
    return created;
  }

  private createUuid(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }

    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
      const rand = (Math.random() * 16) | 0;
      const value = char === 'x' ? rand : (rand & 0x3) | 0x8;
      return value.toString(16);
    });
  }
}
