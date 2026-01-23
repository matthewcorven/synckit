import { DatePipe, NgFor, NgIf } from '@angular/common';
import { Component, ElementRef, Input, OnChanges } from '@angular/core';
import { FormArray, FormControl, FormGroup } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { TrialSummaryDto } from '../../trials/trial.types';
import { GridMetadata, GridSelectionItem } from '../registration.types';

@Component({
  selector: 'app-lower-grid-section',
  standalone: true,
  imports: [MatCardModule, NgFor, NgIf, DatePipe],
  template: `
    <section class="grid-section">
      <div class="grid-section__header">Lower Grid</div>
      <mat-card class="grid-section__body form-panel">
        <table class="entry-grid" role="grid">
          <thead>
            <tr>
              <th class="row-head" rowspan="2"></th>
              <th
                class="class-head"
                rowspan="2"
                *ngFor="let col of classCols"
              >
                {{ formatColLabel(col) }}
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
            <tr *ngFor="let row of rows; let rowIndex = index" role="row">
              <th class="row-label">{{ row }}</th>
              <td
                *ngFor="let col of gridCols; let colIndex = index"
                [class.cell-disabled]="isCellDisabled(row, col)"
                role="gridcell"
              >
                <button
                  class="cell-button"
                  type="button"
                  [class.cell-selected]="isSelected(row, col)"
                  [disabled]="isCellDisabled(row, col)"
                  [attr.aria-label]="buildAriaLabel(row, col)"
                  [attr.data-row]="rowIndex"
                  [attr.data-col]="colIndex"
                  [attr.tabindex]="getTabIndex(rowIndex, colIndex, row, col)"
                  (click)="toggleCell(row, col, rowIndex, colIndex)"
                  (focus)="setActiveCell(rowIndex, colIndex)"
                  (keydown)="onCellKeydown($event, rowIndex, colIndex)"
                >
                  <span aria-hidden="true">{{ isSelected(row, col) ? 'X' : '' }}</span>
                </button>
              </td>
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

      .cell-button {
        width: 100%;
        height: 100%;
        min-height: 28px;
        border: 1px solid transparent;
        background: transparent;
        font-weight: 600;
        color: var(--mat-sys-primary);
        cursor: pointer;
      }

      .cell-button:focus-visible {
        outline: 2px solid var(--mat-sys-primary);
        outline-offset: 1px;
      }

      .cell-button:disabled {
        cursor: not-allowed;
        color: transparent;
      }

      .cell-selected {
        background: rgba(43, 108, 176, 0.12);
      }
    `
  ]
})
export class LowerGridSectionComponent implements OnChanges {
  @Input() trial?: TrialSummaryDto;
  @Input() gridMetadata?: GridMetadata | null;
  @Input() selectionsControl?: FormArray<FormGroup>;

  rows: string[] = ['Sheep', 'Cattle', 'Ducks'];
  classCols: string[] = ['NOV', 'WRK_JR_HNDLR', 'FEO', 'POST_ADV', 'RTD'];
  dateCols: string[] = ['DATE1_TRIAL1', 'DATE1_TRIAL2'];
  gridCols: string[] = [...this.classCols, ...this.dateCols];
  daySlots: number[] = [1];
  defaultDayLabels: string[] = ['Day 1'];

  dayDates: Date[] = [];
  disabledSet = new Set<string>();
  activeCell: { row: number; col: number } = { row: 0, col: 0 };

  constructor(private readonly host: ElementRef<HTMLElement>) {}

  ngOnChanges(): void {
    if (this.gridMetadata) {
      this.rows = this.gridMetadata.rows;
      this.disabledSet = new Set(
        this.gridMetadata.disabledCells.map((cell) => `${cell.row}:${cell.col}`)
      );
      const allCols = [...this.gridMetadata.cols];
      this.classCols = allCols.filter((col) => !this.isDateCol(col));
      this.dateCols = allCols.filter((col) => this.isDateCol(col));
      this.gridCols = [...this.classCols, ...this.dateCols];
    }

    this.daySlots = this.buildDaySlots();
    this.defaultDayLabels = this.daySlots.map((slot) => `Day ${slot}`);
    this.dayDates = this.buildDayDates();
    const firstFocusable = this.findFirstFocusable();
    if (firstFocusable) {
      this.activeCell = firstFocusable;
    }
  }

  isCellDisabled(row: string, col: string): boolean {
    if (this.disabledSet.size === 0) {
      return row === 'Ducks' && ['POST_ADV', 'RTD'].includes(col);
    }

    return this.disabledSet.has(`${row}:${col}`);
  }

  isSelected(row: string, col: string): boolean {
    const selections = this.getSelections();
    return selections.some(
      (selection) => selection.row === row && selection.col === col
    );
  }

  toggleCell(row: string, col: string, rowIndex: number, colIndex: number): void {
    if (this.isCellDisabled(row, col)) {
      return;
    }

    this.setActiveCell(rowIndex, colIndex);
    if (!this.selectionsControl) {
      return;
    }

    const index = this.selectionsControl.controls.findIndex((control) => {
      const value = control.value as GridSelectionItem;
      return value.row === row && value.col === col;
    });

    if (index >= 0) {
      this.selectionsControl.removeAt(index);
      return;
    }

    this.selectionsControl.push(this.createSelection(row, col));
  }

