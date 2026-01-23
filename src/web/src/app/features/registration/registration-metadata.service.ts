import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TrialRegistrationMetadataDto } from './registration.types';
import { MockDataService } from '../../shared/mocks/mock-data.service';

@Injectable({
  providedIn: 'root'
})
export class RegistrationMetadataService {
  private readonly baseUrl = environment.apiBaseUrl ?? '/api';

  constructor(
    private readonly http: HttpClient,
    private readonly mockDataService: MockDataService
  ) {}

  getRegistrationMetadata(trialId: string): Observable<TrialRegistrationMetadataDto> {
    if (this.mockDataService.isEnabled) {
      return this.mockDataService.getRegistrationMetadata(trialId);
    }

    return this.http.get<TrialRegistrationMetadataDto>(
      `${this.baseUrl}/trials/${trialId}/registration/metadata`
    );
  }
}
