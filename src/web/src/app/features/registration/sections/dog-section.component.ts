import { Component, Input } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatRadioModule } from '@angular/material/radio';

@Component({
  selector: 'app-dog-section',
  standalone: true,
  imports: [MatCardModule, MatRadioModule],
  template: `
    <section class="section">
      <div class="section__header">Dog Information</div>
      <mat-card class="section__body form-panel">
        <div class="placeholder-grid">
          <!-- Row 1: Registration # + Breed -->
          <div class="placeholder-item">
            <div class="field-label">Registration/Tracking # (ASCA)</div>
            <div class="placeholder-field"></div>
          </div>
          <div class="placeholder-item">
            <div class="field-label">Breed</div>
            <div class="placeholder-field"></div>
          </div>
          <!-- Row 2: Registered Name -->
          <div class="placeholder-item wide">
            <div class="field-label">Registered Name</div>
            <div class="placeholder-field"></div>
          </div>
          <!-- Row 3: DOB + Color -->
          <div class="placeholder-item">
            <div class="field-label">Date of Birth</div>
            <div class="placeholder-field"></div>
          </div>
          <div class="placeholder-item">
            <div class="field-label">Color</div>
            <div class="placeholder-field"></div>
          </div>
          <!-- Row 4: Call Name + Sex -->
          <div class="placeholder-item">
            <div class="field-label">Call Name</div>
            <div class="placeholder-field"></div>
          </div>
          <div class="placeholder-item">
            <div class="field-label">Sex</div>
            <mat-radio-group class="radio-group" aria-label="Dog sex">
              <mat-radio-button value="male">Male</mat-radio-button>
              <mat-radio-button value="female">Female</mat-radio-button>
            </mat-radio-group>
          </div>
          <!-- Row 5: Sire -->
          <div class="placeholder-item wide">
            <div class="field-label">Sire</div>
            <div class="placeholder-field"></div>
          </div>
          <!-- Row 6: Dam -->
          <div class="placeholder-item wide">
            <div class="field-label">Dam</div>
            <div class="placeholder-field"></div>
          </div>
          <!-- Row 7: Breeder(s) -->
          <div class="placeholder-item wide">
            <div class="field-label">Breeder(s)</div>
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
        grid-template-columns: repeat(2, 1fr);
      }

      .placeholder-item {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .placeholder-item.wide {
        grid-column: 1 / -1;
      }

      .field-label {
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: var(--mat-sys-on-surface-variant);
      }

      .radio-group {
        display: flex;
        gap: 16px;
      }

      .placeholder-field {
        height: 36px;
        border-radius: 6px;
        background: var(--mat-sys-surface-variant);
        opacity: 0.7;
      }
    `
  ]
})
export class DogSectionComponent {
  @Input() group!: FormGroup;
}
