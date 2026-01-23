import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { TrialService } from '../../trials/trial.service';
import { TrialSummaryDto } from '../../trials/trial.types';
import { SecretaryEntriesService } from '../secretary-entries.service';
import { EntrySummaryDto, PdfStatus } from '../secretary.types';

@Component({
  selector: 'app-secretary-list',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatTableModule
  ],
  template: `
    <mat-card class="secretary-list-card">
      <mat-card-title>Secretary Portal</mat-card-title>
      <mat-card-subtitle>Review submitted entries by trial.</mat-card-subtitle>

      <mat-card-content>
        <div class="filters">
          <mat-form-field appearance="outline" class="trial-field">
            <mat-label>Trial</mat-label>
            <mat-select
              [value]="selectedTrialId"
              (selectionChange)="onTrialChange($event.value)"
              [disabled]="trials.length === 0"
            >
              <mat-option *ngFor="let trial of trials" [value]="trial.trialId">
                {{ trial.name }}
              </mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <ng-container *ngIf="isLoading; else listContent">
          <div class="loading-state" role="status" aria-live="polite">
            <mat-progress-spinner diameter="36" mode="indeterminate"></mat-progress-spinner>
            <span>Loading entries…</span>
          </div>
        </ng-container>

        <ng-template #listContent>
          <div class="table-wrapper" *ngIf="entries.length > 0; else emptyState">
            <table mat-table [dataSource]="entries" class="entries-table" aria-label="Submitted entries">
              <ng-container matColumnDef="handlerEmail">
                <th mat-header-cell *matHeaderCellDef>Handler Email</th>
                <td mat-cell *matCellDef="let entry">{{ entry.handlerEmail }}</td>
              </ng-container>

              <ng-container matColumnDef="dogCallName">
                <th mat-header-cell *matHeaderCellDef>Dog</th>
                <td mat-cell *matCellDef="let entry">
                  <div class="dog-name">{{ entry.dogCallName }}</div>
                  <div class="dog-sub" *ngIf="entry.dogRegisteredName">
                    {{ entry.dogRegisteredName }}
                  </div>
                </td>
              </ng-container>

              <ng-container matColumnDef="submittedAtUtc">
                <th mat-header-cell *matHeaderCellDef>Submitted</th>
                <td mat-cell *matCellDef="let entry">
                  {{ entry.submittedAtUtc ? (entry.submittedAtUtc | date: 'mediumDate') : '—' }}
                </td>
              </ng-container>

              <ng-container matColumnDef="pdfStatus">
                <th mat-header-cell *matHeaderCellDef>PDF Status</th>
                <td mat-cell *matCellDef="let entry">
                  <div class="status-chip" [ngClass]="statusClass(entry.pdfStatus)">
                    <mat-icon aria-hidden="true">{{ statusIcon(entry.pdfStatus) }}</mat-icon>
                    <span>{{ statusLabel(entry.pdfStatus) }}</span>
                  </div>
                </td>
              </ng-container>

              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef>Action</th>
                <td mat-cell *matCellDef="let entry">
                  <a mat-button color="primary" [routerLink]="['/secretary/entries', entry.entryId]">
                    View
                  </a>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns"></tr>
            </table>

            <mat-paginator
              [length]="total"
              [pageIndex]="pageIndex"
              [pageSize]="pageSize"
              [pageSizeOptions]="[10, 25, 50]"
              (page)="onPageChange($event)"
              aria-label="Entries pagination"
            ></mat-paginator>
          </div>

          <ng-template #emptyState>
            <div class="empty-state" role="status">
              No submitted entries found for this trial.
            </div>
          </ng-template>
        </ng-template>
      </mat-card-content>
    </mat-card>
  `,
  styles: [
    `
      .secretary-list-card {
        display: block;
      }

      .filters {
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
        margin: 16px 0 24px;
      }

      .trial-field {
        width: min(420px, 100%);
      }

      .loading-state {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 24px 0;
        color: #4b5563;
      }

      .table-wrapper {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .entries-table {
        width: 100%;
      }

      .dog-name {
        font-weight: 600;
      }

      .dog-sub {
        color: #6b7280;
        font-size: 12px;
      }

      .status-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 600;
        text-transform: uppercase;
      }

      .status-chip mat-icon {
        font-size: 16px;
        height: 16px;
        width: 16px;
      }

      .status-success {
        background: #dcfce7;
        color: #166534;
      }

      .status-pending {
        background: #fef9c3;
        color: #92400e;
      }

      .status-failed {
        background: #fee2e2;
        color: #991b1b;
      }

      .empty-state {
        padding: 24px 0;
        color: #6b7280;
      }
    `
  ]
})
export class SecretaryListComponent implements OnInit {
  trials: TrialSummaryDto[] = [];
  entries: EntrySummaryDto[] = [];
  selectedTrialId: string | null = null;
  isLoading = false;
  pageIndex = 0;
  pageSize = 10;
  total = 0;

  readonly displayedColumns = ['handlerEmail', 'dogCallName', 'submittedAtUtc', 'pdfStatus', 'actions'];

  constructor(
    private readonly trialService: TrialService,
    private readonly entriesService: SecretaryEntriesService
  ) {}

  ngOnInit(): void {
    this.trialService.getTrials().subscribe({
      next: (trials) => {
        this.trials = trials;
        if (!this.selectedTrialId && trials.length > 0) {
          this.selectedTrialId = trials[0].trialId;
        }
        this.loadEntries();
      },
      error: () => {
        this.trials = [];
        this.entries = [];
        this.total = 0;
      }
    });
  }

  onTrialChange(trialId: string): void {
    this.selectedTrialId = trialId;
    this.pageIndex = 0;
    this.loadEntries();
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.loadEntries();
  }

  statusIcon(status: PdfStatus): string {
    switch (status) {
      case 'Success':
        return 'check_circle';
      case 'Failed':
        return 'error';
      case 'Queued':
      case 'InProgress':
      default:
        return 'schedule';
    }
  }

  statusLabel(status: PdfStatus): string {
    switch (status) {
      case 'Success':
        return 'Success';
      case 'Failed':
        return 'Failed';
      case 'Queued':
        return 'Queued';
      case 'InProgress':
      default:
        return 'In Progress';
    }
  }

  statusClass(status: PdfStatus): string {
    switch (status) {
      case 'Success':
        return 'status-success';
      case 'Failed':
        return 'status-failed';
      case 'Queued':
      case 'InProgress':
      default:
        return 'status-pending';
    }
  }

  private loadEntries(): void {
    if (!this.selectedTrialId) {
      this.entries = [];
      this.total = 0;
      return;
    }

    this.isLoading = true;
    this.entriesService
      .getEntries({
        trialId: this.selectedTrialId,
        status: 'Submitted',
        page: this.pageIndex + 1,
        pageSize: this.pageSize
      })
      .subscribe({
        next: (response) => {
          this.entries = response.items;
          this.total = response.total;
          this.isLoading = false;
        },
        error: () => {
          this.entries = [];
          this.total = 0;
          this.isLoading = false;
        }
      });
  }
}
