import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, RouterStateSnapshot, UrlTree } from '@angular/router';
import { secretaryRoleGuard } from './secretary-role.guard';
import { AuthRoleService } from '../services/auth-role.service';

describe('secretaryRoleGuard', () => {
  beforeEach(() => {
    localStorage.removeItem('dog-trials.role');
  });

  it('blocks access when role is missing', () => {
    const injector = TestBed.configureTestingModule({
      providers: [provideRouter([])]
    });

    const result = injector.runInInjectionContext(() =>
      secretaryRoleGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
    );

    expect(result instanceof UrlTree).toBeTruthy();
  });

  it('allows access for Secretary role', () => {
    const injector = TestBed.configureTestingModule({
      providers: [provideRouter([])]
    });

    injector.inject(AuthRoleService).setRole('Secretary');

    const result = injector.runInInjectionContext(() =>
      secretaryRoleGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
    );

    expect(result).toBe(true);
  });
});
