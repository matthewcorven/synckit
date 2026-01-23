import { Component, Input } from '@angular/core';
import { NgIf } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatNativeDateModule } from '@angular/material/core';
import { MatRadioModule } from '@angular/material/radio';
import { InlineErrorDirective } from '../../../shared/forms/inline-error.directive';

@Component({
  selector: 'app-dog-section',
  standalone: true,
  imports: [
    NgIf,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatIconModule,
    MatRadioModule,
    InlineErrorDirective
  ],
  template: `
    <section class="section">
      <div class="section__header">Dog Information</div>
      <mat-card class="section__body form-panel" [formGroup]="group">
        <div class="dog-grid">
          <mat-form-field class="wide" appearance="outline" *ngIf="entryNumber">
            <mat-label>Entry #</mat-label>
            <input matInput [value]="entryNumber" readonly />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>ASCA Registration #</mat-label>
            <input matInput formControlName="ascaRegistrationNumber" data-control-path="dog.ascaRegistrationNumber" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Breed</mat-label>
            <input matInput formControlName="breed" required data-control-path="dog.breed" />
            <mat-error *appInlineError="group.get('breed'); errorKey: 'required'">
              Breed is required.
            </mat-error>
            <mat-error *appInlineError="group.get('breed'); errorKey: 'server'; let message">
              {{ message }}
            </mat-error>
          </mat-form-field>

          <mat-form-field class="wide" appearance="outline">
            <mat-label>Registered Name</mat-label>
            <input matInput formControlName="registeredName" data-control-path="dog.registeredName" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Call Name</mat-label>
            <input matInput formControlName="callName" required data-control-path="dog.callName" />
            <mat-error *appInlineError="group.get('callName'); errorKey: 'required'">
              Call Name is required.
            </mat-error>
            <mat-error *appInlineError="group.get('callName'); errorKey: 'server'; let message">
              {{ message }}
            </mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Date of Birth</mat-label>
            <input
              matInput
              [matDatepicker]="dobPicker"
              formControlName="dob"
              required
              data-control-path="dog.dob"
            />
            <mat-datepicker-toggle matIconSuffix [for]="dobPicker"></mat-datepicker-toggle>
            <mat-datepicker #dobPicker></mat-datepicker>
            <mat-error *appInlineError="group.get('dob'); errorKey: 'required'">
              Date of Birth is required.
            </mat-error>
            <mat-error *appInlineError="group.get('dob'); errorKey: 'server'; let message">
              {{ message }}
            </mat-error>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Color</mat-label>
            <input matInput formControlName="color" data-control-path="dog.color" />
          </mat-form-field>

          <div class="sex-field">
            <label class="radio-label">Sex</label>
            <mat-radio-group
              class="radio-group"
              formControlName="sex"
              required
              aria-label="Dog sex"
              data-control-path="dog.sex"
            >
              <mat-radio-button value="Male">Male</mat-radio-button>
              <mat-radio-button value="Female">Female</mat-radio-button>
            </mat-radio-group>
            <div class="field-error" *appInlineError="group.get('sex'); errorKey: 'required'">
              Sex is required.
            </div>
            <div class="field-error" *appInlineError="group.get('sex'); errorKey: 'server'; let message">
              {{ message }}
            </div>
          </div>

          <mat-form-field appearance="outline">
            <mat-label>Sire</mat-label>
            <input matInput formControlName="sire" data-control-path="dog.sire" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Dam</mat-label>
            <input matInput formControlName="dam" data-control-path="dog.dam" />
          </mat-form-field>

          <mat-form-field class="wide" appearance="outline">
            <mat-label>Breeder(s)</mat-label>
            <input matInput formControlName="breeders" data-control-path="dog.breeders" />
          </mat-form-field>
        </div>
      </mat-card>
    </section>
  `,
  styles: [
    `
      .section {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .section__header {
        font-size: 15px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        padding-bottom: 6px;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
      }

      .section__body {
        padding: 12px;
      }

      .form-panel {
        border: 1px solid var(--mat-sys-outline-variant);
        box-shadow: none;
      }

      .dog-grid {
        display: grid;
        gap: 12px;
        grid-template-columns: repeat(2, 1fr);
        align-items: start;
      }

      .dog-grid mat-form-field {
        width: 100%;
      }

      .wide {
        grid-column: 1 / -1;
      }

      .sex-field {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 8px 12px;
        border-radius: 6px;
        border: 1px solid var(--mat-sys-outline-variant);
        background: var(--mat-sys-surface);
      }

      .radio-label {
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--mat-sys-on-surface-variant);
      }

      .radio-group {
        display: flex;
        gap: 16px;
        flex-wrap: wrap;
      }

      .field-error {
        font-size: 12px;
        color: var(--mat-sys-error);
      }
    `
  ]
})
export class DogSectionComponent {
  @Input() group!: FormGroup;
  @Input() entryNumber?: string | null;
}