  onCellKeydown(event: KeyboardEvent, rowIndex: number, colIndex: number): void {
    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        this.moveFocus(rowIndex, colIndex, 0, 1);
        return;
      case 'ArrowLeft':
        event.preventDefault();
        this.moveFocus(rowIndex, colIndex, 0, -1);
        return;
      case 'ArrowDown':
        event.preventDefault();
        this.moveFocus(rowIndex, colIndex, 1, 0);
        return;
      case 'ArrowUp':
        event.preventDefault();
        this.moveFocus(rowIndex, colIndex, -1, 0);
        return;
      case 'Enter':
      case ' ': {
        event.preventDefault();
        const row = this.rows[rowIndex];
        const col = this.gridCols[colIndex];
        if (row && col) {
          this.toggleCell(row, col, rowIndex, colIndex);
        }
        return;
      }
      default:
        return;
    }
  }

  setActiveCell(rowIndex: number, colIndex: number): void {
    this.activeCell = { row: rowIndex, col: colIndex };
  }

  getTabIndex(
    rowIndex: number,
    colIndex: number,
    row: string,
    col: string
  ): number {
    if (this.isCellDisabled(row, col)) {
      return -1;
    }

    return this.activeCell.row === rowIndex && this.activeCell.col === colIndex
      ? 0
      : -1;
  }

  buildAriaLabel(row: string, col: string): string {
    if (this.isDateCol(col)) {
      const slot = this.parseDateCol(col);
      if (slot) {
        return `${row} day ${slot.day} trial ${slot.trial}`;
      }
    }

    return `${row} ${this.formatColLabel(col)}`;
  }

  formatColLabel(col: string): string {
    return col.replace(/_/g, ' ');
  }

  private buildDayDates(): Date[] {
    if (!this.trial?.startDate) {
      return [];
    }

    const start = this.parseDateOnly(this.trial.startDate);
    if (!start) {
      return [];
    }

    return this.daySlots.map((slot) =>
      new Date(start.getFullYear(), start.getMonth(), start.getDate() + slot - 1)
    );
  }

  private buildDaySlots(): number[] {
    const slots = this.dateCols
      .map((col) => this.parseDateCol(col)?.day ?? null)
      .filter((day): day is number => day !== null);

    if (slots.length === 0) {
      return [1];
    }

    return Array.from(new Set(slots)).sort((a, b) => a - b);
  }

  private moveFocus(
    rowIndex: number,
    colIndex: number,
    deltaRow: number,
    deltaCol: number
  ): void {
    const rowCount = this.rows.length;
    const colCount = this.gridCols.length;
    let nextRow = rowIndex + deltaRow;
    let nextCol = colIndex + deltaCol;

    while (
      nextRow >= 0 &&
      nextRow < rowCount &&
      nextCol >= 0 &&
      nextCol < colCount
    ) {
      const row = this.rows[nextRow];
      const col = this.gridCols[nextCol];
      if (row && col && !this.isCellDisabled(row, col)) {
        this.setActiveCell(nextRow, nextCol);
        this.focusCell(nextRow, nextCol);
        return;
      }

      nextRow += deltaRow;
      nextCol += deltaCol;
    }
  }

  private focusCell(rowIndex: number, colIndex: number): void {
    const selector = `[data-row="${rowIndex}"][data-col="${colIndex}"]`;
    const button = this.host.nativeElement.querySelector(selector) as
      | HTMLButtonElement
      | null;
    button?.focus();
  }

  private getSelections(): GridSelectionItem[] {
    if (!this.selectionsControl) {
      return [];
    }

    return this.selectionsControl.controls.map(
      (control) => control.value as GridSelectionItem
    );
  }

  private createSelection(row: string, col: string): FormGroup {
    return new FormGroup({
      row: new FormControl(row, { nonNullable: true }),
      col: new FormControl(col, { nonNullable: true }),
      value: new FormControl('X', { nonNullable: true })
    });
  }

  private findFirstFocusable(): { row: number; col: number } | null {
    for (let rowIndex = 0; rowIndex < this.rows.length; rowIndex += 1) {
      for (let colIndex = 0; colIndex < this.gridCols.length; colIndex += 1) {
        const row = this.rows[rowIndex];
        const col = this.gridCols[colIndex];
        if (row && col && !this.isCellDisabled(row, col)) {
          return { row: rowIndex, col: colIndex };
        }
      }
    }

    return null;
  }

  private isDateCol(col: string): boolean {
    return col.startsWith('DATE');
  }

  private parseDateCol(col: string): { day: number; trial: number } | null {
    const match = col.match(/^DATE(\d+)_TRIAL(\d+)$/);
    if (!match) {
      return null;
    }

    const day = Number(match[1]);
    const trial = Number(match[2]);
    if (Number.isNaN(day) || Number.isNaN(trial)) {
      return null;
    }

    return { day, trial };
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
