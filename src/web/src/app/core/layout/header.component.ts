import { Component } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [MatToolbarModule, MatButtonModule, RouterLink],
  template: `
    <mat-toolbar color="primary" class="app-toolbar">
      <div class="app-title">Dog Trials</div>
      <span class="app-spacer"></span>
      <a mat-button routerLink="/trials">Trials</a>
      <a mat-button routerLink="/secretary">Secretary</a>
    </mat-toolbar>
  `,
  styles: [
    `
      .app-toolbar {
        position: sticky;
        top: 0;
        z-index: 10;
      }

      .app-title {
        font-weight: 600;
        letter-spacing: 0.2px;
      }

      .app-spacer {
        flex: 1 1 auto;
      }
    `
  ]
})
export class HeaderComponent {}
