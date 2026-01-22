import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-registration-page',
  standalone: true,
  imports: [MatCardModule],
  template: `
    <mat-card>
      <mat-card-title>Registration</mat-card-title>
      <mat-card-content>
        Registration form layout will appear here.
      </mat-card-content>
    </mat-card>
  `
})
export class RegistrationPageComponent {}
