import { Component, Input } from '@angular/core';
import { DatePipe, NgIf } from '@angular/common';
import { FormArray, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { TrialSummaryDto } from '../../trials/trial.types';
import { DogSectionComponent } from '../sections/dog-section.component';
import { ContactSectionComponent } from '../sections/contact-section.component';
import { EmergencyFeesSectionComponent } from '../sections/emergency-fees-section.component';
import { UpperGridSectionComponent } from '../sections/upper-grid-section.component';
import { LowerGridSectionComponent } from '../sections/lower-grid-section.component';
import { GridMetadata, TrialRegistrationMetadataDto } from '../registration.types';

@Component({
  selector: 'app-registration-layout',
  standalone: true,
  imports: [
    DatePipe,
    NgIf,
    ReactiveFormsModule,
    MatCardModule,
    MatDividerModule,
    DogSectionComponent,
    ContactSectionComponent,
    EmergencyFeesSectionComponent,
    UpperGridSectionComponent,
    LowerGridSectionComponent
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

      <form class="registration-form" [formGroup]="form">
        <app-dog-section [group]="dogGroup" [entryNumber]="entryNumber"></app-dog-section>
        <app-contact-section [group]="contactGroup"></app-contact-section>
        <section class="section-block">
          <div class="section-title">Class Selections</div>
          <app-upper-grid-section
            [trial]="trial"
            [gridMetadata]="upperGridMetadata"
            [selectionsControl]="upperSelections"
          ></app-upper-grid-section>
          <app-lower-grid-section [trial]="trial"></app-lower-grid-section>
        </section>

        <app-emergency-fees-section
          [emergencyGroup]="emergencyGroup"
          [feesGroup]="feesGroup"
        ></app-emergency-fees-section>
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

      .section-title {
        font-size: 15px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        padding-bottom: 6px;
        border-bottom: 2px solid var(--mat-sys-outline-variant);
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
}
