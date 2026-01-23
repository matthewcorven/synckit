import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { EntryDetailDto, PaginatedEntrySummaryResponse, PdfDownloadResponse } from './secretary.types';
import { SECRETARY_ENTRY_SUMMARY_MOCK_DATA } from './secretary.mock';
import { findSecretaryEntryDetail } from './secretary-detail.mock';

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

  getEntryDetail(entryId: string): Observable<EntryDetailDto> {
    if (environment.useMocks) {
      const match = findSecretaryEntryDetail(entryId);
      if (!match) {
        throw new Error('Entry not found');
      }
      return of(match);
    }

    return this.http.get<EntryDetailDto>(`${this.baseUrl}/secretary/entries/${entryId}`);
  }

  getPdfDownloadUrl(entryId: string): Observable<PdfDownloadResponse> {
    if (environment.useMocks) {
      const detail = findSecretaryEntryDetail(entryId);
      if (detail?.processing.generatedPdf?.downloadUrl) {
        return of({ downloadUrl: detail.processing.generatedPdf.downloadUrl });
      }

      return of({ downloadUrl: 'data:application/pdf;base64,JVBERi0xLjQKJcTl8uXrp/Og0MTGCjEgMCBvYmoKPDwvVHlwZS9DYXRhbG9nL1BhZ2VzIDIgMCBSPj4KZW5kb2JqCjIgMCBvYmoKPDwvVHlwZS9QYWdlcy9Db3VudCAxL0tpZHNbMyAwIFJdPj4KZW5kb2JqCjMgMCBvYmoKPDwvVHlwZS9QYWdlL1BhcmVudCAyIDAgUi9NZWRpYUJveFswIDAgMjAwIDIwMF0vQ29udGVudHMgNCAwIFI+PgplbmRvYmoKNCAwIG9iago8PC9MZW5ndGggNDQ+PnN0cmVhbQpCVCAvRjEgMTIgVGYgNzIgMTQ0IFRkIChQREYpIFRqIEVUCmVuZHN0cmVhbQplbmRvYmoKeHJlZgowIDUKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDEwIDAwMDAwIG4gCjAwMDAwMDAwNTcgMDAwMDAgbiAKMDAwMDAwMDEwNCAwMDAwMCBuIAowMDAwMDAwMTkzIDAwMDAwIG4gCnRyYWlsZXIKPDwvUm9vdCAxIDAgUi9TaXplIDU+PgpzdGFydHhyZWYKMjUwCiUlRU9G' });
    }

    return this.http.get<PdfDownloadResponse>(
      `${this.baseUrl}/secretary/entries/${entryId}/pdf`
    );
  }

  retryPdf(entryId: string): Observable<void> {
    if (environment.useMocks) {
      return of(void 0);
    }

    return this.http.post<void>(`${this.baseUrl}/secretary/entries/${entryId}/pdf/retry`, {});
  }
}
