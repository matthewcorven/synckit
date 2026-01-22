import { Component, Input } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';

@Component({
  selector: 'app-contact-section',
  standalone: true,
  imports: [
    NgFor,
    NgIf,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatIconModule,
    MatSelectModule
  ],
  template: `
    <section class="section">
      <div class="section__header">Owner / Handler Information</div>
      <mat-card class="section__body form-panel" [formGroup]="group">
        <div class="contact-grid">
          <mat-form-field class="wide" appearance="outline">
            <mat-label>Owner(s) *</mat-label>
            <input matInput formControlName="owners" required />
            <mat-error *ngIf="showRequiredError('owners')">Owner(s) is required.</mat-error>
          </mat-form-field>

          <div class="address-block" formGroupName="ownerAddress">
            <div class="address-label">Owner Address</div>
            <div class="address-grid">
              <mat-form-field class="wide" appearance="outline">
                <mat-label>Street</mat-label>
                <input matInput formControlName="street" />
                <mat-error *ngIf="showAddressRequiredError('street')">
                  Street is required when providing an address.
                </mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>City</mat-label>
                <input matInput formControlName="city" />
                <mat-error *ngIf="showAddressRequiredError('city')">
                  City is required when providing an address.
                </mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>State</mat-label>
                <mat-select formControlName="state">
                  <mat-option *ngFor="let state of states" [value]="state.abbr">
                    {{ state.abbr }} — {{ state.name }}
                  </mat-option>
                </mat-select>
                <mat-error *ngIf="showAddressRequiredError('state')">
                  State is required when providing an address.
                </mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>ZIP</mat-label>
                <input matInput formControlName="zip" inputmode="numeric" />
                <mat-error *ngIf="showAddressRequiredError('zip')">
                  ZIP is required when providing an address.
                </mat-error>
                <mat-error *ngIf="showZipFormatError()">Enter a valid ZIP code.</mat-error>
              </mat-form-field>
            </div>
          </div>

          <mat-form-field class="span-two" appearance="outline">
            <mat-label>Email *</mat-label>
            <input matInput formControlName="email" type="email" required />
            <mat-error *ngIf="showRequiredError('email')">Email is required.</mat-error>
            <mat-error *ngIf="showEmailFormatError()">Enter a valid email.</mat-error>
          </mat-form-field>

          <mat-form-field class="span-one" appearance="outline">
            <mat-label>Phone *</mat-label>
            <input matInput formControlName="phone" type="tel" required />
            <mat-error *ngIf="showRequiredError('phone')">Phone is required.</mat-error>
          </mat-form-field>

          <mat-form-field class="wide" appearance="outline">
            <mat-label>Handler (if different from owner)</mat-label>
            <input matInput formControlName="handler" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Membership Number</mat-label>
            <input matInput formControlName="membershipNumber" />
          </mat-form-field>

          <div class="junior-block" formGroupName="junior">
            <div class="junior-label">Junior Handler (if applicable)</div>
            <div class="junior-grid">
              <mat-form-field appearance="outline">
                <mat-label>Junior DOB</mat-label>
                <input matInput [matDatepicker]="juniorDobPicker" formControlName="dob" />
                <mat-datepicker-toggle matIconSuffix [for]="juniorDobPicker"></mat-datepicker-toggle>
                <mat-datepicker #juniorDobPicker></mat-datepicker>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Junior Member ID</mat-label>
                <input matInput formControlName="memberId" />
              </mat-form-field>
            </div>
          </div>
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

      .contact-grid {
        display: grid;
        gap: 12px;
        grid-template-columns: 2fr 1fr 1fr;
        align-items: start;
      }

      .contact-grid mat-form-field {
        width: 100%;
      }

      .wide {
        grid-column: 1 / -1;
      }

      .span-two {
        grid-column: 1 / span 2;
      }

      .span-one {
        grid-column: 3;
      }

      .address-block {
        grid-column: 1 / -1;
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 10px;
        border-radius: 8px;
        border: 1px solid var(--mat-sys-outline-variant);
        background: var(--mat-sys-surface);
      }

      .address-label {
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--mat-sys-on-surface-variant);
      }

      .address-grid {
        display: grid;
        gap: 12px;
        grid-template-columns: 2fr 1fr 1fr;
        align-items: start;
      }

      .address-grid .wide {
        grid-column: 1 / -1;
      }

      .junior-block {
        grid-column: 2 / -1;
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 10px;
        border-radius: 8px;
        border: 1px solid var(--mat-sys-outline-variant);
        background: var(--mat-sys-surface);
      }

      .junior-label {
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--mat-sys-on-surface-variant);
      }

      .junior-grid {
        display: grid;
        gap: 12px;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      @media (max-width: 900px) {
        .contact-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .span-one {
          grid-column: 1 / -1;
        }

        .address-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .junior-block {
          grid-column: 1 / -1;
        }
      }

      @media (max-width: 600px) {
        .contact-grid,
        .address-grid,
        .junior-grid {
          grid-template-columns: 1fr;
        }
      }
    `
  ]
})
export class ContactSectionComponent {
  @Input() group!: FormGroup;

