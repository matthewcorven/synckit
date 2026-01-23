import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TrialSummaryDto } from './trial.types';
import { MockDataService } from '../../shared/mocks/mock-data.service';

@Injectable({
  providedIn: 'root'
})
export class TrialService {
  private readonly baseUrl = environment.apiBaseUrl ?? '/api';

  constructor(
    private readonly http: HttpClient,
    private readonly mockDataService: MockDataService
  ) {}

  getTrials(): Observable<TrialSummaryDto[]> {
    const request$ = this.mockDataService.isEnabled
      ? this.mockDataService.getTrials()
      : this.http.get<TrialSummaryDto[]>(`${this.baseUrl}/trials`);

    return request$.pipe(map((trials) => trials.filter((trial) => trial.isActive)));
  }

  getTrial(trialId: string): Observable<TrialSummaryDto> {
    if (this.mockDataService.isEnabled) {
      return this.mockDataService.getTrials().pipe(
        map((trials) => {
          const match = trials.find((trial) => trial.trialId === trialId);
          if (!match) {
            throw new Error('Trial not found');
          }
          return match;
        })
      );
    }

    return this.http.get<TrialSummaryDto>(`${this.baseUrl}/trials/${trialId}`);
  }
}
