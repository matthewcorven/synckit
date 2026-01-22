import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TrialSummaryDto } from './trial.types';

@Injectable({
  providedIn: 'root'
})
export class TrialService {
  private readonly baseUrl = environment.apiBaseUrl ?? '/api';

  constructor(private readonly http: HttpClient) {}

  getTrials(): Observable<TrialSummaryDto[]> {
    const request$ = environment.useMocks
      ? this.http.get<TrialSummaryDto[]>('/mocks/trials.mock.json')
      : this.http.get<TrialSummaryDto[]>(`${this.baseUrl}/trials`);

    return request$.pipe(map((trials) => trials.filter((trial) => trial.isActive)));
  }
}
