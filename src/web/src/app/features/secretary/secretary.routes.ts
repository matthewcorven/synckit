import { Routes } from '@angular/router';
import { secretaryRoleGuard } from '../../core/guards/secretary-role.guard';
import { SecretaryDetailComponent } from './secretary-detail/secretary-detail.component';
import { SecretaryPageComponent } from './secretary.page';

export const SECRETARY_ROUTES: Routes = [
  {
    path: '',
    component: SecretaryPageComponent,
    canActivate: [secretaryRoleGuard]
  },
  {
    path: 'entries/:entryId',
    component: SecretaryDetailComponent,
    canActivate: [secretaryRoleGuard]
  }
];
