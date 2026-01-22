import { Component } from '@angular/core';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { HeaderComponent } from './header.component';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [
    HeaderComponent,
    MatSidenavModule,
    MatListModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet
  ],
  template: `
    <app-header></app-header>
    <mat-sidenav-container class="layout-container">
      <mat-sidenav class="layout-sidenav" mode="side" opened>
        <mat-nav-list aria-label="Primary navigation">
          <a mat-list-item routerLink="/trials" routerLinkActive="active">Trials</a>
          <a mat-list-item routerLink="/secretary" routerLinkActive="active">Secretary</a>
        </mat-nav-list>
      </mat-sidenav>
      <mat-sidenav-content class="layout-content">
        <router-outlet></router-outlet>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [
    `
      .layout-container {
        height: calc(100vh - 64px);
      }

      .layout-sidenav {
        width: 220px;
        border-right: 1px solid var(--mat-sys-outline-variant);
      }

      .layout-content {
        padding: 24px;
        display: block;
      }

      a.active {
        font-weight: 600;
      }

      @media (max-width: 900px) {
        .layout-container {
          height: auto;
        }

        .layout-sidenav {
          width: 100%;
        }
      }
    `
  ]
})
export class LayoutComponent {}
