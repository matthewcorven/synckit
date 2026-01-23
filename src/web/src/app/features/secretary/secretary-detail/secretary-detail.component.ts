import { CommonModule, DatePipe, NgFor, NgIf } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { EntryDetailDto, NotificationDto, PdfStatus } from '../secretary.types';
import { SecretaryEntriesService } from '../secretary-entries.service';

@Component({
  selector: 'app-secretary-detail',
  standalone: true,
  imports: [
    CommonModule,
    NgIf,
    NgFor,
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  template: `
    <section class="detail-page">
      <a class="back-link" mat-button color="primary" routerLink="/secretary">
        <mat-icon aria-hidden="true">arrow_back</mat-icon>
        Back to list
      </a>

      <ng-container *ngIf="isLoading; else detailContent">
        <div class="loading-state" role="status" aria-live="polite">
          <mat-progress-spinner diameter="36" mode="indeterminate"></mat-progress-spinner>
          <span>Loading entry…</span>
        </div>
      </ng-container>

      <ng-template #detailContent>
        <ng-container *ngIf="entry; else emptyState">
          <mat-card class="detail-card">
            <mat-card-title>Entry Detail</mat-card-title>
            <mat-card-content>
              <div class="detail-grid">
                <div>
                  <div class="label">Entry ID</div>
                  <div class="value mono">{{ entry.entryId }}</div>
                </div>
                <div>
                  <div class="label">Entry #</div>
                  <div class="value">{{ entry.entryNumber || '—' }}</div>
                </div>
                <div>
                  <div class="label">Submitted</div>
                  <div class="value">
                    {{ entry.submittedAtUtc ? (entry.submittedAtUtc | date: 'medium') : '—' }}
                  </div>
                </div>
                <div>
                  <div class="label">Trial</div>
                  <div class="value">{{ entry.trial.name }}</div>
                </div>
              </div>
            </mat-card-content>
          </mat-card>

          <div class="detail-sections">
            <mat-card class="detail-card">
              <mat-card-title>Dog Information</mat-card-title>
              <mat-card-content>
                <div class="two-col">
                  <div>
                    <div class="label">Call Name</div>
                    <div class="value">{{ entry.dog.callName || '—' }}</div>
                  </div>
                  <div>
                    <div class="label">Registered Name</div>
                    <div class="value">{{ entry.dog.registeredName || '—' }}</div>
                  </div>
                  <div>
                    <div class="label">ASCA Reg #</div>
                    <div class="value">{{ entry.dog.ascaRegistrationNumber || '—' }}</div>
                  </div>
                  <div>
                    <div class="label">Breed</div>
                    <div class="value">{{ entry.dog.breed || '—' }}</div>
                  </div>
                  <div>
                    <div class="label">DOB</div>
                    <div class="value">{{ entry.dog.dob || '—' }}</div>
                  </div>
                  <div>
                    <div class="label">Sex</div>
                    <div class="value">{{ entry.dog.sex || '—' }}</div>
                  </div>
                  <div>
                    <div class="label">Color</div>
                    <div class="value">{{ entry.dog.color || '—' }}</div>
                  </div>
                  <div>
                    <div class="label">Sire</div>
                    <div class="value">{{ entry.dog.sire || '—' }}</div>
                  </div>
                  <div>
                    <div class="label">Dam</div>
                    <div class="value">{{ entry.dog.dam || '—' }}</div>
                  </div>
                  <div>
                    <div class="label">Breeders</div>
                    <div class="value">{{ entry.dog.breeders || '—' }}</div>
                  </div>
                </div>
              </mat-card-content>
            </mat-card>

            <mat-card class="detail-card">
              <mat-card-title>Contact / Emergency / Fees</mat-card-title>
              <mat-card-content>
                <div class="two-col">
                  <div>
                    <div class="label">Owners</div>
                    <div class="value">{{ entry.contact.owners || '—' }}</div>
                  </div>
                  <div>
                    <div class="label">Email</div>
                    <div class="value">{{ entry.contact.email || '—' }}</div>
                  </div>
                  <div>
                    <div class="label">Phone</div>
                    <div class="value">{{ entry.contact.phone || '—' }}</div>
                  </div>
                  <div>
                    <div class="label">Handler</div>
                    <div class="value">{{ entry.contact.handler || '—' }}</div>
                  </div>
                  <div>
                    <div class="label">Membership #</div>
                    <div class="value">{{ entry.contact.membershipNumber || '—' }}</div>
                  </div>
                  <div>
                    <div class="label">Owner Address</div>
                    <div class="value">
                      {{ formatAddress(entry.contact.ownerAddress) || '—' }}
                    </div>
                  </div>
                  <div>
                    <div class="label">Junior</div>
                    <div class="value">
                      {{ entry.contact.junior?.memberId || '—' }}
                      <span *ngIf="entry.contact.junior?.dob">
                        ({{ entry.contact.junior?.dob }})
                      </span>
                    </div>
                  </div>
                  <div>
                    <div class="label">Emergency Contact</div>
                    <div class="value">
                      {{ entry.emergencyContact.name || '—' }}
                      <span *ngIf="entry.emergencyContact.phoneOrNumber">
                        ({{ entry.emergencyContact.phoneOrNumber }})
                      </span>
                    </div>
                  </div>
                  <div>
                    <div class="label">Total Fees</div>
                    <div class="value">
                      {{ entry.fees.totalEntryFees ?? '—' }}
                      <span *ngIf="entry.fees.currency">{{ entry.fees.currency }}</span>
                    </div>
                  </div>
                </div>
              </mat-card-content>
            </mat-card>

            <mat-card class="detail-card">
              <mat-card-title>Class Selections</mat-card-title>
              <mat-card-content>
                <div class="grid-wrapper">
                  <div class="grid-title">Upper</div>
                  <table class="selection-grid" aria-label="Upper grid selections">
                    <thead>
                      <tr>
                        <th></th>
                        <th *ngFor="let col of upperCols">{{ formatCol(col) }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr *ngFor="let row of upperRows">
                        <th>{{ row }}</th>
                        <td *ngFor="let col of upperCols">
                          {{ hasSelection(entry.selections.upper, row, col) ? 'X' : '' }}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <div class="grid-title">Lower</div>
                  <table class="selection-grid" aria-label="Lower grid selections">
                    <thead>
                      <tr>
                        <th></th>
                        <th *ngFor="let col of lowerCols">{{ formatCol(col) }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr *ngFor="let row of lowerRows">
                        <th>{{ row }}</th>
                        <td *ngFor="let col of lowerCols">
                          {{ hasSelection(entry.selections.lower, row, col) ? 'X' : '' }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </mat-card-content>
            </mat-card>
          </div>

          <mat-card class="detail-card">
            <mat-card-title>Processing Status</mat-card-title>
            <mat-card-content>
              <div class="status-row">
                <div class="status-chip" [ngClass]="statusClass(entry.processing.pdfStatus)">
                  <mat-icon aria-hidden="true">{{ statusIcon(entry.processing.pdfStatus) }}</mat-icon>
                  <span>PDF {{ statusLabel(entry.processing.pdfStatus) }}</span>
                </div>
                <button
                  mat-raised-button
                  color="primary"
                  [disabled]="entry.processing.pdfStatus !== 'Success' || isDownloading"
                  (click)="downloadPdf()"
                >
                  <mat-icon aria-hidden="true">download</mat-icon>
                  Download PDF
                </button>
                <button
                  mat-stroked-button
                  color="warn"
                  *ngIf="entry.processing.pdfStatus === 'Failed'"
                  (click)="retryPdf()"
                >
                  Retry PDF
                </button>
              </div>

              <div class="status-error" *ngIf="entry.processing.lastError">
                {{ entry.processing.lastError.message }}
              </div>

              <div class="notification-block">
                <div class="label">Email Notifications</div>
                <div class="notification" *ngFor="let notification of entry.processing.emailNotifications">
                  <span class="notification-title">
                    {{ notification.recipientType }}
                  </span>
                  <span class="notification-status" [ngClass]="notificationClass(notification)">
                    {{ notification.status }}
                  </span>
                  <span class="notification-time" *ngIf="notification.sentAtUtc">
                    {{ notification.sentAtUtc | date: 'short' }}
                  </span>
                </div>
              </div>
            </mat-card-content>
          </mat-card>
        </ng-container>
      </ng-template>

      <ng-template #emptyState>
        <div class="empty-state" role="status">Entry not found.</div>
      </ng-template>
    </section>
  `,
  styles: [
    `
      .detail-page {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .back-link {
        align-self: flex-start;
        display: inline-flex;
        gap: 6px;
      }

      .loading-state {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 24px 0;
        color: #4b5563;
      }

      .detail-card {
        border: 1px solid var(--mat-sys-outline-variant);
        box-shadow: none;
      }

      .detail-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 16px;
      }

      .detail-sections {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .two-col {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 16px;
      }

      .label {
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #6b7280;
      }

      .value {
        font-size: 14px;
        font-weight: 600;
      }

      .mono {
        font-family: 'SFMono-Regular', Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
          monospace;
        font-size: 12px;
      }

      .grid-wrapper {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .grid-title {
        font-weight: 600;
        color: #111827;
      }

      .selection-grid {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
      }

      .selection-grid th,
      .selection-grid td {
        border: 1px solid var(--mat-sys-outline-variant);
        padding: 6px;
        text-align: center;
      }

      .selection-grid th {
        background: var(--mat-sys-surface-variant);
        font-weight: 600;
      }

      .status-row {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 12px;
        margin-bottom: 8px;
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

      .status-error {
        color: #991b1b;
        margin: 8px 0 12px;
      }

      .notification-block {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .notification {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .notification-title {
        min-width: 90px;
        font-weight: 600;
      }

      .notification-status {
        font-weight: 600;
      }

      .notification-status.success {
        color: #166534;
      }

      .notification-status.failed {
        color: #991b1b;
      }

      .notification-status.pending {
        color: #92400e;
      }

      .notification-time {
        color: #6b7280;
        font-size: 12px;
      }

      .empty-state {
        padding: 24px 0;
        color: #6b7280;
      }
    `
  ]
})
export class SecretaryDetailComponent implements OnInit {
  entry: EntryDetailDto | null = null;
  isLoading = false;
  isDownloading = false;

  readonly upperRows = ['Sheep', 'Cattle', 'Ducks', 'Mixed'];
  readonly upperCols = ['STD', 'OPN', 'ADV', 'FTD_OPN', 'FTD_ADV', 'DATE1_TRIAL1', 'DATE1_TRIAL2'];
  readonly lowerRows = ['Sheep', 'Cattle', 'Ducks'];
  readonly lowerCols = ['NOV', 'WRK_JR_HNDLR', 'FEO', 'POST_ADV', 'RTD', 'DATE1_TRIAL1', 'DATE1_TRIAL2'];

  constructor(
    private readonly route: ActivatedRoute,
    private readonly entriesService: SecretaryEntriesService
  ) {}

  ngOnInit(): void {
    const entryId = this.route.snapshot.paramMap.get('entryId');
    if (!entryId) {
      return;
    }

    this.isLoading = true;
    this.entriesService.getEntryDetail(entryId).subscribe({
      next: (detail) => {
        this.entry = detail;
        this.isLoading = false;
      },
      error: () => {
        this.entry = null;
        this.isLoading = false;
      }
    });
  }

  downloadPdf(): void {
    if (!this.entry) {
      return;
    }

    this.isDownloading = true;
    this.entriesService.getPdfDownloadUrl(this.entry.entryId).subscribe({
      next: (response) => {
        this.isDownloading = false;
        const link = document.createElement('a');
        link.href = response.downloadUrl;
        link.download = `${this.entry?.entryId ?? 'entry'}.pdf`;
        link.rel = 'noopener';
        link.click();
      },
      error: () => {
        this.isDownloading = false;
      }
    });
  }

  retryPdf(): void {
    if (!this.entry) {
      return;
    }

    this.entriesService.retryPdf(this.entry.entryId).subscribe({
      next: () => {
        if (this.entry) {
          this.entry.processing.pdfStatus = 'Queued';
        }
      }
    });
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
        return 'Generated';
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

  notificationClass(notification: NotificationDto): string {
    switch (notification.status) {
      case 'Success':
        return 'success';
      case 'Failed':
        return 'failed';
      case 'Queued':
      case 'InProgress':
      default:
        return 'pending';
    }
  }

  formatAddress(address?: {
    street?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
  } | null): string | null {
    if (!address) {
      return null;
    }

    const parts = [address.street, address.city, address.state, address.zip].filter(
      (part) => !!part
    );
    return parts.join(', ');
  }

  hasSelection(selections: { row: string; col: string }[], row: string, col: string): boolean {
    return selections.some((selection) => selection.row === row && selection.col === col);
  }

  formatCol(col: string): string {
    return col.replace(/_/g, ' ');
  }
}
