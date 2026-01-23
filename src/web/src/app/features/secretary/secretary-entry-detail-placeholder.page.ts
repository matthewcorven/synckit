import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-secretary-entry-detail-placeholder',
  standalone: true,
  imports: [MatCardModule, MatButtonModule, RouterLink],
  template: `
    <mat-card class="secretary-detail-card">
      <mat-card-title>Entry Detail</mat-card-title>
      <mat-card-content>
        Entry detail view is coming in WI-A13.
      </mat-card-content>
      <mat-card-actions>
        <a mat-button color="primary" routerLink="/secretary">Back to list</a>
      </mat-card-actions>
    </mat-card>
  `,
  styles: [
    `
      .secretary-detail-card {
        display: block;
      }
    `
  ]
})
export class SecretaryEntryDetailPlaceholderPage {}
