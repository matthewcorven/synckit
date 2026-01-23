import { Component, Input } from '@angular/core';
import { NgFor } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { InlineErrorDirective } from '../../../shared/forms/inline-error.directive';

@Component({
  selector: 'app-contact-section',
  standalone: true,
  imports: [
    NgFor,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatIconModule,
    MatSelectModule,
    InlineErrorDirective
  ],
  template: `
    <section class="section">
      <div class="section__header">Owner / Handler Information</div>
      <mat-card class="section__body form-panel" [formGroup]="group">
        <div class="contact-grid">
          <mat-form-field class="wide" appearance="outline">
            <mat-label>Owner(s) *</mat-label>
            <input matInput formControlName="owners" required data-control-path="contact.owners" />
            <mat-error *appInlineError="group.get('owners'); errorKey: 'required'">
              Owner(s) is required.
            </mat-error>
            <mat-error *appInlineError="group.get('owners'); errorKey: 'server'; let message">
              {{ message }}
            </mat-error>
          </mat-form-field>

          <div class="address-block" formGroupName="ownerAddress">
            <div class="address-label">Owner Address</div>
            <div class="address-grid">
              <mat-form-field class="wide" appearance="outline">
                <mat-label>Street</mat-label>
                <input matInput formControlName="street" data-control-path="contact.ownerAddress.street" />
                <mat-error *appInlineError="addressGroup?.get('street'); errorKey: 'required'">
                  Street is required when providing an address.
                </mat-error>
                <mat-error *appInlineError="addressGroup?.get('street'); errorKey: 'server'; let message">
                  {{ message }}
                </mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>City</mat-label>
                <input matInput formControlName="city" data-control-path="contact.ownerAddress.city" />
                <mat-error *appInlineError="addressGroup?.get('city'); errorKey: 'required'">
                  City is required when providing an address.
                </mat-error>
                <mat-error *appInlineError="addressGroup?.get('city'); errorKey: 'server'; let message">
                  {{ message }}
                </mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>State</mat-label>
                <mat-select formControlName="state" data-control-path="contact.ownerAddress.state">
                  <mat-option *ngFor="let state of states" [value]="state.abbr">
                    {{ state.abbr }} — {{ state.name }}
                  </mat-option>
                </mat-select>
                <mat-error *appInlineError="addressGroup?.get('state'); errorKey: 'required'">
                  State is required when providing an address.
                </mat-error>
                <mat-error *appInlineError="addressGroup?.get('state'); errorKey: 'server'; let message">
                  {{ message }}
                </mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>ZIP</mat-label>
                <input matInput formControlName="zip" inputmode="numeric" data-control-path="contact.ownerAddress.zip" />
                <mat-error *appInlineError="addressGroup?.get('zip'); errorKey: 'required'">
                  ZIP is required when providing an address.
                </mat-error>
                <mat-error *appInlineError="addressGroup?.get('zip'); errorKey: 'pattern'">
                  Enter a valid ZIP code.
                </mat-error>
                <mat-error *appInlineError="addressGroup?.get('zip'); errorKey: 'server'; let message">
                  {{ message }}
                </mat-error>
              </mat-form-field>
            </div>
          </div>

          <mat-form-field class="span-two" appearance="outline">
            <mat-label>Email *</mat-label>
            <input matInput formControlName="email" type="email" required data-control-path="contact.email" />
            <mat-error *appInlineError="group.get('email'); errorKey: 'required'">
              Email is required.
            </mat-error>
            <mat-error *appInlineError="group.get('email'); errorKey: 'email'">
              Enter a valid email.
            </mat-error>
            <mat-error *appInlineError="group.get('email'); errorKey: 'server'; let message">
              {{ message }}
            </mat-error>
          </mat-form-field>

          <mat-form-field class="span-one" appearance="outline">
            <mat-label>Phone *</mat-label>
            <input matInput formControlName="phone" type="tel" required data-control-path="contact.phone" />
            <mat-error *appInlineError="group.get('phone'); errorKey: 'required'">
              Phone is required.
            </mat-error>
            <mat-error *appInlineError="group.get('phone'); errorKey: 'server'; let message">
              {{ message }}
            </mat-error>
          </mat-form-field>

          <mat-form-field class="wide" appearance="outline">
            <mat-label>Handler (if different from owner)</mat-label>
            <input matInput formControlName="handler" data-control-path="contact.handler" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Membership Number</mat-label>
            <input matInput formControlName="membershipNumber" data-control-path="contact.membershipNumber" />
          </mat-form-field>

          <div class="junior-block" formGroupName="junior">
            <div class="junior-label">Junior Handler (if applicable)</div>
            <div class="junior-grid">
              <mat-form-field appearance="outline">
                <mat-label>Junior DOB</mat-label>
                <input
                  matInput
                  [matDatepicker]="juniorDobPicker"
                  formControlName="dob"
                  data-control-path="contact.junior.dob"
                />
                <mat-datepicker-toggle matIconSuffix [for]="juniorDobPicker"></mat-datepicker-toggle>
                <mat-datepicker #juniorDobPicker></mat-datepicker>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Junior Member ID</mat-label>
                <input matInput formControlName="memberId" data-control-path="contact.junior.memberId" />
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

  get addressGroup(): FormGroup | null {
    return this.group?.get('ownerAddress') as FormGroup | null;
  }
}
