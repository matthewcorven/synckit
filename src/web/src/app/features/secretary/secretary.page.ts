import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-secretary-page',
  standalone: true,
  imports: [MatCardModule],
  template: `
    <mat-card>
      <mat-card-title>Secretary Portal</mat-card-title>
      <mat-card-content>
        Secretary views will appear here.
      </mat-card-content>
    </mat-card>
  `
})
export class SecretaryPageComponent {}
