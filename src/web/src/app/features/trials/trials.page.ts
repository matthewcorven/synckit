import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-trials-page',
  standalone: true,
  imports: [MatCardModule],
  template: `
    <mat-card>
      <mat-card-title>Trials</mat-card-title>
      <mat-card-content>
        Trial selection UI will appear here.
      </mat-card-content>
    </mat-card>
  `
})
export class TrialsPageComponent {}
