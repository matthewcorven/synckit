import { Routes } from '@angular/router';
import { secretaryRoleGuard } from '../../core/guards/secretary-role.guard';
import { SecretaryEntryDetailPlaceholderPage } from './secretary-entry-detail-placeholder.page';
import { SecretaryPageComponent } from './secretary.page';

export const SECRETARY_ROUTES: Routes = [
  {
    path: '',
    component: SecretaryPageComponent,
    canActivate: [secretaryRoleGuard]
  },
  {
    path: 'entries/:entryId',
    component: SecretaryEntryDetailPlaceholderPage,
    canActivate: [secretaryRoleGuard]
  }
];
