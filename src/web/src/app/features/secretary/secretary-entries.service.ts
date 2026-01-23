import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PaginatedEntrySummaryResponse } from './secretary.types';
import { SECRETARY_ENTRY_SUMMARY_MOCK_DATA } from './secretary.mock';

@Injectable({
  providedIn: 'root'
})
export class SecretaryEntriesService {
  private readonly baseUrl = environment.apiBaseUrl ?? '/api';

  constructor(private readonly http: HttpClient) {}

  getEntries(options: {
    trialId?: string | null;
    status?: string;
    page: number;
    pageSize: number;
  }): Observable<PaginatedEntrySummaryResponse> {
    const { trialId, status, page, pageSize } = options;

    if (environment.useMocks) {
      const filtered = SECRETARY_ENTRY_SUMMARY_MOCK_DATA.filter((entry) => {
        if (trialId && entry.trialId !== trialId) {
          return false;
        }
        if (status && entry.status !== status) {
          return false;
        }
        return true;
      });

      const sorted = [...filtered].sort((a, b) => {
        const aDate = a.submittedAtUtc ? Date.parse(a.submittedAtUtc) : 0;
        const bDate = b.submittedAtUtc ? Date.parse(b.submittedAtUtc) : 0;
        return bDate - aDate;
      });

      const start = (page - 1) * pageSize;
      const items = sorted.slice(start, start + pageSize);

      return of({
        items,
        page,
        pageSize,
        total: sorted.length
      });
    }

    const params = new URLSearchParams();
    params.set('page', page.toString());
    params.set('pageSize', pageSize.toString());
    if (trialId) {
      params.set('trialId', trialId);
    }
    if (status) {
      params.set('status', status);
    }

    const url = `${this.baseUrl}/secretary/entries?${params.toString()}`;

    return this.http.get<PaginatedEntrySummaryResponse>(url).pipe(
      map((response) => ({
        ...response,
        items: response.items ?? []
      }))
    );
  }
}
