import { DatePipe, NgFor, NgIf } from '@angular/common';
import { Component, Input, OnChanges } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { TrialSummaryDto } from '../../trials/trial.types';

@Component({
  selector: 'app-upper-grid-section',
  standalone: true,
  imports: [MatCardModule, NgFor, NgIf, DatePipe],
  template: `
    <section class="grid-section">
      <div class="grid-section__header">Upper Grid</div>
      <mat-card class="grid-section__body form-panel">
        <table class="entry-grid">
          <thead>
            <tr>
              <th class="row-head" rowspan="2"></th>
              <th
                class="class-head"
                rowspan="2"
                *ngFor="let col of classCols"
              >
                {{ col }}
              </th>
              <ng-container *ngIf="dayDates.length; else defaultDays">
                <th
                  class="day-head"
                  colspan="2"
                  *ngFor="let dayDate of dayDates"
                >
                  {{ dayDate | date: 'MMM d' }}
                </th>
              </ng-container>
            </tr>
            <tr>
              <ng-container *ngFor="let _ of daySlots">
                <th class="trial-head">Trial #1 (AM)</th>
                <th class="trial-head">Trial #2 (PM)</th>
              </ng-container>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let row of rows; let rowIndex = index">
              <th class="row-label">{{ row }}</th>
              <td
                *ngFor="let col of classCols"
                [class.cell-disabled]="isClassDisabled(row, col)"
              >
                <input
                  type="radio"
                  class="cell-input"
                  [attr.name]="'upper-class-' + rowIndex"
                  [attr.aria-label]="row + ' ' + col"
                  [disabled]="isClassDisabled(row, col)"
                />
              </td>
              <ng-container *ngFor="let _ of daySlots; let dayIndex = index">
                <td>
                  <input
                    type="checkbox"
                    class="cell-input"
                    [attr.aria-label]="row + ' day ' + (dayIndex + 1) + ' trial 1'"
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    class="cell-input"
                    [attr.aria-label]="row + ' day ' + (dayIndex + 1) + ' trial 2'"
                  />
                </td>
              </ng-container>
            </tr>
          </tbody>
        </table>
        <ng-template #defaultDays>
          <th class="day-head" colspan="2" *ngFor="let label of defaultDayLabels">
            {{ label }}
          </th>
        </ng-template>
      </mat-card>
    </section>
  `,
  styles: [
    `
      .grid-section {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .grid-section__header {
        font-size: 14px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        padding-bottom: 6px;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
      }

      .grid-section__body {
        padding: 12px;
      }

      .form-panel {
        border: 1px solid var(--mat-sys-outline-variant);
        box-shadow: none;
      }

      .entry-grid {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
      }

      .entry-grid th,
      .entry-grid td {
        border: 1px solid var(--mat-sys-outline-variant);
        padding: 6px;
        text-align: center;
        background: var(--mat-sys-surface);
      }

      .row-head {
        width: 72px;
        background: var(--mat-sys-surface-variant);
      }

      .row-label {
        text-align: left;
        padding-left: 8px;
        font-weight: 600;
        background: var(--mat-sys-surface-variant);
      }

      .class-head {
        font-weight: 600;
        text-transform: uppercase;
        font-size: 11px;
        letter-spacing: 0.03em;
        background: var(--mat-sys-surface-variant);
      }

      .day-head {
        font-weight: 600;
        text-transform: uppercase;
        font-size: 11px;
        background: var(--mat-sys-surface-variant);
      }

      .trial-head {
        font-weight: 500;
        font-size: 11px;
        background: var(--mat-sys-surface-variant);
      }

      .cell-disabled {
        background: rgba(0, 0, 0, 0.08);
      }

      .cell-input {
        width: 14px;
        height: 14px;
        accent-color: #2b6cb0;
      }
    `
  ]
})
export class UpperGridSectionComponent implements OnChanges {
  @Input() trial?: TrialSummaryDto;

  readonly rows = ['Sheep', 'Cattle', 'Ducks', 'Mixed'];
  readonly classCols = ['STD', 'OPN', 'ADV', 'FTD OPN', 'FTD ADV'];
  readonly daySlots = [0, 1, 2];
  readonly defaultDayLabels = ['Day 1', 'Day 2', 'Day 3'];

  dayDates: Date[] = [];

  ngOnChanges(): void {
    this.dayDates = this.buildDayDates();
  }

  isClassDisabled(row: string, col: string): boolean {
    if (row !== 'Mixed') {
      return false;
    }

    return col === 'STD' || col === 'OPN' || col === 'ADV';
  }

  private buildDayDates(): Date[] {
    if (!this.trial?.startDate) {
      return [];
    }

    const start = this.parseDateOnly(this.trial.startDate);
    if (!start) {
      return [];
    }

    return this.daySlots.map((offset) =>
      new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset)
    );
  }

  private parseDateOnly(value: string): Date | null {
    const parts = value.split('-').map((part) => Number(part));
    if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
      return null;
    }

    const [year, month, day] = parts;
    return new Date(year, month - 1, day);
  }
}
