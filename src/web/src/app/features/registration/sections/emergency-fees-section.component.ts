import { Component, Input } from '@angular/core';
import { NgIf } from '@angular/common';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { InlineErrorDirective } from '../../../shared/forms/inline-error.directive';

@Component({
  selector: 'app-emergency-fees-section',
  standalone: true,
  imports: [
    NgIf,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    InlineErrorDirective
  ],
  template: `
    <section class="section">
      <div class="section__header">Emergency Contact / Fees</div>
      <div class="section__grid">
        <mat-card class="section__body form-panel" [formGroup]="emergencyGroup">
          <div class="section__subheader">Emergency Contact</div>
          <div class="field-grid">
            <mat-form-field appearance="outline">
              <mat-label>Name *</mat-label>
              <input matInput formControlName="name" required data-control-path="emergencyContact.name" />
              <mat-error *appInlineError="emergencyGroup.get('name'); errorKey: 'required'">
                Emergency contact name is required.
              </mat-error>
              <mat-error *appInlineError="emergencyGroup.get('name'); errorKey: 'server'; let message">
                {{ message }}
              </mat-error>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Phone/Number *</mat-label>
              <input
                matInput
                formControlName="phoneOrNumber"
                required
                data-control-path="emergencyContact.phoneOrNumber"
              />
              <mat-error *appInlineError="emergencyGroup.get('phoneOrNumber'); errorKey: 'required'">
                Emergency contact number is required.
              </mat-error>
              <mat-error *appInlineError="emergencyGroup.get('phoneOrNumber'); errorKey: 'server'; let message">
                {{ message }}
              </mat-error>
            </mat-form-field>
          </div>
        </mat-card>
        <mat-card class="section__body form-panel" [formGroup]="feesGroup">
          <div class="section__subheader">Entry Fees</div>
          <div class="field-grid">
            <mat-form-field appearance="outline" class="fee-field">
              <mat-label>Total Entry Fees *</mat-label>
              <span matPrefix>$&nbsp;</span>
              <input
                matInput
                formControlName="totalEntryFees"
                type="number"
                inputmode="decimal"
                min="0.01"
                step="0.01"
                required
                data-control-path="fees.totalEntryFees"
              />
              <span matSuffix>USD</span>
              <mat-error *appInlineError="feesGroup.get('totalEntryFees'); errorKey: 'required'">
                Total entry fees are required.
              </mat-error>
              <mat-error *appInlineError="feesGroup.get('totalEntryFees'); errorKey: 'min'">
                Total entry fees must be greater than $0.00.
              </mat-error>
              <mat-error *appInlineError="feesGroup.get('totalEntryFees'); errorKey: 'server'; let message">
                {{ message }}
              </mat-error>
            </mat-form-field>
          </div>
          <div class="fees-summary" *ngIf="formattedTotal">
            Total: {{ formattedTotal }}
          </div>
          <div class="fees-note">Payment details are not collected here.</div>
        </mat-card>
      </div>
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

      .section__grid {
        display: grid;
        gap: 12px;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      }

      .section__body {
        padding: 12px;
      }

      .form-panel {
        border: 1px solid var(--mat-sys-outline-variant);
        box-shadow: none;
      }

      .section__subheader {
        font-weight: 600;
        margin-bottom: 4px;
      }

      .field-grid {
        display: grid;
        gap: 12px;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        align-items: start;
      }

      mat-form-field {
        width: 100%;
      }

      .fee-field {
        max-width: 280px;
      }

      .fees-summary {
        margin-top: 4px;
        font-weight: 600;
      }

      .fees-note {
        margin-top: 6px;
        font-size: 12px;
        color: var(--mat-sys-on-surface-variant);
      }
    `
  ]
})
export class EmergencyFeesSectionComponent {
  @Input() emergencyGroup!: FormGroup;
  @Input() feesGroup!: FormGroup;

  get formattedTotal(): string | null {
    const control = this.feesGroup?.get('totalEntryFees');
    const value = control?.value;
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const numericValue = Number(value);
    if (Number.isNaN(numericValue)) {
      return null;
    }
    return this.formatFee(numericValue);
  }

  formatFee(value: number): string {
    return `${new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value)} USD`;
  }

}
