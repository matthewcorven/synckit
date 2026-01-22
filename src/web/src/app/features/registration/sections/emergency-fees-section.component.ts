import { Component, Input } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-emergency-fees-section',
  standalone: true,
  imports: [MatCardModule],
  template: `
    <section class="section">
      <div class="section__header">Emergency Contact / Fees</div>
      <div class="section__grid">
        <mat-card class="section__body form-panel">
          <div class="section__subheader">Emergency Contact Name &amp; Number</div>
          <div class="placeholder-grid">
            <div class="placeholder-item">
              <div class="field-label">Name</div>
              <div class="placeholder-field"></div>
            </div>
            <div class="placeholder-item">
              <div class="field-label">Number</div>
              <div class="placeholder-field"></div>
            </div>
          </div>
        </mat-card>
        <mat-card class="section__body form-panel">
          <div class="section__subheader">Entry Fees</div>
          <div class="placeholder-grid">
            <div class="placeholder-item">
              <div class="field-label">Total Entry Fees ($)</div>
              <div class="placeholder-field"></div>
            </div>
          </div>
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

      .placeholder-grid {
        display: grid;
        gap: 10px;
        grid-template-columns: 1fr;
      }

      .placeholder-item {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .placeholder-field {
        height: 36px;
        border-radius: 6px;
        background: var(--mat-sys-surface-variant);
        opacity: 0.7;
      }

      .field-label {
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--mat-sys-on-surface-variant);
      }
    `
  ]
})
export class EmergencyFeesSectionComponent {
  @Input() emergencyGroup!: FormGroup;
  @Input() feesGroup!: FormGroup;
}
