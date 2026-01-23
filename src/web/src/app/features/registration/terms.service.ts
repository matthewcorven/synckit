import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TermsDto } from './registration.types';
import { TERMS_MOCK_DATA } from './terms.mock';

@Injectable({
  providedIn: 'root'
})
export class TermsService {
  private readonly baseUrl = environment.apiBaseUrl ?? '/api';

  constructor(private readonly http: HttpClient) {}

  getCurrentTerms(): Observable<TermsDto> {
    if (environment.useMocks) {
      return of(TERMS_MOCK_DATA);
    }

    return this.http.get<TermsDto>(`${this.baseUrl}/terms/current`);
  }
}
