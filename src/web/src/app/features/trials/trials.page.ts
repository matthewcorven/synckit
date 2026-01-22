import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { TrialListComponent } from './trial-list/trial-list.component';

@Component({
  selector: 'app-trials-page',
  standalone: true,
  imports: [MatCardModule, TrialListComponent],
  template: `
    <mat-card class="trials-page">
      <mat-card-title>Trials</mat-card-title>
      <mat-card-subtitle>Select an active trial to begin registration.</mat-card-subtitle>
      <mat-card-content>
        <app-trial-list></app-trial-list>
      </mat-card-content>
    </mat-card>
  `
})
export class TrialsPageComponent {}
