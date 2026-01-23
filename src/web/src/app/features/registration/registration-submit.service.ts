import { Injectable } from '@angular/core';
import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
  HttpResponse
} from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { delay, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  ProblemDetails,
  SubmitEntryRequestDto,
  SubmitEntryResponseDto,
  SubmitEntryResult
} from './registration.types';

@Injectable({
  providedIn: 'root'
})
export class RegistrationSubmitService {
  private readonly baseUrl = environment.apiBaseUrl ?? '/api';

  constructor(private readonly http: HttpClient) {}

  submitEntry(
    entryId: string,
    request: SubmitEntryRequestDto
  ): Observable<SubmitEntryResult> {
    const response$ = environment.useMocks
      ? this.mockSubmit(entryId, request)
      : this.http.post<SubmitEntryResponseDto>(
          `${this.baseUrl}/entries/${entryId}/submit`,
          request,
          { observe: 'response' }
        );

    return response$.pipe(map((response) => this.toResult(entryId, response)));
  }

  private toResult(
    fallbackEntryId: string,
    response: HttpResponse<SubmitEntryResponseDto>
  ): SubmitEntryResult {
    const body = response.body;
    const supportId =
      body?.supportId || response.headers.get('x-support-id') || '';

    return {
      entryId: body?.entryId ?? fallbackEntryId,
      status: body?.status ?? 'Submitted',
      supportId
    };
  }

  private mockSubmit(
    entryId: string,
    _request: SubmitEntryRequestDto
  ): Observable<HttpResponse<SubmitEntryResponseDto>> {
    const supportId = this.createSupportId();
    const headers = new HttpHeaders({ 'x-support-id': supportId });

    if (this.shouldMockError()) {
      const problem: ProblemDetails = {
        type: 'https://example.invalid/problems/validation',
        title: 'Unable to submit entry. Please review the highlighted fields.',
        status: 400,
        traceId: supportId,
        errors: {
          'dog.callName': ['Call Name is required.'],
          selections: ['At least one class selection is required.']
        }
      };

      return throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            statusText: 'Bad Request',
            error: problem,
            headers
          })
      ).pipe(delay(400));
    }

    const response: SubmitEntryResponseDto = {
      entryId,
      status: 'Submitted',
      supportId
    };

    return of(new HttpResponse({ body: response, headers })).pipe(delay(500));
  }

  private shouldMockError(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }

    return window.location.search.includes('submitError=true');
  }

  private createSupportId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID().replace(/-/g, '');
    }

    return Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);
  }
}
