import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TrialSummaryDto } from './trial.types';
import { TRIALS_MOCK_DATA } from './trials.mock';

@Injectable({
  providedIn: 'root'
})
export class TrialService {
  private readonly baseUrl = environment.apiBaseUrl ?? '/api';

  constructor(private readonly http: HttpClient) {}

  getTrials(): Observable<TrialSummaryDto[]> {
    const request$ = environment.useMocks
      ? of(TRIALS_MOCK_DATA)
      : this.http.get<TrialSummaryDto[]>(`${this.baseUrl}/trials`);

    return request$.pipe(map((trials) => trials.filter((trial) => trial.isActive)));
  }

  getTrial(trialId: string): Observable<TrialSummaryDto> {
    if (environment.useMocks) {
      const match = TRIALS_MOCK_DATA.find((trial) => trial.trialId === trialId);
      if (!match) {
        throw new Error('Trial not found');
      }
      return of(match);
    }

    return this.http.get<TrialSummaryDto>(`${this.baseUrl}/trials/${trialId}`);
  }
}
