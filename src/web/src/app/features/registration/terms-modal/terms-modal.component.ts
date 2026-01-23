import { Component, Inject, SecurityContext } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { TermsDto } from '../registration.types';

@Component({
  selector: 'app-terms-modal',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="terms-modal">
      <header class="terms-modal__header">
        <h2 class="terms-modal__title">Terms and Conditions</h2>
        <button
          mat-icon-button
          type="button"
          aria-label="Close terms dialog"
          (click)="close(false)"
        >
          <mat-icon>close</mat-icon>
        </button>
      </header>

      <mat-dialog-content class="terms-modal__body">
        <div class="terms-modal__content" [innerHTML]="safeHtml"></div>
      </mat-dialog-content>

      <mat-dialog-actions align="end" class="terms-modal__actions">
        <div class="terms-modal__version">Version: {{ data.version }}</div>
        <span class="terms-modal__spacer"></span>
        <button mat-stroked-button type="button" (click)="close(false)">Decline</button>
        <button mat-flat-button color="primary" type="button" (click)="close(true)">
          Accept
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [
    `
      .terms-modal {
        display: flex;
        flex-direction: column;
        gap: 12px;
        min-width: min(720px, 90vw);
      }

      .terms-modal__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }

      .terms-modal__title {
        margin: 0;
        font-size: 20px;
        font-weight: 600;
      }

      .terms-modal__body {
        max-height: 60vh;
        overflow: auto;
        padding: 0 4px 0 0;
      }

      .terms-modal__content :where(h1, h2, h3) {
        margin: 16px 0 8px;
      }

      .terms-modal__content p {
        margin: 0 0 12px;
        color: var(--mat-sys-on-surface-variant);
      }

      .terms-modal__actions {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .terms-modal__version {
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--mat-sys-on-surface-variant);
      }

      .terms-modal__spacer {
        flex: 1;
      }
    `
  ]
})
export class TermsModalComponent {
  readonly safeHtml: SafeHtml;

  constructor(
    private readonly dialogRef: MatDialogRef<TermsModalComponent>,
    @Inject(MAT_DIALOG_DATA) public readonly data: TermsDto,
    sanitizer: DomSanitizer
  ) {
    this.safeHtml = sanitizer.sanitize(SecurityContext.HTML, data.html) ?? '';
  }

  close(accepted: boolean): void {
    this.dialogRef.close(accepted);
  }
}
