import { Component } from '@angular/core';
import { NgIf, DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { RegistrationSubmissionStore } from './registration-submission.store';
import { SubmissionReceipt } from './registration.types';

@Component({
  selector: 'app-registration-confirmation-page',
  standalone: true,
  imports: [NgIf, DatePipe, MatCardModule, MatButtonModule],
  template: `
    <section class="confirmation-page">
      <mat-card class="confirmation-card" *ngIf="receipt; else missing">
        <div class="confirmation-header">
          <div class="confirmation-icon" aria-hidden="true">✓</div>
          <div>
            <div class="confirmation-eyebrow">Entry Submitted</div>
            <h2>Your entry has been received.</h2>
            <p>PDF and email confirmations are being prepared.</p>
          </div>
        </div>

        <div class="support-block">
          <div class="support-label">Support ID</div>
          <div class="support-value" data-testid="support-id">
            {{ receipt.supportId || 'Unavailable' }}
          </div>
          <div class="support-actions">
            <button
              mat-stroked-button
              type="button"
              (click)="copySupportId()"
              [disabled]="!receipt.supportId"
            >
              Copy Support ID
            </button>
          </div>
        </div>

        <div class="confirmation-actions">
          <button mat-stroked-button type="button" (click)="viewEntry()">
            View Entry
          </button>
          <button mat-flat-button color="primary" type="button" (click)="backToTrials()">
            Back to Trials
          </button>
        </div>
      </mat-card>

      <ng-template #missing>
        <mat-card class="confirmation-card">
          <div class="confirmation-header">
            <div>
              <div class="confirmation-eyebrow">Submission Details</div>
              <h2>We couldn’t find this submission.</h2>
              <p>Please return to trials and select your entry.</p>
            </div>
          </div>
          <div class="confirmation-actions">
            <button mat-flat-button color="primary" type="button" (click)="backToTrials()">
              Back to Trials
            </button>
          </div>
        </mat-card>
      </ng-template>
    </section>
  `,
  styles: [
    `
      .confirmation-page {
        display: flex;
        justify-content: center;
        padding: 24px 12px;
      }

      .confirmation-card {
        max-width: 760px;
        width: 100%;
        padding: 20px;
        border: 1px solid var(--mat-sys-outline-variant);
        box-shadow: none;
      }

      .confirmation-header {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 16px;
        align-items: center;
      }

      .confirmation-icon {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: rgba(46, 125, 50, 0.12);
        color: #2e7d32;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        font-weight: 700;
      }

      .confirmation-eyebrow {
        text-transform: uppercase;
        font-size: 12px;
        letter-spacing: 0.08em;
        color: var(--mat-sys-on-surface-variant);
      }

      .support-block {
        margin-top: 20px;
        padding: 16px;
        border-radius: 10px;
        border: 1px solid var(--mat-sys-outline-variant);
        background: var(--mat-sys-surface-variant);
        display: grid;
        gap: 8px;
      }

      .support-label {
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: var(--mat-sys-on-surface-variant);
      }

      .support-value {
        font-family: 'SF Mono', 'Roboto Mono', monospace;
        font-size: 15px;
        font-weight: 600;
      }

      .support-actions {
        display: flex;
        justify-content: flex-end;
      }

      .confirmation-actions {
        display: flex;
        flex-wrap: wrap;
        justify-content: flex-end;
        gap: 12px;
        margin-top: 20px;
      }

      @media (max-width: 600px) {
        .confirmation-header {
          grid-template-columns: 1fr;
        }

        .confirmation-actions,
        .support-actions {
          justify-content: stretch;
        }
      }
    `
  ]
})
export class RegistrationConfirmationPageComponent {
  receipt: SubmissionReceipt | null;

  private readonly trialId: string | null;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly submissionStore: RegistrationSubmissionStore
  ) {
    this.trialId = this.route.snapshot.paramMap.get('trialId');
    this.receipt = this.trialId ? this.submissionStore.get(this.trialId) : null;
  }

  copySupportId(): void {
    if (!this.receipt?.supportId) {
      return;
    }

    void navigator.clipboard?.writeText(this.receipt.supportId);
  }

  viewEntry(): void {
    if (!this.trialId || !this.receipt) {
      return;
    }

    this.router.navigate(['/register', this.trialId], {
      queryParams: { entryId: this.receipt.entryId }
    });
  }

  backToTrials(): void {
    this.router.navigate(['/trials']);
  }
}
