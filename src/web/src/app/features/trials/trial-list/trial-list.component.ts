import { Component, OnInit } from '@angular/core';
import { NgFor, NgIf } from '@angular/common';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { TrialService } from '../trial.service';
import { TrialSummaryDto } from '../trial.types';
import { TrialCardComponent } from '../trial-card/trial-card.component';

@Component({
  selector: 'app-trial-list',
  standalone: true,
  imports: [NgFor, NgIf, MatProgressSpinnerModule, TrialCardComponent],
  template: `
    <section class="trial-list">
      <div class="trial-list__status" *ngIf="isLoading">
        <mat-progress-spinner diameter="36" mode="indeterminate"></mat-progress-spinner>
        <span>Loading trials…</span>
      </div>

      <div class="trial-list__status" *ngIf="errorMessage">
        <p>{{ errorMessage }}</p>
      </div>

      <div class="trial-list__grid" *ngIf="!isLoading && !errorMessage">
        <app-trial-card
          *ngFor="let trial of trials"
          [trial]="trial"
          (select)="onSelectTrial($event)"
        ></app-trial-card>
      </div>
    </section>
  `,
  styles: [
    `
      .trial-list {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .trial-list__status {
        display: flex;
        align-items: center;
        gap: 12px;
        color: var(--mat-sys-on-surface-variant);
      }

      .trial-list__grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: 16px;
      }
    `
  ]
})
export class TrialListComponent implements OnInit {
  trials: TrialSummaryDto[] = [];
  isLoading = true;
  errorMessage = '';

  constructor(
    private readonly trialService: TrialService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.trialService.getTrials().subscribe({
      next: (trials) => {
        this.trials = trials;
        this.isLoading = false;
      },
      error: () => {
        this.errorMessage = 'Unable to load trials. Please try again later.';
        this.isLoading = false;
      }
    });
  }

  onSelectTrial(trial: TrialSummaryDto): void {
    this.router.navigate(['/register', trial.trialId]);
  }
}
