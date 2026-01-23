import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TermsDto } from './registration.types';
import { MockDataService } from '../../shared/mocks/mock-data.service';

@Injectable({
  providedIn: 'root'
})
export class TermsService {
  private readonly baseUrl = environment.apiBaseUrl ?? '/api';

  constructor(
    private readonly http: HttpClient,
    private readonly mockDataService: MockDataService
  ) {}

  getCurrentTerms(): Observable<TermsDto> {
    if (this.mockDataService.isEnabled) {
      return this.mockDataService.getTerms();
    }

    return this.http.get<TermsDto>(`${this.baseUrl}/terms/current`);
  }
}
