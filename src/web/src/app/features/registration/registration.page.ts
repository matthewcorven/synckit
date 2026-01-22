import { Component, OnInit } from '@angular/core';
import { NgIf } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RegistrationLayoutComponent } from './registration-layout/registration-layout.component';
import { TrialService } from '../trials/trial.service';
import { TrialSummaryDto } from '../trials/trial.types';

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
      ></app-registration-layout>
    </section>
  `
})
export class RegistrationPageComponent implements OnInit {
  form: FormGroup;
  trial: TrialSummaryDto | null = null;
  isLoading = true;
  errorMessage = '';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly trialService: TrialService,
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
        ownerAddress: this.formBuilder.group({}),
        junior: this.formBuilder.group({})
      }),
      emergencyContact: this.formBuilder.group({}),
      fees: this.formBuilder.group({}),
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
        this.isLoading = false;
      },
      error: () => {
        this.errorMessage = 'Unable to load trial details. Please try again.';
        this.isLoading = false;
      }
    });
  }
}
