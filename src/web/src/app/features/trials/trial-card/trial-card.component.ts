import { Component, EventEmitter, Input, Output } from '@angular/core';
import { DatePipe, NgIf } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { TrialSummaryDto } from '../trial.types';

@Component({
  selector: 'app-trial-card',
  standalone: true,
  imports: [DatePipe, NgIf, MatButtonModule, MatCardModule],
  template: `
    <mat-card class="trial-card">
      <div class="trial-card__header">
        <div>
          <mat-card-title>{{ trial.name }}</mat-card-title>
          <mat-card-subtitle>{{ trial.hostClub }}</mat-card-subtitle>
        </div>
        <span class="trial-card__dates">
          {{ trial.startDate | date: 'MMM d, y' }}
          <ng-container *ngIf="trial.endDate !== trial.startDate">
            – {{ trial.endDate | date: 'MMM d, y' }}
          </ng-container>
        </span>
      </div>
      <mat-card-content>
        <p class="trial-card__location" *ngIf="trial.location">
          {{ trial.location }}
        </p>
      </mat-card-content>
      <mat-card-actions>
        <button
          mat-flat-button
          color="primary"
          type="button"
          (click)="select.emit(trial)"
        >
          Select trial
        </button>
      </mat-card-actions>
    </mat-card>
  `,
  styles: [
    `
      .trial-card {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .trial-card__header {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        align-items: flex-start;
        gap: 12px;
      }

      .trial-card__dates {
        font-weight: 600;
        color: var(--mat-sys-on-surface-variant);
      }

      .trial-card__location {
        margin: 0;
        color: var(--mat-sys-on-surface-variant);
      }
    `
  ]
})
export class TrialCardComponent {
  @Input({ required: true }) trial!: TrialSummaryDto;
  @Output() readonly select = new EventEmitter<TrialSummaryDto>();
}
