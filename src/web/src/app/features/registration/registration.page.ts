import { Component, OnInit } from '@angular/core';
import { NgIf } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators
} from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RegistrationLayoutComponent } from './registration-layout/registration-layout.component';
import { TrialService } from '../trials/trial.service';
import { TrialSummaryDto } from '../trials/trial.types';
import { RegistrationMetadataService } from './registration-metadata.service';
import { TrialRegistrationMetadataDto } from './registration.types';

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
      ></app-registration-layout>
    </section>
  `
})
export class RegistrationPageComponent implements OnInit {
  form: FormGroup;
  trial: TrialSummaryDto | null = null;
  registrationMetadata: TrialRegistrationMetadataDto | null = null;
  isLoading = true;
  errorMessage = '';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly trialService: TrialService,
    private readonly metadataService: RegistrationMetadataService,
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
      selections: this.formBuilder.group({
        upper: this.formBuilder.array([]),
        lower: this.formBuilder.array([])
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
        this.metadataService.getRegistrationMetadata(trialId).subscribe({
          next: (metadata) => {
            this.registrationMetadata = metadata;
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
}
