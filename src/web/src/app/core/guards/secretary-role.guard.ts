import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthRoleService } from '../services/auth-role.service';

export const secretaryRoleGuard: CanActivateFn = () => {
  const roleService = inject(AuthRoleService);
  const router = inject(Router);

  if (roleService.getRole() === 'Secretary') {
    return true;
  }

  return router.parseUrl('/trials');
};
