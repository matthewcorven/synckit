import { Injectable } from '@angular/core';

export type UserRole = 'Handler' | 'Secretary';

@Injectable({
  providedIn: 'root'
})
export class AuthRoleService {
  private readonly storageKey = 'dog-trials.role';

  getRole(): UserRole | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }

    const value = localStorage.getItem(this.storageKey);
    if (value === 'Handler' || value === 'Secretary') {
      return value;
    }

    return null;
  }

  setRole(role: UserRole): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem(this.storageKey, role);
  }

  clearRole(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.removeItem(this.storageKey);
  }
}
