import { Component } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [MatToolbarModule, MatButtonModule],
  template: `
    <mat-toolbar color="primary" class="app-toolbar">
      <div class="app-title">Dog Trials</div>
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
