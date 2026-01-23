import { Injectable } from '@angular/core';
import { SubmissionReceipt } from './registration.types';

const KEY_PREFIX = 'registration-submission:';

@Injectable({
  providedIn: 'root'
})
export class RegistrationSubmissionStore {
  save(trialId: string, receipt: SubmissionReceipt): void {
    sessionStorage.setItem(`${KEY_PREFIX}${trialId}`, JSON.stringify(receipt));
  }

  get(trialId: string): SubmissionReceipt | null {
    const raw = sessionStorage.getItem(`${KEY_PREFIX}${trialId}`);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as SubmissionReceipt;
    } catch {
      return null;
    }
  }

  clear(trialId: string): void {
    sessionStorage.removeItem(`${KEY_PREFIX}${trialId}`);
  }
}