  readonly states = [
    { abbr: 'AL', name: 'Alabama' },
    { abbr: 'AK', name: 'Alaska' },
    { abbr: 'AZ', name: 'Arizona' },
    { abbr: 'AR', name: 'Arkansas' },
    { abbr: 'CA', name: 'California' },
    { abbr: 'CO', name: 'Colorado' },
    { abbr: 'CT', name: 'Connecticut' },
    { abbr: 'DE', name: 'Delaware' },
    { abbr: 'FL', name: 'Florida' },
    { abbr: 'GA', name: 'Georgia' },
    { abbr: 'HI', name: 'Hawaii' },
    { abbr: 'ID', name: 'Idaho' },
    { abbr: 'IL', name: 'Illinois' },
    { abbr: 'IN', name: 'Indiana' },
    { abbr: 'IA', name: 'Iowa' },
    { abbr: 'KS', name: 'Kansas' },
    { abbr: 'KY', name: 'Kentucky' },
    { abbr: 'LA', name: 'Louisiana' },
    { abbr: 'ME', name: 'Maine' },
    { abbr: 'MD', name: 'Maryland' },
    { abbr: 'MA', name: 'Massachusetts' },
    { abbr: 'MI', name: 'Michigan' },
    { abbr: 'MN', name: 'Minnesota' },
    { abbr: 'MS', name: 'Mississippi' },
    { abbr: 'MO', name: 'Missouri' },
    { abbr: 'MT', name: 'Montana' },
    { abbr: 'NE', name: 'Nebraska' },
    { abbr: 'NV', name: 'Nevada' },
    { abbr: 'NH', name: 'New Hampshire' },
    { abbr: 'NJ', name: 'New Jersey' },
    { abbr: 'NM', name: 'New Mexico' },
    { abbr: 'NY', name: 'New York' },
    { abbr: 'NC', name: 'North Carolina' },
    { abbr: 'ND', name: 'North Dakota' },
    { abbr: 'OH', name: 'Ohio' },
    { abbr: 'OK', name: 'Oklahoma' },
    { abbr: 'OR', name: 'Oregon' },
    { abbr: 'PA', name: 'Pennsylvania' },
    { abbr: 'RI', name: 'Rhode Island' },
    { abbr: 'SC', name: 'South Carolina' },
    { abbr: 'SD', name: 'South Dakota' },
    { abbr: 'TN', name: 'Tennessee' },
    { abbr: 'TX', name: 'Texas' },
    { abbr: 'UT', name: 'Utah' },
    { abbr: 'VT', name: 'Vermont' },
    { abbr: 'VA', name: 'Virginia' },
    { abbr: 'WA', name: 'Washington' },
    { abbr: 'WV', name: 'West Virginia' },
    { abbr: 'WI', name: 'Wisconsin' },
    { abbr: 'WY', name: 'Wyoming' }
  ];

  showRequiredError(controlName: string): boolean {
    const control = this.group?.get(controlName);
    return !!control && control.hasError('required') && (control.dirty || control.touched);
  }

  showEmailFormatError(): boolean {
    const control = this.group?.get('email');
    return !!control && control.hasError('email') && (control.dirty || control.touched);
  }

  showAddressRequiredError(controlName: string): boolean {
    const addressGroup = this.group?.get('ownerAddress') as FormGroup | null;
    const control = addressGroup?.get(controlName);
    return !!control && control.hasError('required') && (control.dirty || control.touched);
  }

  showZipFormatError(): boolean {
    const addressGroup = this.group?.get('ownerAddress') as FormGroup | null;
    const control = addressGroup?.get('zip');
    return !!control && control.hasError('pattern') && (control.dirty || control.touched);
  }
}
