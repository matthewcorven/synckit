import { Component, Input } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-contact-section',
  standalone: true,
  imports: [MatCardModule],
  template: `
    <section class="section">
      <div class="section__header">Owner / Handler Information</div>
      <mat-card class="section__body form-panel">
        <div class="placeholder-grid">
          <!-- Row 1: Owners (full width) -->
          <div class="placeholder-item wide">
            <div class="field-label">Owner(s)</div>
            <div class="placeholder-field"></div>
          </div>
          <!-- Row 2: Street Address (full width) -->
          <div class="placeholder-item wide">
            <div class="field-label">Owner Address</div>
            <div class="placeholder-field"></div>
          </div>
          <!-- Row 3: City, State, Zip -->
          <div class="placeholder-item city">
            <div class="field-label">City</div>
            <div class="placeholder-field"></div>
          </div>
          <div class="placeholder-item state">
            <div class="field-label">State</div>
            <div class="placeholder-field"></div>
          </div>
          <div class="placeholder-item zip">
            <div class="field-label">Zip</div>
            <div class="placeholder-field"></div>
          </div>
          <!-- Row 4: Email, Phone -->
          <div class="placeholder-item span-two">
            <div class="field-label">Email</div>
            <div class="placeholder-field"></div>
          </div>
          <div class="placeholder-item span-one">
            <div class="field-label">Phone</div>
            <div class="placeholder-field"></div>
          </div>
          <!-- Row 5: Handler Name (full width) -->
          <div class="placeholder-item wide">
            <div class="field-label">Handler (if different from owner)</div>
            <div class="placeholder-field"></div>
          </div>
          <!-- Row 6: Membership # + Junior DOB -->
          <div class="placeholder-item span-two">
            <div class="field-label">Membership Number / <br/>Junior Member ID</div>
            <div class="placeholder-field"></div>
          </div>
          <div class="placeholder-item span-one">
            <div class="field-label">Junior DOB <br/>(if Junior is handling dog)</div>
            <div class="placeholder-field"></div>
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

      .placeholder-grid {
        display: grid;
        gap: 10px;
        grid-template-columns: 2fr 1fr 1fr;
      }

      .placeholder-item {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .placeholder-item.wide {
        grid-column: 1 / -1;
      }

      .placeholder-item.span-two {
        grid-column: 1 / span 2;
      }

      .placeholder-item.span-one {
        grid-column: 3;
      }

      .placeholder-item.city {
        grid-column: 1;
      }

      .placeholder-item.state {
        grid-column: 2;
      }

      .placeholder-item.zip {
        grid-column: 3;
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
export class ContactSectionComponent {
  @Input() group!: FormGroup;
}
